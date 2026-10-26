#!/usr/bin/env bash
# 在 Ubuntu 22.04 服务器上安装「牌境」网页版与联机中继。
# 用法：sudo DOMAIN=thecardrealm.online CERT_EMAIL=you@example.com ./install.sh
# 目录要求：本脚本与 site/、server.py、cardrealm.service、nginx-cardrealm.conf 同级。
set -euo pipefail

DOMAIN="${DOMAIN:-thecardrealm.online}"
CERT_EMAIL="${CERT_EMAIL:-}"
SITE_DIR="${SITE_DIR:-/opt/cardrealm/site}"
APP_DIR="${APP_DIR:-/opt/cardrealm}"
BUNDLE_DIR="$(cd "$(dirname "$0")" && pwd)"

log() { printf '\n[cardrealm] %s\n' "$*"; }
fail() { printf '\n[cardrealm] 错误：%s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "请用 root 或 sudo 运行。"
[[ $DOMAIN =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]] || fail "DOMAIN 不合法：$DOMAIN"
[[ -f "$BUNDLE_DIR/site/index.html" ]] || fail "缺少 site/index.html，请先在本机运行 tools/build-web.sh 并上传解压后的目录。"
[[ -f "$BUNDLE_DIR/server.py" ]] || fail "缺少 server.py。"

log "安装 Python websockets 与 Nginx"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y python3-websockets nginx

id cardrealm >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin cardrealm

log "部署静态站点到 $SITE_DIR"
install -d -o root -g root "$SITE_DIR"
cp -a "$BUNDLE_DIR/site/." "$SITE_DIR"/
chmod -R a+rX "$SITE_DIR"

log "部署联机中继到 $APP_DIR"
install -d -o root -g root "$APP_DIR"
install -m 644 "$BUNDLE_DIR/server.py" "$APP_DIR/server.py"
install -m 644 "$BUNDLE_DIR/cardrealm.service" /etc/systemd/system/cardrealm.service
# 只允许本机 Nginx 转发，8787 不暴露到公网。
sed -i 's/^Environment=HOST=.*/Environment=HOST=127.0.0.1/' /etc/systemd/system/cardrealm.service
chown cardrealm:cardrealm "$APP_DIR/server.py"
systemctl daemon-reload
systemctl enable cardrealm
systemctl restart cardrealm

log "配置 Nginx 站点 $DOMAIN"
sed "s/__DOMAIN__/$DOMAIN/g" "$BUNDLE_DIR/nginx-cardrealm.conf" > /etc/nginx/sites-available/cardrealm
ln -sf /etc/nginx/sites-available/cardrealm /etc/nginx/sites-enabled/cardrealm
nginx -t
systemctl enable nginx
systemctl reload nginx

if [[ -n "$CERT_EMAIL" ]]; then
  log "申请 HTTPS 证书（域名必须已解析到本机，且 80 端口可从公网访问）"
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CERT_EMAIL" --redirect
  systemctl reload nginx
else
  log "未设置 CERT_EMAIL，暂时只启用 HTTP。DNS 生效后可运行："
  printf '  sudo certbot --nginx -d %s --redirect\n' "$DOMAIN"
fi

log "完成"
printf '  站点：http://%s\n' "$DOMAIN"
printf '  联机：ws://%s/ws（HTTPS 后自动升级为 wss）\n' "$DOMAIN"
printf '  服务状态：systemctl status cardrealm nginx --no-pager\n'
printf '  端口要求：安全组放行 80 / 443；8787 不需要对公网开放。\n'
