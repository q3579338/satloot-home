# satloot-home —— satloot.com 项目总览页

一页链接全部在线站点、GitHub 公开仓库与进行中的项目。纯静态，无后端。

- `projects.json`：手工清单（站点卡片、精选仓库顺序与中文标题、排除项、未开源项目）
- `tools/build.mjs`：用 `gh` 拉 GitHub 公开仓库元数据（描述/语言/星/更新时间，缓存到 `upstream/repos.json`）+ 清单 → `site/`
- `deploy/deploy.sh`：构建 + 发布到 VPS `/var/www/satloot-home`，nginx 站点 `satloot.com`（www 301 到裸域）

```bash
node tools/build.mjs && node -e "require('http').createServer((q,s)=>{const f=require('fs'),p='site'+(q.url.split('?')[0]==='/'?'/index.html':q.url.split('?')[0]);f.existsSync(p)?s.end(f.readFileSync(p)):(s.statusCode=404,s.end())}).listen(8796)"   # 本地看
bash deploy/deploy.sh   # 发布
```

新站点上线：在 `projects.json` 的 `sites` 加一项；新公开仓库会自动进「其他公开仓库」，想放进精选就加到 `featuredRepos` 与 `repoTitles`。
