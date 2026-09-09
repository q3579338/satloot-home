// satloot.com 项目总览页生成器：projects.json（手工清单）+ GitHub API（公开仓库元数据）→ site/
// 中英双语:中文在 / ,英文在 /en/ ,互相带 hreflang;英文文案来自 projects.json 的 *En 字段,缺了就回落中文。
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
// meta description 控制在 80–160 字符：前缀 + 塞得下多少条目就多少 + 后缀
const fit = (head, items, sep, tail, max = 158) => { const picked = []; for (const it of items) { if ((head + [...picked, it].join(sep) + tail).length > max) break; picked.push(it); } return head + picked.join(sep) + tail; };
const OG_IMAGE = `${ORIGIN}/assets/og.png`;   // 1200×630，tools/make-og.mjs 生成，源文件在 assets/
const LOGO_512 = `${ORIGIN}/assets/logo-512.png`;
const THEME = '#f7f7fb';

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

// ---- 两种语言的界面文案 ----
const LOCALES = {
  zh: {
    code: 'zh', htmlLang: 'zh-CN', dir: '', other: 'en', otherLabel: 'EN', otherHref: '/en/',
    titleSuffix: '项目总览', h1em: '项目总览',
    heroLine: '这一页是入口：在线站点直接打开就能用，开源仓库在 GitHub 上随便翻。',
    pills: (a, b, c) => [`<b>${a}</b> 个在线站点`, `<b>${b}</b> 个公开仓库`, `<b>${c}</b> 个进行中`, '全部自建自维护'],
    nav: { sites: '在线站点', repos: '开源仓库', wip: '进行中', github: 'GitHub ↗' },
    sitesH: '在线站点', sitesSmall: '打开即用', sitesSub: '都跑在同一台服务器上，互相之间有友链。',
    reposH: '开源仓库', reposSub: '主要的几个。描述、语言与更新时间来自 GitHub，每次发布时同步。',
    restH: '其他公开仓库', restSmall: n => `${n} 个`, restSub: '早期的脚本与实验，按最近更新排序。',
    wipH: '进行中', wipSmall: '未开源或尚未上线', wipSub: '有站点的可以直接打开，其余还在打磨。',
    open: '打开 ↗', src: '源码', updated: '更新', noDesc: '（无描述）', live: '在线 ↗', closed: '未开源',
    aboutH: '关于',
    about1: 'satloot 下面的东西大多围绕两件事：把加密交易里容易亏钱的环节做成工具（扫描、风控、纪律、模拟），以及一些纯粹好玩的实验（用区块哈希生成宇宙、单文件小游戏、CPU 友好的共识）。',
    about2: '所有站点都不收集个人数据，能开源的都开源。仓库有问题直接开 issue。',
    quickH: '直达', allRepos: '全部源码仓库',
    metaDesc: (sites, n) => fit(`${S.tagline}：`, sites, '、', `等 ${sites.length} 个在线站点，以及 ${n} 个开源仓库，全部自建自维护。`),
    ogAlt: 'satloot 项目总览：在线站点与开源仓库',
    tagline: S.tagline, taglineAlt: S.taglineEn,
  },
  en: {
    code: 'en', htmlLang: 'en', dir: 'en/', other: 'zh', otherLabel: '中文', otherHref: '/',
    titleSuffix: 'Projects', h1em: 'project index',
    heroLine: 'This page is the front door: the live sites just work, and the open-source repos are on GitHub.',
    pills: (a, b, c) => [`<b>${a}</b> live sites`, `<b>${b}</b> public repos`, `<b>${c}</b> in progress`, 'All self-built and self-hosted'],
    nav: { sites: 'Sites', repos: 'Repos', wip: 'In progress', github: 'GitHub ↗' },
    sitesH: 'Live sites', sitesSmall: 'ready to use', sitesSub: 'All run on one server and link to each other.',
    reposH: 'Open-source repos', reposSub: 'The main ones. Descriptions, languages and dates come from GitHub and sync on every publish.',
    restH: 'Other public repos', restSmall: n => `${n}`, restSub: 'Early scripts and experiments, newest first.',
    wipH: 'In progress', wipSmall: 'not open-sourced or not live yet', wipSub: 'The ones with a site can be opened; the rest are still being polished.',
    open: 'Open ↗', src: 'src', updated: 'updated', noDesc: '(no description)', live: 'live ↗', closed: 'closed source',
    aboutH: 'About',
    about1: 'Most things under satloot revolve around two ideas: turning the parts of crypto trading where people lose money into tools (scanning, risk control, discipline, simulation), and a few experiments that are purely for fun (universes generated from block hashes, single-file games, CPU-friendly consensus).',
    about2: 'None of the sites collect personal data, and everything that can be open source is. Found a problem? Open an issue on the repo.',
    quickH: 'Quick links', allRepos: 'all source repos',
    metaDesc: (sites, n) => fit(`${sites.length} live sites and ${n} open-source repos by one person — trading tools, on-chain experiments, tiny games and utilities: `, sites, ', ', ' and more.'),
    ogAlt: 'satloot project index: live sites and open-source repos',
    tagline: S.taglineEn, taglineAlt: S.tagline,
  },
};

