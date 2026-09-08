// satloot.com 项目总览页生成器：projects.json（手工清单）+ GitHub API（公开仓库元数据）→ site/
// 用法：node tools/build.mjs        （需要 gh CLI 已登录；拿不到 GitHub 时用上次缓存 upstream/repos.json）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'projects.json'), 'utf8'));
const S = M.site;
const ORIGIN = `https://${S.domain}`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ymd = iso => iso ? iso.slice(0, 10) : '';

// ---- GitHub 公开仓库元数据（本机 gh 拉，缓存到 upstream/repos.json）----
const cache = path.join(ROOT, 'upstream', 'repos.json');
let repos;
try {
  const out = execFileSync('gh', ['api', '--paginate', `users/${S.github}/repos?per_page=100&type=owner&sort=pushed`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  // --paginate 会把多页 JSON 数组首尾相接，拆开再拼
  repos = out.trim().split(/\]\s*\[/).map((s, i, a) => JSON.parse((i ? '[' : '') + s + (i < a.length - 1 ? ']' : ''))).flat();
  repos = repos.filter(r => !r.fork && !r.private).map(r => ({
    name: r.name, description: r.description || '', language: r.language || '', stars: r.stargazers_count || 0,
    pushed: r.pushed_at, url: r.html_url, homepage: r.homepage || '', topics: r.topics || [], archived: !!r.archived,
  }));
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  fs.writeFileSync(cache, JSON.stringify(repos, null, 2));
  console.log(`GitHub: ${repos.length} 个公开非 fork 仓库（已缓存）`);
} catch (e) {
  if (!fs.existsSync(cache)) throw new Error('拿不到 GitHub 数据且没有缓存：' + e.message);
  repos = JSON.parse(fs.readFileSync(cache, 'utf8'));
  console.warn('GitHub 拉取失败，用缓存：' + e.message.split('\n')[0]);
}
const byName = Object.fromEntries(repos.map(r => [r.name, r]));
const featured = M.featuredRepos.map(n => byName[n]).filter(Boolean);
const missing = M.featuredRepos.filter(n => !byName[n]);
if (missing.length) console.warn('清单里有但 GitHub 上没找到（私有或改名？）：' + missing.join(', '));
const rest = repos.filter(r => !M.featuredRepos.includes(r.name) && !M.excludeRepos.includes(r.name)).sort((a, b) => b.pushed.localeCompare(a.pushed));

const LANG_COLOR = { JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Shell: '#89e051', HTML: '#e34c26', CSS: '#563d7c', Go: '#00ADD8', 'C++': '#f34b7d', Ruby: '#701516' };
const FONT = `"PingFang SC","Microsoft YaHei UI","Microsoft YaHei","Noto Sans SC",-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif`;
const FAVICON = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b0e17"/><path d="M20 40c0 5 5 8 12 8s12-3 12-8c0-11-22-5-22-16 0-5 5-8 11-8s11 3 11 8" fill="none" stroke="#ff7a59" stroke-width="6" stroke-linecap="round"/></svg>`)}`;

const siteCard = s => `
      <a class="card site" href="${esc(s.url)}" rel="noopener">
        <div class="top"><span class="host">${esc(s.host)}</span><span class="tag">${esc(s.tag)}</span></div>
        <h3>${esc(s.title)}</h3>
        <div class="en">${esc(s.titleEn)}</div>
        <p>${esc(s.desc)}</p>
        <div class="foot"><span class="go">打开 ↗</span>${(s.repos || []).map(n => byName[n] ? `<span class="mini">源码 ${esc(n)}</span>` : '').join('')}</div>
      </a>`;

const repoCard = r => `
      <a class="card repo" href="${esc(r.url)}" rel="noopener">
        <div class="top"><span class="host">${esc(r.name)}</span>${r.stars ? `<span class="stars">★ ${r.stars}</span>` : ''}</div>
        <h3>${esc(M.repoTitles[r.name] || r.name)}</h3>
        <p>${esc((M.repoDesc || {})[r.name] || r.description || '（无描述）')}</p>
        <div class="foot">${r.language ? `<span class="lang"><i style="background:${LANG_COLOR[r.language] || '#8b93a7'}"></i>${esc(r.language)}</span>` : ''}<span class="meta">更新 ${ymd(r.pushed)}</span>${r.homepage ? `<span class="mini">${esc(r.homepage.replace(/^https?:\/\//, ''))}</span>` : ''}</div>
      </a>`;

const restRow = r => `
        <li><a href="${esc(r.url)}" rel="noopener">${esc(r.name)}</a>${r.language ? `<span class="lang"><i style="background:${LANG_COLOR[r.language] || '#8b93a7'}"></i>${esc(r.language)}</span>` : ''}<span class="d">${esc(r.description || '')}</span><span class="meta">${ymd(r.pushed)}</span></li>`;

const privRow = p => `
        <li>${p.site ? `<a href="${esc(p.site)}" rel="noopener">${esc(p.name)}</a>` : `<b>${esc(p.name)}</b>`}<span class="d">${esc(p.desc)}</span><span class="meta">${p.site ? '在线 ↗' : '未开源'}</span></li>`;

const jsonld = {
  '@context': 'https://schema.org', '@type': 'WebSite', name: S.title, url: ORIGIN + '/', description: S.tagline, inLanguage: 'zh-CN',
  author: { '@type': 'Person', name: S.github, url: `https://github.com/${S.github}` },
};

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(S.title)} · 项目总览</title>
<meta name="description" content="${esc(S.tagline)}：${M.sites.map(s => s.title).join('、')}，以及 ${repos.length} 个开源仓库。${esc(S.taglineEn)}">
<link rel="canonical" href="${ORIGIN}/">
<link rel="icon" href="${FAVICON}">
<meta name="theme-color" content="#0b0e17">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(S.title)}">
<meta property="og:title" content="${esc(S.title)} · 项目总览">
<meta property="og:description" content="${esc(S.tagline)}">
<meta property="og:url" content="${ORIGIN}/">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>
:root{--bg:#0b0e17;--card:#151a28;--card2:#1b2133;--line:rgba(255,255,255,.08);--line2:rgba(255,255,255,.16);
  --text:#e8ecf5;--muted:#8b93a7;--dim:#5f677a;--accent:#ff7a59;--accent2:#ffd166;--r:16px}
*{box-sizing:border-box}
html{color-scheme:dark;-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 ${FONT};
  background-image:radial-gradient(900px 420px at 10% -10%,rgba(255,122,89,.16),transparent 60%),radial-gradient(700px 380px at 95% 0%,rgba(255,209,102,.10),transparent 60%);background-repeat:no-repeat}
a{color:inherit;text-decoration:none}
.wrap{max-width:1180px;margin:0 auto;padding:0 20px}
header{display:flex;align-items:center;justify-content:space-between;padding:18px 0;gap:16px}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:18px;letter-spacing:.2px}
.brand img{width:28px;height:28px;display:block;border-radius:7px}
nav a{color:var(--muted);font-size:14px;margin-left:18px;padding:6px 0;border-bottom:1px solid transparent}
nav a:hover{color:var(--text);border-bottom-color:var(--line2)}
.hero{padding:36px 0 22px}
.hero h1{margin:0 0 10px;font-size:clamp(30px,5vw,50px);line-height:1.12;letter-spacing:-.4px;font-weight:800}
.hero h1 em{font-style:normal;background:linear-gradient(90deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}
.hero p{margin:0;color:var(--muted);max-width:760px;font-size:16px}
.hero p.en{font-size:13.5px;color:var(--dim);margin-top:4px}
.pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
.pills span{font-size:12.5px;color:var(--muted);border:1px solid var(--line);background:rgba(255,255,255,.03);border-radius:999px;padding:5px 11px}
.pills b{color:var(--accent2)}
h2{margin:40px 0 6px;font-size:22px;letter-spacing:-.2px}
h2 small{font-weight:500;color:var(--dim);font-size:13px;margin-left:10px}
.sub{margin:0 0 16px;color:var(--muted);font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px}
.card{display:flex;flex-direction:column;gap:6px;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:18px 20px;transition:transform .18s,border-color .18s,box-shadow .18s}
.card:hover{transform:translateY(-3px);border-color:rgba(255,122,89,.45);box-shadow:0 18px 40px -22px rgba(255,122,89,.35)}
.card .top{display:flex;justify-content:space-between;align-items:center;gap:10px}
.card .host{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;color:var(--accent2);letter-spacing:.2px}
.card .tag,.card .stars{font-size:11.5px;color:var(--muted);background:var(--card2);border:1px solid var(--line);border-radius:999px;padding:2px 9px;white-space:nowrap}
.card h3{margin:4px 0 0;font-size:18px;line-height:1.3;font-weight:800}
.card .en{color:var(--dim);font-size:12px;letter-spacing:.4px;text-transform:uppercase}
.card p{margin:6px 0 0;color:var(--muted);font-size:14px;flex:1}
.card .foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px;font-size:12.5px;color:var(--dim)}
.card .go{color:var(--accent);font-weight:700}
.card:hover .go{text-decoration:underline}
.lang{display:inline-flex;align-items:center;gap:6px;color:var(--muted)}
.lang i{width:9px;height:9px;border-radius:50%;display:inline-block}
.mini{color:var(--dim)}
.list{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.list li{display:grid;grid-template-columns:200px auto 1fr auto;gap:14px;align-items:baseline;padding:10px 0;border-bottom:1px solid var(--line);font-size:14px}
.list li a,.list li b{font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13.5px}
.list li a:hover{color:var(--accent2)}
.list .d{color:var(--muted)}
.list .meta{color:var(--dim);font-size:12.5px;white-space:nowrap}
@media (max-width:720px){.list li{grid-template-columns:1fr auto;gap:4px 12px}.list .d{grid-column:1/-1}.brand small{display:none}nav a{margin-left:12px}}
.about{margin:44px 0 0;padding:26px 0 0;border-top:1px solid var(--line);display:grid;grid-template-columns:1.3fr 1fr;gap:36px}
.about h3{margin:0 0 10px;font-size:16px}
.about p{margin:0 0 10px;color:var(--muted);font-size:14px}
.about ul{list-style:none;margin:0;padding:0}
.about li{display:flex;gap:10px;align-items:baseline;padding:7px 0;border-bottom:1px dashed var(--line);font-size:14px}
.about li a{font-weight:600;white-space:nowrap}
.about li a:hover{color:var(--accent2)}
.about li span{color:var(--dim);font-size:13px}
@media (max-width:720px){.about{grid-template-columns:1fr;gap:20px}}
footer{padding:36px 0 40px;color:var(--dim);font-size:13px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
footer a{color:var(--muted)}footer a:hover{color:var(--text)}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="/"><img src="${FAVICON}" alt="">${esc(S.title)}</a>
    <nav><a href="#sites">在线站点</a><a href="#repos">开源仓库</a><a href="#wip">进行中</a><a href="https://github.com/${esc(S.github)}" rel="noopener">GitHub ↗</a></nav>
  </header>

  <section class="hero">
    <h1>${esc(S.title)} <em>项目总览</em></h1>
    <p>${esc(S.tagline)}。这一页是入口：在线站点直接打开就能用，开源仓库在 GitHub 上随便翻。</p>
    <p class="en">${esc(S.taglineEn)}</p>
    <div class="pills"><span><b>${M.sites.length}</b> 个在线站点</span><span><b>${repos.length}</b> 个公开仓库</span><span><b>${M.private.length}</b> 个进行中</span><span>全部自建自维护</span></div>
  </section>

  <h2 id="sites">在线站点<small>打开即用</small></h2>
  <p class="sub">都跑在同一台服务器上，互相之间有友链。</p>
  <div class="grid">${M.sites.map(siteCard).join('')}
  </div>

  <h2 id="repos">开源仓库<small>github.com/${esc(S.github)}</small></h2>
  <p class="sub">主要的几个。描述、语言与更新时间来自 GitHub，每次发布时同步。</p>
  <div class="grid">${featured.map(repoCard).join('')}
  </div>
  ${rest.length ? `
  <h2>其他公开仓库<small>${rest.length} 个</small></h2>
  <p class="sub">早期的脚本与实验，按最近更新排序。</p>
  <ul class="list">${rest.map(restRow).join('')}
  </ul>` : ''}

  <h2 id="wip">进行中<small>未开源或尚未上线</small></h2>
  <p class="sub">有站点的可以直接打开，其余还在打磨。</p>
  <ul class="list">${M.private.map(privRow).join('')}
  </ul>

  <section class="about">
    <div>
      <h3>关于</h3>
      <p>satloot 下面的东西大多围绕两件事：把加密交易里容易亏钱的环节做成工具（扫描、风控、纪律、模拟），以及一些纯粹好玩的实验（用区块哈希生成宇宙、单文件小游戏、CPU 友好的共识）。</p>
      <p>所有站点都不收集个人数据，能开源的都开源。仓库有问题直接开 issue。</p>
    </div>
    <div>
      <h3>直达</h3>
      <ul>${M.sites.map(s => `
        <li><a href="${esc(s.url)}" rel="noopener">${esc(s.host)}</a><span>${esc(s.title)}</span></li>`).join('')}
        <li><a href="https://github.com/${esc(S.github)}" rel="noopener">github.com/${esc(S.github)}</a><span>全部源码仓库</span></li>
      </ul>
    </div>
  </section>

  <footer>
    <span>© ${new Date().getFullYear()} ${esc(S.title)} · ${esc(S.domain)}</span>
    <span><a href="https://github.com/${esc(S.github)}" rel="noopener">GitHub</a> · <a href="/projects.json">projects.json</a> · <a href="/sitemap.xml">sitemap</a></span>
  </footer>
</div>
</body>
</html>
`;

fs.mkdirSync(SITE, { recursive: true });
fs.writeFileSync(path.join(SITE, 'index.html'), html);
fs.writeFileSync(path.join(SITE, 'projects.json'), JSON.stringify({ site: S, sites: M.sites, repos: [...featured, ...rest], private: M.private, generated: new Date().toISOString() }, null, 2));
fs.writeFileSync(path.join(SITE, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
fs.writeFileSync(path.join(SITE, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${ORIGIN}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n`);
console.log(`built site/index.html (${(html.length / 1024).toFixed(0)} KB): ${M.sites.length} 站点, ${featured.length} 精选仓库, ${rest.length} 其他仓库, ${M.private.length} 进行中`);
