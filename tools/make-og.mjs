// 生成社交分享图 assets/og.png（1200×630）与 JSON-LD / manifest 用的 logo PNG（assets/logo-512.png、logo-192.png）。
// 一次性工具，产物进仓库；build.mjs 只负责把 assets/ 拷进 site/。新增站点后想让图上的域名列表跟上，再跑一次即可。
// 用法：node tools/make-og.mjs
// 光栅化用 @resvg/resvg-js：本仓库没装的话借 bnbbang 那份（Windows 本机路径）。字体走系统字体（Segoe UI / Consolas）。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets');
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'projects.json'), 'utf8'));

let Resvg;
for (const p of ['@resvg/resvg-js', 'D:/CLAUDE/bnbbang/server/node_modules/@resvg/resvg-js']) {
  try { ({ Resvg } = require(p)); break; } catch {}
}
if (!Resvg) throw new Error('缺 @resvg/resvg-js：npm i @resvg/resvg-js 或保证 D:/CLAUDE/bnbbang/server/node_modules 在');

const render = (svg, width) => Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true, defaultFontFamily: 'Segoe UI' } }).render().asPng());
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- 站点强调色（与 build.mjs 里的 CSS 变量一致）----
const C = { bg: '#f7f7fb', ink: '#14161f', muted: '#5b6478', dim: '#8a91a3', line: 'rgba(15,23,42,.12)', accent: '#d9502c', accent2: '#b7791f', soft: '#fdeee8', softLine: '#f3c9b9' };
const SANS = "'Segoe UI','Segoe UI Variable Text','Microsoft YaHei UI',Arial,sans-serif";
const MONO = "Consolas,'Cascadia Mono','Courier New',monospace";

const hosts = M.sites.map((s) => s.host).slice(0, 10);
const Y0 = 186, ROW = 24, ySep = Y0 + hosts.length * ROW - 8, yFoot = ySep + 24, cardH = yFoot + 22 - 118;
const card = hosts.map((h, i) => `<text x="736" y="${Y0 + i * ROW}" font-family="${MONO}" font-size="16" fill="${i % 2 ? C.accent2 : C.ink}">${esc(h)}</text>`).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
  <radialGradient id="a" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ff7a59" stop-opacity=".22"/><stop offset="1" stop-color="#ff7a59" stop-opacity="0"/></radialGradient>
  <radialGradient id="b" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffd166" stop-opacity=".26"/><stop offset="1" stop-color="#ffd166" stop-opacity="0"/></radialGradient>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.accent}"/><stop offset="1" stop-color="${C.accent2}"/></linearGradient>
  <filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feGaussianBlur stdDeviation="14"/></filter>
</defs>
<rect width="1200" height="630" fill="${C.bg}"/>
<ellipse cx="140" cy="-20" rx="620" ry="330" fill="url(#a)"/>
<ellipse cx="1130" cy="60" rx="460" ry="300" fill="url(#b)"/>
<text x="96" y="82" font-family="${MONO}" font-size="18" letter-spacing="5" fill="${C.accent}">SATLOOT  ·  PROJECT INDEX</text>
<text x="92" y="196" font-family="${SANS}" font-weight="700" font-size="104" letter-spacing="-2" fill="url(#g)">satloot</text>
<text x="96" y="262" font-family="${SANS}" font-size="30" fill="${C.muted}">Trading tools, on-chain experiments,</text>
<text x="96" y="304" font-family="${SANS}" font-size="30" fill="${C.muted}">tiny games and utilities.</text>
<text x="96" y="346" font-family="${SANS}" font-size="30" fill="${C.muted}">Built by one person, all self-hosted.</text>
<rect x="96" y="392" width="392" height="46" rx="23" fill="${C.soft}" stroke="${C.softLine}"/>
<text x="292" y="422" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="20" fill="${C.accent}">satloot.com · every site &amp; repo</text>
<rect x="704" y="128" width="400" height="${cardH}" rx="22" fill="#0f172a" opacity=".16" filter="url(#sh)"/>
<rect x="700" y="118" width="400" height="${cardH}" rx="22" fill="#ffffff" stroke="${C.line}"/>
<text x="736" y="160" font-family="${SANS}" font-weight="700" font-size="20" fill="${C.ink}">Live sites</text>
<text x="1064" y="160" text-anchor="end" font-family="${MONO}" font-size="14" fill="${C.dim}">${hosts.length} online</text>
${card}
<line x1="736" y1="${ySep}" x2="1064" y2="${ySep}" stroke="${C.line}"/>
<text x="736" y="${yFoot}" font-family="${SANS}" font-weight="600" font-size="15" fill="${C.muted}">+ open-source repos · github.com/${esc(M.site.github)}</text>
<line x1="96" y1="546" x2="1104" y2="546" stroke="${C.line}"/>
<text x="600" y="586" text-anchor="middle" font-family="${MONO}" font-size="15" letter-spacing="4" fill="${C.dim}">SITES  →  REPOS  →  IN PROGRESS   ·   ALL SELF-BUILT AND SELF-HOSTED</text>
</svg>`;

// favicon 同款（与 build.mjs 里的 FAVICON 一致）
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b0e17"/><path d="M20 40c0 5 5 8 12 8s12-3 12-8c0-11-22-5-22-16 0-5 5-8 11-8s11 3 11 8" fill="none" stroke="#ff7a59" stroke-width="6" stroke-linecap="round"/></svg>`;

fs.mkdirSync(OUT, { recursive: true });
const og = render(svg, 1200);
fs.writeFileSync(path.join(OUT, 'og.png'), og);
for (const s of [512, 192]) fs.writeFileSync(path.join(OUT, `logo-${s}.png`), render(LOGO, s));
console.log(`assets/og.png ${(og.length / 1024).toFixed(0)} KB, logo-512.png, logo-192.png`);