function page(L) {
  const en = L.code === 'en';
  // 取字段:英文页优先 *En,没有就回落中文
  const f = (o, k) => (en && o[k + 'En']) ? o[k + 'En'] : o[k];
  const repoTitle = r => (en && (M.repoTitlesEn || {})[r.name]) || (!en && M.repoTitles[r.name]) || (en ? r.name : M.repoTitles[r.name] || r.name);
  const repoDesc = r => (en && (M.repoDescEn || {})[r.name]) || (!en && (M.repoDesc || {})[r.name]) || r.description || L.noDesc;
  const siteTitle = s => en ? s.titleEn || s.title : s.title;
  const siteAlt = s => en ? s.title : s.titleEn;

  const siteCard = s => `
      <a class="card site" href="${esc(s.url)}" rel="noopener">
        <div class="top"><span class="host">${esc(s.host)}</span><span class="tag">${esc(f(s, 'tag'))}</span></div>
        <h3>${esc(siteTitle(s))}</h3>
        <div class="en">${esc(siteAlt(s))}</div>
        <p>${esc(f(s, 'desc'))}</p>
        <div class="foot"><span class="go">${L.open}</span>${(s.repos || []).map(n => byName[n] ? `<span class="mini">${L.src} ${esc(n)}</span>` : '').join('')}</div>
      </a>`;

  const repoCard = r => `
      <a class="card repo" href="${esc(r.url)}" rel="noopener">
        <div class="top"><span class="host">${esc(r.name)}</span>${r.stars ? `<span class="stars">★ ${r.stars}</span>` : ''}</div>
        <h3>${esc(repoTitle(r))}</h3>
        <p>${esc(repoDesc(r))}</p>
        <div class="foot">${r.language ? `<span class="lang"><i style="background:${LANG_COLOR[r.language] || '#8b93a7'}"></i>${esc(r.language)}</span>` : ''}<span class="meta">${L.updated} ${ymd(r.pushed)}</span>${r.homepage ? `<span class="mini">${esc(r.homepage.replace(/^https?:\/\//, ''))}</span>` : ''}</div>
      </a>`;

  const restRow = r => `
        <li><a href="${esc(r.url)}" rel="noopener">${esc(r.name)}</a>${r.language ? `<span class="lang"><i style="background:${LANG_COLOR[r.language] || '#8b93a7'}"></i>${esc(r.language)}</span>` : ''}<span class="d">${esc((en && (M.repoDescEn || {})[r.name]) || r.description || '')}</span><span class="meta">${ymd(r.pushed)}</span></li>`;

  const privRow = p => `
        <li>${p.site ? `<a href="${esc(p.site)}" rel="noopener">${esc(f(p, 'name'))}</a>` : `<b>${esc(f(p, 'name'))}</b>`}<span class="d">${esc(f(p, 'desc'))}</span><span class="meta">${p.site ? L.live : L.closed}</span></li>`;

  const url = `${ORIGIN}/${L.dir}`;
  const title = `${S.title} · ${L.titleSuffix}`;
  // 英文页 description 列域名（短），中文页列站点中文名
  const desc = L.metaDesc(M.sites.map(s => en ? s.host : siteTitle(s)), repos.length);
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${ORIGIN}/#org`, name: S.title, url: `${ORIGIN}/`, logo: { '@type': 'ImageObject', url: LOGO_512, width: 512, height: 512 }, sameAs: [`https://github.com/${S.github}`] },
      { '@type': 'WebSite', '@id': `${ORIGIN}/#website`, name: S.title, url: `${ORIGIN}/`, description: L.tagline, inLanguage: L.htmlLang, publisher: { '@id': `${ORIGIN}/#org` } },
      { '@type': 'CollectionPage', '@id': url, url, name: title, description: desc, inLanguage: L.htmlLang, isPartOf: { '@id': `${ORIGIN}/#website` }, about: { '@id': `${ORIGIN}/#org` }, primaryImageOfPage: { '@type': 'ImageObject', url: OG_IMAGE, width: 1200, height: 630 } },
    ],
  };

  return `<!doctype html>
<html lang="${L.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="zh-CN" href="${ORIGIN}/">
<link rel="alternate" hreflang="en" href="${ORIGIN}/en/">
<link rel="alternate" hreflang="x-default" href="${ORIGIN}/">
<link rel="icon" href="${FAVICON}">
<link rel="apple-touch-icon" href="/assets/logo-192.png">
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="${THEME}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(S.title)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(L.tagline)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(L.ogAlt)}">
<meta property="og:locale" content="${en ? 'en_US' : 'zh_CN'}">
<meta property="og:locale:alternate" content="${en ? 'zh_CN' : 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(L.tagline)}">
<meta name="twitter:image" content="${OG_IMAGE}">
<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>
<style>
/* 用户规矩(2026-09-08):所有站点浅色/白底,不做深色 */
:root{--bg:#f7f7fb;--card:#ffffff;--card2:#f1f2f7;--line:rgba(15,23,42,.10);--line2:rgba(15,23,42,.22);
  --text:#14161f;--muted:#5b6478;--dim:#8a91a3;--accent:#d9502c;--accent2:#b7791f;--r:16px}
*{box-sizing:border-box}
html{color-scheme:light;-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 ${FONT};
  background-image:radial-gradient(900px 420px at 10% -10%,rgba(255,122,89,.14),transparent 60%),radial-gradient(700px 380px at 95% 0%,rgba(255,209,102,.16),transparent 60%);background-repeat:no-repeat}
a{color:inherit;text-decoration:none}
.wrap{max-width:1180px;margin:0 auto;padding:0 20px}
header{display:flex;align-items:center;justify-content:space-between;padding:18px 0;gap:16px}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:18px;letter-spacing:.2px}
.brand img{width:28px;height:28px;display:block;border-radius:7px}
nav{display:flex;align-items:center;flex-wrap:wrap}
nav a{color:var(--muted);font-size:14px;margin-left:18px;padding:6px 0;border-bottom:1px solid transparent}
nav a:hover{color:var(--text);border-bottom-color:var(--line2)}
nav a.lang-switch{margin-left:18px;padding:4px 11px;border:1px solid var(--line);border-radius:999px;background:var(--card);font-weight:700;font-size:12.5px;color:var(--text)}
nav a.lang-switch:hover{border-color:var(--accent);color:var(--accent)}
.hero{padding:36px 0 22px}
.hero h1{margin:0 0 10px;font-size:clamp(30px,5vw,50px);line-height:1.12;letter-spacing:-.4px;font-weight:800}
.hero h1 em{font-style:normal;background:linear-gradient(90deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}
.hero p{margin:0;color:var(--muted);max-width:760px;font-size:16px}
.hero p.en{font-size:13.5px;color:var(--dim);margin-top:4px}
.pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
.pills span{font-size:12.5px;color:var(--muted);border:1px solid var(--line);background:#fff;border-radius:999px;padding:5px 11px}
.pills b{color:var(--accent2)}
h2{margin:40px 0 6px;font-size:22px;letter-spacing:-.2px}
h2 small{font-weight:500;color:var(--dim);font-size:13px;margin-left:10px}
.sub{margin:0 0 16px;color:var(--muted);font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px}
.card{display:flex;flex-direction:column;gap:6px;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:18px 20px;box-shadow:0 1px 2px rgba(15,23,42,.04),0 8px 24px -18px rgba(15,23,42,.18);transition:transform .18s,border-color .18s,box-shadow .18s}
.card:hover{transform:translateY(-3px);border-color:rgba(217,80,44,.45);box-shadow:0 18px 40px -22px rgba(217,80,44,.35)}
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
    <a class="brand" href="/${L.dir}"><img src="${FAVICON}" alt="">${esc(S.title)}</a>
    <nav><a href="#sites">${L.nav.sites}</a><a href="#repos">${L.nav.repos}</a><a href="#wip">${L.nav.wip}</a><a href="https://github.com/${esc(S.github)}" rel="noopener">${L.nav.github}</a><a class="lang-switch" href="${L.otherHref}" hreflang="${L.other === 'en' ? 'en' : 'zh-CN'}" lang="${L.other === 'en' ? 'en' : 'zh-CN'}">${L.otherLabel}</a></nav>
  </header>

  <section class="hero">
    <h1>${esc(S.title)} <em>${L.h1em}</em></h1>
    <p>${esc(L.tagline)}. ${L.heroLine}</p>
    <p class="en">${esc(L.taglineAlt)}</p>
    <div class="pills">${L.pills(M.sites.length, repos.length, M.private.length).map(t => `<span>${t}</span>`).join('')}</div>
  </section>

  <h2 id="sites">${L.sitesH}<small>${L.sitesSmall}</small></h2>
  <p class="sub">${L.sitesSub}</p>
  <div class="grid">${M.sites.map(siteCard).join('')}
  </div>

  <h2 id="repos">${L.reposH}<small>github.com/${esc(S.github)}</small></h2>
  <p class="sub">${L.reposSub}</p>
  <div class="grid">${featured.map(repoCard).join('')}
  </div>
  ${rest.length ? `
  <h2>${L.restH}<small>${L.restSmall(rest.length)}</small></h2>
  <p class="sub">${L.restSub}</p>
  <ul class="list">${rest.map(restRow).join('')}
  </ul>` : ''}

  <h2 id="wip">${L.wipH}<small>${L.wipSmall}</small></h2>
  <p class="sub">${L.wipSub}</p>
  <ul class="list">${M.private.map(privRow).join('')}
  </ul>

  <section class="about">
    <div>
      <h3>${L.aboutH}</h3>
      <p>${esc(L.about1)}</p>
      <p>${esc(L.about2)}</p>
    </div>
    <div>
      <h3>${L.quickH}</h3>
      <ul>${M.sites.map(s => `
        <li><a href="${esc(s.url)}" rel="noopener">${esc(s.host)}</a><span>${esc(siteTitle(s))}</span></li>`).join('')}
        <li><a href="https://github.com/${esc(S.github)}" rel="noopener">github.com/${esc(S.github)}</a><span>${L.allRepos}</span></li>
      </ul>
    </div>
  </section>

  <footer>
    <span>© ${new Date().getFullYear()} ${esc(S.title)} · ${esc(S.domain)}</span>
    <span><a href="${L.otherHref}">${L.otherLabel}</a> · <a href="https://github.com/${esc(S.github)}" rel="noopener">GitHub</a> · <a href="/projects.json">projects.json</a> · <a href="/sitemap.xml">sitemap</a></span>
  </footer>
</div>
</body>
</html>
`;
}

