#!/usr/bin/env python3
"""牌境联机服务：房间码 + 双人中继 + 心跳。

服务器不做游戏判定，房主客户端是权威状态源，服务器只在两名玩家之间转发消息。
依赖：websockets（Python 3.10+）。
环境变量：HOST（默认 0.0.0.0）、PORT（默认 8787）、MAX_ROOMS（默认 500）。
"""

import asyncio
import json
import logging
import os
import re
import secrets
import signal
import time
from collections import deque

try:
    from websockets.asyncio.server import serve
except ImportError:  # websockets < 13
    from websockets import serve

from websockets.exceptions import ConnectionClosed

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
LOG = logging.getLogger("cardrealm")

HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8787"))
MAX_ROOMS = int(os.environ.get("MAX_ROOMS", "500"))
MAX_MESSAGE = 96 * 1024
RATE_WINDOW = 10.0
RATE_LIMIT = 160
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 5
MODES = {"pvp": "镜像决斗", "coop": "共梦之战"}
ORIGINS = {"blade", "arcanist", "wraith", "pyre"}
SAFE_ID = re.compile(r"^[a-zA-Z0-9_-]{1,48}$")

ROOMS = {}


def clean_text(value, limit):
    if not isinstance(value, str):
        return ""
    cleaned = "".join(ch for ch in value.strip() if ch >= " " and ch != "\x7f")
    return cleaned[:limit]


def new_code():
    while True:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
        if code not in ROOMS:
            return code


class Client:
    def __init__(self, websocket):
        self.ws = websocket
        self.room = None
        self.role = None
        self.name = "无名旅者"
        self.origin = "blade"
        self.sent_at = deque()
        self.closed = False


class Room:
    def __init__(self, code, mode, host, info, enemy_id):
        self.code = code
        self.mode = mode
        self.host = host
        self.guest = None
        self.host_info = info
        self.guest_info = None
        self.enemy_id = enemy_id
        self.created = time.time()


def player_info(client):
    return {"name": client.name, "originId": client.origin}


