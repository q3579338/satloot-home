#!/usr/bin/env bash
# satloot.com 一键发布（本机跑，SSH 推到 VPS）：构建（顺带从 GitHub 同步仓库元数据）→ 打包 → 整目录换名 → nginx。
# 用法：bash deploy/deploy.sh
# 共存原则：只新增 satloot.com 站点文件和 /var/www/satloot-home，绝不改动任何既有站点；nginx -t 没过就撤软链退出。
set -euo pipefail
# 部署目标不写进仓库（站点套着 Cloudflare，源站 IP 不公开）：export HOST=user@host，或写在 ~/.earnfarm-deploy/host.txt
HOST="${HOST:-$(cat "$HOME/.earnfarm-deploy/host.txt" 2>/dev/null || true)}"
[ -n "$HOST" ] || { echo "!! 未设置部署目标：export HOST=user@host 或写入 ~/.earnfarm-deploy/host.txt"; exit 1; }
KEY="${KEY:-$HOME/.earnfarm-deploy/earnfarm_deploy_key}"
DOMAIN=satloot.com
WEBROOT=/var/www/satloot-home
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF="$HERE/deploy/nginx-$DOMAIN.conf"
SITE="$HERE/site"
cd "$HERE"
echo "==> 构建（同步 GitHub 仓库元数据）"
node tools/build.mjs
[ -s "$SITE/index.html" ] || { echo "!! 缺 site/index.html"; exit 1; }
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 "$HOST")
SCP=(scp -i "$KEY" -o StrictHostKeyChecking=accept-new -q)
TGZ="$(mktemp -t satloot-home-XXXXXX).tgz"
tar czf "$TGZ" -C "$SITE" .
echo "==> 推站点包（$(du -h "$TGZ" | cut -f1)）+ nginx 配置"
"${SCP[@]}" "$TGZ" "$HOST:/tmp/satloot-home.tgz"; rm -f "$TGZ"
"${SCP[@]}" "$CONF" "$HOST:/etc/nginx/sites-available/$DOMAIN"
"${SSH[@]}" "set -e
    rm -rf $WEBROOT.new; mkdir -p $WEBROOT.new
    tar xzf /tmp/satloot-home.tgz -C $WEBROOT.new; rm -f /tmp/satloot-home.tgz
    chown -R www-data:www-data $WEBROOT.new 2>/dev/null || true; chmod -R a+rX $WEBROOT.new
    if [ -d $WEBROOT ]; then mv $WEBROOT $WEBROOT.old; fi
    mv $WEBROOT.new $WEBROOT; rm -rf $WEBROOT.old
    ln -sfn /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
    if nginx -t; then systemctl reload nginx; sleep 1; echo '   nginx 已 reload'; else rm -f /etc/nginx/sites-enabled/$DOMAIN; echo '!! nginx -t 未通过，已撤销软链'; exit 1; fi
    for p in / /projects.json /sitemap.xml; do curl -sk --resolve $DOMAIN:443:127.0.0.1 -o /dev/null -w \"   %{http_code}  \$p  (%{size_download} B)\n\" \"https://$DOMAIN\$p\"; done
    curl -sk --resolve www.$DOMAIN:443:127.0.0.1 -o /dev/null -w '   %{http_code}  www → %{redirect_url}\n' https://www.$DOMAIN/"
echo; echo "完成：https://$DOMAIN/（DNS：Cloudflare 里 @ 与 www 两条 A 记录指向源站，橙云）"
