# 联机服务器部署

适用环境：阿里云 ECS，Ubuntu 22.04，2 核 / 1.7 GiB，Python 3.10.12。中继进程内存占用很低，可与现有服务共存。

服务器不做游戏判定、不存账号和存档，只转发两名玩家之间的消息。房主客户端是权威状态源。

## 0. 推荐：同一个域名托管网页 + 联机（Nginx + `/ws`）

网页版和联机中继放在同一个域名下：Nginx 在 80/443 提供静态页面，并把 `/ws` 转发到本机 8787。网页会自动把联机地址设为 `wss://你的域名/ws`，玩家不用手填。

本机先生成发布包：

```bash
bash tools/build-web.sh
```

得到 `dist/web/` 和 `CardRealm-web.tar.gz`。上传到服务器后执行：

```bash
tar -xzf CardRealm-web.tar.gz -C /tmp/cardrealm-web
cd /tmp/cardrealm-web
sudo DOMAIN=thecardrealm.online CERT_EMAIL=你的邮箱 ./install.sh
```

脚本会安装 Nginx / `python3-websockets`、创建 `cardrealm` 用户、把网页放到 `/opt/cardrealm/site`、中继只监听 `127.0.0.1:8787`，并申请证书。没有证书邮箱时先跑 HTTP，之后在服务器执行：

```bash
sudo certbot --nginx -d thecardrealm.online --redirect
```

前置条件（缺一不可）：

- 域名完成**实名认证**。新购域名在实名审核通过前，DNS 记录不会生效，解析会返回 NXDOMAIN。
- 阿里云安全组放行 **TCP 80 / 443**；8787 不需要对公网开放。
- 域名 A 记录指向 ECS 公网 IP。
- 中国内地 ECS 用域名在 80/443 提供网站，需要 **ICP 备案**；未备案会被阻断。备案前只能临时用 `IP:端口` 测试。

如果域名暂时不能解析，可先用直连方式（下面的方案 B）验证联机，再切到域名。

## 1. 需要安装什么

| 位置 | 必须 | 说明 |
| --- | --- | --- |
| 服务器 | Python 3.10 + `websockets` | 中继必需，ECS 已具备 |
| 服务器（方案 A） | Nginx + Certbot | 同域网页 + HTTPS + `/ws` 反代 |
| 服务器（方案 B） | 无 | 直接暴露 `ws://IP:8787`，仅建议临时测试 |
| Windows 客户端 | WebView2 Runtime | 通常已自带；游戏包已包含 .NET 9 运行时 |
| 二次开发 | .NET 9 SDK | 仅重新打包桌面端时需要 |

## 2. 方案 B：只上传中继（IP 直连测试）

跳过 Nginx，仅把 `server/server.py` 上传到服务器，例如使用阿里云 Workbench 或：

```bash
scp server/server.py root@<服务器公网IP>:/tmp/server.py
```

在服务器上执行：

```bash
sudo mkdir -p /opt/cardrealm
sudo cp /tmp/server.py /opt/cardrealm/server.py
sudo useradd --system --no-create-home --shell /usr/sbin/nologin cardrealm 2>/dev/null || true
sudo chown -R cardrealm:cardrealm /opt/cardrealm

# 确认依赖可用
python3 -c "import websockets; print(websockets.__version__)"

# 前台试跑，看到 listening on ws://0.0.0.0:8787 即成功
sudo -u cardrealm python3 /opt/cardrealm/server.py
```

按 `Ctrl+C` 停止试跑。若提示缺少 `websockets`：

```bash
sudo apt update && sudo apt install -y python3-websockets
```

也可以不改系统环境，使用虚拟环境：

```bash
sudo apt install -y python3-venv
sudo -u cardrealm python3 -m venv /opt/cardrealm/.venv
sudo -u cardrealm /opt/cardrealm/.venv/bin/pip install "websockets>=13,<16"
```

使用虚拟环境时，把服务文件中的 `ExecStart` 改为
`/opt/cardrealm/.venv/bin/python /opt/cardrealm/server.py`。

## 3. 方案 B：注册为 systemd 服务

