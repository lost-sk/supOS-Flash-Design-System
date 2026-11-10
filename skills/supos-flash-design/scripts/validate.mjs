#!/usr/bin/env node
/* supOS Flash Design · 产物验收
 * node scripts/validate.mjs --target <dir>
 * 纯只读；有 error 时退出码 1。
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const a = process.argv.slice(2);
const ti = a.indexOf('--target');
const TARGET = resolve(ti >= 0 ? a[ti + 1] : './flash-prototype');
const errors = [], warnings = [], info = {};
const ok = (cond, msg) => { if (!cond) errors.push(msg); };
const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };
const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
};
const rel = (p) => relative(TARGET, p).split(sep).join('/');
const skip = (u) => !u || /^(https?:|mailto:|javascript:|data:|#|\?|about:|tel:)/i.test(u) || u.startsWith('//');
const resolveRef = (from, ref) => resolve(dirname(from), decodeURIComponent(ref.split('#')[0].split('?')[0]));

if (!existsSync(join(TARGET, 'prototype.config.json'))) {
  console.log(JSON.stringify({ ok: false, errors: ['缺少 prototype.config.json：这不是生成器产物目录'], warnings, info }, null, 2));
  process.exit(1);
}

/* 1. 注册表解析与页面一致性 */
const dataSrc = readFileSync(join(TARGET, 'assets/data.js'), 'utf8');
const F = {};
try { (new Function('window', dataSrc))(F); } catch (e) { errors.push(`assets/data.js 无法解析：${e.message}`); }
const reg = F.FLASH || {};
const pages = reg.pages || [];
const onDisk = readdirSync(TARGET).filter((f) => f.endsWith('.html'));
info.registeredPages = pages.length;
info.onDiskPages = onDisk.length;
for (const p of pages) ok(existsSync(join(TARGET, p.file)), `注册表页面缺失：${p.file}`);
for (const f of onDisk) if (!pages.some((p) => p.file === f)) warnings.push(`页面未登记：${f}`);
ok(Array.isArray(reg.modes) && reg.modes.length >= 3, 'modes 形态清单缺失');
for (const m of reg.modes || []) ok(existsSync(join(TARGET, m.file)), `形态 ${m.id} 指向不存在的页面：${m.file}`);
for (const [k, app] of Object.entries(reg.apps || {})) {
  ok(existsSync(join(TARGET, app.src)), `app ${k} 入口不存在：${app.src}`);
  ok(Array.isArray(app.children) && app.children.length > 0, `app ${k} 缺少菜单 children`);
  ok(app.route && app.route.param, `app ${k} 缺少 route.param`);
}
info.apps = Object.keys(reg.apps || {}).length;

/* 2. 页面结构 */
for (const f of onDisk) {
  const p = join(TARGET, f), html = readFileSync(p, 'utf8');
  ok(/<body[^>]*data-mode="/.test(html), `${f} 缺少 data-mode`);
  ok(/<body[^>]*data-nav="/.test(html), `${f} 缺少 data-nav`);
  ok(/assets\/data\.js/.test(html) && /assets\/shell\.js/.test(html), `${f} 未引用共享 data/shell`);
  ok(!/Supos@|glpat-|APPKEY|AppKey\s*[:=]\s*['"][A-Za-z0-9]{12}/i.test(html), `${f} 疑似含明文凭据`);
  const pw = [...html.matchAll(/<input[^>]*type="password"[^>]*value="([^"]*)"/g)];
  for (const m of pw) ok(!m[1], `${f} 密码框含非占位值`);
}

/* 3. 链接与资源（含 apps 与 CSS @import） */
let checkedRefs = 0;
for (const p of walk(TARGET).filter((x) => x.endsWith('.html') || x.endsWith('.css'))) {
  const txt = readFileSync(p, 'utf8');
  const refs = [...txt.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1])
    .concat([...txt.matchAll(/@import\s+url\("([^"]+)"\)/g)].map((m) => m[1]));
  for (const ref of refs) {
    if (skip(ref)) continue;
    if (p.endsWith('.html') && relative(TARGET, p).includes('apps') &&
        !/\.(css|js|mjs|json|png|jpe?g|svg|ico|webp|woff2?)($|[?#])/i.test(ref)) continue;
    checkedRefs++;
    ok(isFile(resolveRef(p, ref)), `断链 ${rel(p)} → ${ref}`);
    const full = resolveRef(p, ref);
    ok(full.startsWith(TARGET), `引用越出产物目录 ${rel(p)} → ${ref}`);
  }
}
info.checkedRefs = checkedRefs;

/* 4. token 内容与源一致 */
const srcTokens = ['flash-product.css', 'flash-desktop.css']
  .map((f) => readFileSync(join(SKILL, 'assets/tokens', f), 'utf8')).join('\n\n');
const outTokens = readFileSync(join(TARGET, 'assets/tokens.css'), 'utf8');
ok(outTokens.includes(srcTokens.trim()), 'assets/tokens.css 与 skill 内 token 源不一致，请重跑生成器');
ok(!/#1448ED/i.test(outTokens.replace(/\/\*[\s\S]*?\*\//g, '')), 'token 声明中仍使用已作废的 #1448ED');

/* 5. 包外路径 / 敏感信息 */
const textExts = new Set(['.html', '.css', '.js', '.mjs', '.json', '.md']);
const allText = walk(TARGET).filter((p) => textExts.has(p.slice(p.lastIndexOf('.'))));
const banned = [
  [/\/os\/toolkit\/trial-journey\//, '遗留部署绝对路径'],
  [/flash01\.devcloud\.supos\.net/i, '内部环境域名'],
  [/gitlab[-_]supos|git[-_]scm2|Blue(?:tron)Academy/i, '内部仓库路径'],
  [/\bsha[o]kun\b/i, '真实账号 / 内部用户名'],
  [/\b(?:10|172|192\.168)\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d{2,5})?\b/, '内网 IP / 连接串'],
  [/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{2,5}\b/, '疑似真实数据库连接串'],
];
let hits = 0;
for (const p of allText) {
  const t = readFileSync(p, 'utf8');
  for (const [re, label] of banned) {
    if (re.test(t)) { hits++; errors.push(`${label}：${rel(p)}`); }
  }
  if (t.includes('../..')) { hits++; errors.push(`包外相对路径：${rel(p)}`); }
}
info.sensitiveHits = hits;
info.scannedFiles = allText.length;
info.totalFiles = walk(TARGET).length;

/* 6. 输出 */
const result = { ok: errors.length === 0, errors, warnings, info };
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