fs.mkdirSync(path.join(SITE, 'en'), { recursive: true });
const zh = page(LOCALES.zh);
const en = page(LOCALES.en);
fs.writeFileSync(path.join(SITE, 'index.html'), zh.replace(/\. 这一页/, '。这一页'));
fs.writeFileSync(path.join(SITE, 'en', 'index.html'), en);
fs.writeFileSync(path.join(SITE, 'projects.json'), JSON.stringify({ site: S, sites: M.sites, repos: [...featured, ...rest], private: M.private, generated: new Date().toISOString() }, null, 2));
fs.writeFileSync(path.join(SITE, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
// 静态资源（og.png / logo-*.png，由 tools/make-og.mjs 生成）+ manifest
fs.cpSync(path.join(ROOT, 'assets'), path.join(SITE, 'assets'), { recursive: true });
fs.writeFileSync(path.join(SITE, 'manifest.json'), JSON.stringify({
  name: S.title, short_name: S.title, description: S.taglineEn, lang: 'zh-CN', start_url: '/', scope: '/', display: 'browser',
  background_color: THEME, theme_color: THEME,
  icons: [{ src: '/assets/logo-192.png', sizes: '192x192', type: 'image/png' }, { src: '/assets/logo-512.png', sizes: '512x512', type: 'image/png' }],
}, null, 2) + '\n');
const today = new Date().toISOString().slice(0, 10);
const alt = `<xhtml:link rel="alternate" hreflang="zh-CN" href="${ORIGIN}/"/><xhtml:link rel="alternate" hreflang="en" href="${ORIGIN}/en/"/><xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/"/>`;
fs.writeFileSync(path.join(SITE, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n  <url><loc>${ORIGIN}/</loc>${alt}<lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>\n  <url><loc>${ORIGIN}/en/</loc>${alt}<lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>\n</urlset>\n`);
console.log(`built site/index.html (${(zh.length / 1024).toFixed(0)} KB) + site/en/index.html (${(en.length / 1024).toFixed(0)} KB): ${M.sites.length} 站点, ${featured.length} 精选仓库, ${rest.length} 其他仓库, ${M.private.length} 进行中`);