方案 A 的 `install.sh` 会自动完成本节到第 5 节的操作，并把 `HOST` 改为 `127.0.0.1`；只有单独部署中继时才需要手工执行。

仓库已附带 [server/cardrealm.service](../server/cardrealm.service)：

```bash
sudo cp server/cardrealm.service /etc/systemd/system/cardrealm.service
sudo systemctl daemon-reload
sudo systemctl enable --now cardrealm
sudo systemctl status cardrealm --no-pager
```

查看实时日志：

```bash
sudo journalctl -u cardrealm -f
```

修改代码后：

```bash
sudo cp server/server.py /opt/cardrealm/server.py
sudo systemctl restart cardrealm
```

可调环境变量（在 service 文件中修改）：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | 监听地址；套 TLS 反代时建议 `127.0.0.1` |
| `PORT` | `8787` | 监听端口 |
| `MAX_ROOMS` | `500` | 同时存在的房间上限 |

房间只保存在内存中，服务重启后所有房间会消失；重新建房即可。

## 4. 方案 B：放行端口

阿里云控制台 → ECS → 安全组 → 入方向，添加：

- 协议：TCP
- 端口：`8787`
- 授权对象：`0.0.0.0/0`（只和固定朋友玩时，建议改成你们的公网 IP）

如果系统启用了 ufw：

```bash
sudo ufw allow 8787/tcp
sudo ufw status
```

方案 A 不需要放行 8787，只放行 80 / 443。

不要为了联机关闭整个防火墙。

验证监听与连通性：

```bash
# 服务器上
ss -ltnp | grep 8787

# Windows PowerShell 上
Test-NetConnection <服务器公网IP> -Port 8787
```

客户端服务器地址填写：

```text
ws://<服务器公网IP>:8787
```

地址也可以只写 `IP:端口`，客户端会自动补 `ws://`。

## 5. 可选：Caddy 或其他 TLS 反代

方案 A 已包含 Nginx 配置。若改用 Caddy：

1. 安装 Caddy。
2. 将中继改为只监听本机：`Environment=HOST=127.0.0.1`。
3. 安全组放行 80 / 443，并取消对公网放行 8787。
4. Caddyfile：

```caddyfile
dream.example.com {
    root * /opt/cardrealm/site
    file_server
    reverse_proxy /ws* 127.0.0.1:8787
}
```

5. `sudo systemctl reload caddy`。

网页端地址自动为 `wss://dream.example.com/ws`。中继本身接受任意 WebSocket 路径，Nginx 示例使用 `/ws`；桌面端也可以手动填写同一地址。

## 6. 排错

| 现象 | 排查 |
| --- | --- |
| 客户端一直连接失败 | 安全组 / ufw 是否放行；`ss -ltnp` 是否有进程监听；地址是否用了公网 IP |
| `no-room` | 房间码为五位，区分前后空格；房主重启房间后旧码失效 |
| `room-full` | 每个房间只允许两名玩家 |
| `对方掉线了` | 连接断开或 20 秒级心跳超时；重新建房加入 |
| 服务启动报依赖错误 | 装 `python3-websockets`，或按上面的虚拟环境方式运行 |
| 重启后旧房间进不去 | 正常现象，房间是纯内存状态 |
| 域名解析 NXDOMAIN | 新域名先完成实名认证；再检查 A 记录是否指向 ECS 公网 IP |
| 域名 80 / 443 打不开 | 中国内地 ECS 需 ICP 备案；同时检查安全组和 Nginx 状态 |

## 7. 安全说明

- 服务端不需要任何 API Key、密码或数据库凭据，**不要把生图 Key 放到服务器上**。
- 联机没有账号体系，房间码就是入场凭证；不要在公开渠道长久公布服务器地址和房间码。
- 中继会限制消息大小（96 KiB）与消息频率（10 秒 160 条），并限制房间总数。
- 房主客户端裁定战斗，服务器只转发 JSON；不要修改客户端去转发无关敏感数据。
- 公网长期运行建议使用域名 + TLS，并把安全组来源限制在可信 IP 范围。