async def send(client, payload):
    if client is None or client.closed:
        return False
    try:
        await client.ws.send(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
        return True
    except Exception as exc:  # noqa: BLE001 - 连接断开是正常路径
        LOG.debug("send failed: %s", exc)
        return False


async def send_error(client, code, message):
    await send(client, {"type": "error", "code": code, "message": message})


def other_player(room, role):
    if room is None:
        return None
    return room.guest if role == "host" else room.host


async def close_room(room, reason, notify_peer=True, leaving=None):
    """结束房间，并通知另一位玩家。"""
    if room is None:
        return
    ROOMS.pop(room.code, None)
    for role, client in (("host", room.host), ("guest", room.guest)):
        if client is None:
            continue
        if client.room is room:
            client.room = None
        if client is leaving:
            continue
        if notify_peer:
            await send(client, {"type": "peer-left", "reason": reason})
        if client is not leaving:
            client.role = None
    room.guest = None
    LOG.info("room %s closed (%s)", room.code, reason)


async def detach(client, reason):
    room = client.room
    if room is None:
        return
    await close_room(room, reason, leaving=client)
    client.room = None
    client.role = None


def rate_limited(client):
    now = time.monotonic()
    while client.sent_at and now - client.sent_at[0] > RATE_WINDOW:
        client.sent_at.popleft()
    if len(client.sent_at) >= RATE_LIMIT:
        return True
    client.sent_at.append(now)
    return False


async def handle_create(client, message):
    if client.room is not None:
        await send_error(client, "already-in-room", "你已经在房间里了。")
        return
    if len(ROOMS) >= MAX_ROOMS:
        await send_error(client, "server-full", "服务器上的房间已满，请稍后再试。")
        return
    mode = message.get("mode")
    if mode not in MODES:
        await send_error(client, "bad-mode", "未知的联机模式。")
        return
    origin = message.get("originId")
    if origin not in ORIGINS:
        origin = "blade"
    client.name = clean_text(message.get("name"), 16) or "无名旅者"
    client.origin = origin
    enemy_id = message.get("enemyId")
    if not isinstance(enemy_id, str) or not SAFE_ID.match(enemy_id):
        enemy_id = "nightmare-dragon"
    room = Room(new_code(), mode, client, player_info(client), enemy_id)
    ROOMS[room.code] = room
    client.room = room
    client.role = "host"
    await send(client, {
        "type": "room-created",
        "code": room.code,
        "mode": room.mode,
        "role": "host",
        "you": player_info(client),
        "enemyId": room.enemy_id,
        "server": "cardrealm/1",
    })
    LOG.info("room %s created by %s (mode=%s, origin=%s)", room.code, client.name, room.mode, origin)


async def handle_join(client, message):
    if client.room is not None:
        await send_error(client, "already-in-room", "你已经在房间里了。")
        return
    code = clean_text(message.get("code"), 8).upper()
    if not code:
        await send_error(client, "bad-code", "请填写房间码。")
        return
    room = ROOMS.get(code)
    if room is None:
        await send_error(client, "no-room", "没有找到这个房间，检查一下房间码。")
        return
    if room.guest is not None:
        await send_error(client, "room-full", "这个房间已经满员了。")
        return
    origin = message.get("originId")
    if origin not in ORIGINS:
        origin = "blade"
    client.name = clean_text(message.get("name"), 16) or "无名旅者"
    client.origin = origin
    client.room = room
    client.role = "guest"
    room.guest = client
    room.guest_info = player_info(client)
    await send(client, {
        "type": "room-joined",
        "code": room.code,
        "mode": room.mode,
        "role": "guest",
        "you": player_info(client),
        "host": room.host_info,
        "enemyId": room.enemy_id,
        "server": "cardrealm/1",
    })
    await send(room.host, {
        "type": "peer-joined",
        "peer": room.guest_info,
        "code": room.code,
    })
    LOG.info("room %s joined by %s (origin=%s)", room.code, client.name, origin)


async def handle_relay(client, message):
    if client.room is None or client.role is None:
        await send_error(client, "no-room", "你还没有加入房间。")
        return
    data = message.get("data")
    if not isinstance(data, dict):
        return
    peer = other_player(client.room, client.role)
    if peer is None:
        return
    await send(peer, {"type": "relay", "from": client.role, "data": data})


async def handle_leave(client):
    if client.room is None:
        await send(client, {"type": "left"})
        return
    await detach(client, "对方离开了房间。")
    await send(client, {"type": "left"})


async def handler(websocket, _path=None):
    client = Client(websocket)
    remote = getattr(websocket, "remote_address", None)
    LOG.info("connection open %s", remote)
    try:
        async for raw in websocket:
            if rate_limited(client):
                await send_error(client, "rate-limited", "操作太快了，慢一点。")
                await websocket.close(code=1008, reason="rate limited")
                break
            if isinstance(raw, bytes):
                continue
            if len(raw) > MAX_MESSAGE:
                continue
            try:
                message = json.loads(raw)
            except (ValueError, TypeError):
                continue
            if not isinstance(message, dict):
                continue
            kind = message.get("type")
            if kind == "create":
                await handle_create(client, message)
            elif kind == "join":
                await handle_join(client, message)
            elif kind == "relay":
                await handle_relay(client, message)
            elif kind == "leave":
                await handle_leave(client)
            elif kind == "ping":
                await send(client, {"type": "pong", "t": int(time.time() * 1000)})
            else:
                await send_error(client, "unknown", "服务器不认识这条消息。")
    except ConnectionClosed:
        pass
    except Exception:
        LOG.exception("handler failed")
    finally:
        client.closed = True
        if client.room is not None:
            await detach(client, "对方掉线了。")
        try:
            await websocket.close()
        except Exception:  # noqa: BLE001
            pass
        LOG.info("connection closed %s", remote)


async def main():
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for signame in ("SIGINT", "SIGTERM"):
        try:
            loop.add_signal_handler(getattr(signal, signame), stop.set)
        except (NotImplementedError, AttributeError):
            pass
    async with serve(
        handler,
        HOST,
        PORT,
        max_size=MAX_MESSAGE,
        ping_interval=20,
        ping_timeout=25,
        close_timeout=5,
    ):
        LOG.info("cardrealm relay listening on ws://%s:%s", HOST, PORT)
        try:
            await stop.wait()
        except KeyboardInterrupt:
            pass
    LOG.info("cardrealm relay stopped")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
