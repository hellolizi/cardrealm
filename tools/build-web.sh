#!/usr/bin/env bash
# 生成网页版发布包：dist/web/（可部署目录）与 CardRealm-web.tar.gz
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist/web"
SITE="$OUT/site"

rm -rf "$OUT"
mkdir -p "$SITE"

cp "$ROOT/index.html" "$SITE/"
cp -a "$ROOT/css" "$ROOT/js" "$ROOT/assets" "$SITE/"

cp "$ROOT/server/server.py" "$OUT/"
cp "$ROOT/server/cardrealm.service" "$OUT/"
cp "$ROOT/server/nginx-cardrealm.conf" "$OUT/"
cp "$ROOT/server/install-web.sh" "$OUT/install.sh"
chmod +x "$OUT/install.sh"

cat > "$OUT/README.txt" <<'TXT'
牌境 · 网页版部署包
====================

1. 把整个目录上传到服务器（例如 /tmp/cardrealm-web）。
2. 在服务器执行：
     cd /tmp/cardrealm-web
     sudo DOMAIN=thecardrealm.online CERT_EMAIL=你的邮箱 ./install.sh
   没有邮箱或域名暂未解析时，省略 CERT_EMAIL，先跑 HTTP。
3. 阿里云安全组放行 TCP 80 / 443；8787 不需要对公网开放。
4. 域名解析：A 记录指向服务器公网 IP。
5. HTTPS 生效后，网页自动使用 wss://域名/ws 联机。
6. 以后只更新网页时，替换 /opt/cardrealm/site 内的文件即可；
   重新运行 install.sh 会覆盖 Nginx 配置，需要再次执行 certbot 恢复 HTTPS。

目录说明：
  site/                  静态网页（Nginx 根目录）
  server.py              双人中继
  cardrealm.service      systemd 服务
  nginx-cardrealm.conf   Nginx 站点配置
  install.sh             一键安装脚本
TXT

TARBALL="$ROOT/CardRealm-web.tar.gz"
rm -f "$TARBALL"
tar -czf "$TARBALL" -C "$OUT" .
( cd "$ROOT" && sha256sum CardRealm-web.tar.gz > CardRealm-web.tar.gz.sha256 2>/dev/null || sha256sum CardRealm-web.tar.gz | awk '{print $1}' > CardRealm-web.tar.gz.sha256 )

printf '网页目录：%s\n' "$OUT"
printf '发布包：%s（%s 字节）\n' "$TARBALL" "$(wc -c < "$TARBALL")"
cat "$TARBALL.sha256"
