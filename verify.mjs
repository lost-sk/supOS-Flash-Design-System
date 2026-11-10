#!/usr/bin/env node
/* supOS Flash 产品原型验证
 * node verify.mjs
 * 检查：注册表 ↔ 磁盘 · 链接与资源 · token 变量 · 遗留绝对路径 · 凭据 · 分支状态
 * 退出码：有 error 时为 1。不写任何文件，纯只读。
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)));
const PROTO = join(REPO, 'prototype');
const errors = [];
const warnings = [];
const info = {};
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

/* ── 1. 注册表 ↔ 磁盘 ── */
const dataSrc = readFileSync(join(PROTO, 'assets/data.js'), 'utf8');
const registered = [...dataSrc.matchAll(/P\('([^']+\.html)'/g)].map((m) => m[1]);
const onDisk = readdirSync(PROTO).filter((f) => f.endsWith('.html'));
info.registeredPages = registered.length;
info.onDiskPages = onDisk.length;
for (const f of registered) ok(existsSync(join(PROTO, f)), `注册表页面缺失：${f}`);
for (const f of onDisk) {
  if (!registered.includes(f)) warnings.push(`页面未登记进 data.js：${f}`);
}

/* ── 2. 页面结构 ── */
for (const f of onDisk) {
  const html = readFileSync(join(PROTO, f), 'utf8');
  ok(/<body[^>]*data-mode="/.test(html), `${f} 缺少 data-mode`);
  ok(/assets\/data\.js/.test(html) && /assets\/shell\.js/.test(html), `${f} 未引用共享 data/shell`);
  ok(!/Supos@|glpat-|APPKEY|AppKey\s*[:=]\s*['"][A-Za-z0-9]{12}/i.test(html), `${f} 疑似含明文凭据`);
  const pw = [...html.matchAll(/<input[^>]*type="password"[^>]*value="([^"]*)"/g)];
  for (const m of pw) {
    ok(/demo|placeholder|example|^\s*$/i.test(m[1]), `${f} 密码框含非占位值`);
  }
}

/* ── 3. 链接与资源 ── */
const skip = (u) => !u || /^(https?:|mailto:|javascript:|data:|#|\?|tel:)/i.test(u) || u.startsWith('//');
const resolveRef = (from, ref) => resolve(dirname(from), decodeURIComponent(ref.split('#')[0].split('?')[0]));
const rootPages = onDisk.map((f) => join(PROTO, f));
const appPages = walk(join(PROTO, 'apps')).filter((p) => p.endsWith('.html'));
let checkedRefs = 0;

for (const p of rootPages) {
  const html = readFileSync(p, 'utf8');
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const ref = m[1];
    if (skip(ref)) continue;
    checkedRefs++;
    ok(isFile(resolveRef(p, ref)), `断链 ${relative(REPO, p)} → ${ref}`);
  }
}
for (const p of appPages) {
  const html = readFileSync(p, 'utf8');
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const ref = m[1];
    if (skip(ref) || !/\.(css|js|mjs|json|png|jpe?g|svg|ico|webp|woff2?)($|[?#])/i.test(ref)) continue;
    checkedRefs++;
    ok(isFile(resolveRef(p, ref)), `app 资源缺失 ${relative(REPO, p)} → ${ref}`);
  }
}
info.checkedRefs = checkedRefs;

/* ── 4. CSS @import 与 token ── */
const cssFiles = walk(join(PROTO, 'assets')).filter((p) => p.endsWith('.css'));
for (const p of cssFiles) {
  const css = readFileSync(p, 'utf8');
  for (const m of css.matchAll(/@import\s+url\("([^"]+)"\)/g)) {
    checkedRefs++;
    ok(isFile(resolveRef(p, m[1])), `CSS @import 缺失 ${relative(REPO, p)} → ${m[1]}`);
  }
}
const productTokens = readFileSync(join(REPO, 'tokens/flash-product.css'), 'utf8');
const desktopTokens = readFileSync(join(REPO, 'tokens/flash-desktop.css'), 'utf8');
const syncedTokens = readFileSync(join(PROTO, 'assets/tokens.css'), 'utf8');
ok(syncedTokens.includes('--flash-primary') && syncedTokens.includes('--desk-journey-primary'),
  'prototype/assets/tokens.css 未与仓库根 tokens/ 同步，请重跑 build-pages.mjs');
for (const v of ['--flash-primary', '--flash-primary-hover', '--flash-text', '--flash-border',
  '--flash-font-size', '--flash-line-height', '--flash-radius', '--flash-header-height',
  '--flash-sider-width', '--flash-legacy-component', '--flash-legacy-button']) {
  ok(productTokens.includes(v), `flash-product.css 缺少 ${v}`);
}
for (const v of ['--desk-journey-primary', '--desk-bg-gradient', '--desk-shell-primary']) {
  ok(desktopTokens.includes(v), `flash-desktop.css 缺少 ${v}`);
}
/* 只检查机器可读的 CSS 声明；注释与规范文档里说明「已作废」是允许的 */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
ok(!/#1448ED/i.test(stripComments(productTokens + desktopTokens)),
  'token 声明中仍使用已作废的 #1448ED');

/* ── 5. 遗留部署绝对路径 / 凭据 ── */
const textExts = new Set(['.html', '.css', '.js', '.mjs', '.json', '.md']);
const allText = walk(PROTO).filter((p) => textExts.has(p.slice(p.lastIndexOf('.'))));
let legacyHits = 0;
for (const p of allText) {
  const t = readFileSync(p, 'utf8');
  if (t.includes('/os/toolkit/trial-journey/')) { legacyHits++; errors.push(`遗留绝对路径：${relative(REPO, p)}`); }
}
info.legacyAbsolutePaths = legacyHits;
info.copiedAppFiles = walk(join(PROTO, 'apps')).length;

/* ── 6. 分支与提交状态（只报告） ── */
try {
  info.branch = execSync('git branch --show-current', { cwd: REPO }).toString().trim();
  const st = execSync('git status --porcelain', { cwd: REPO }).toString().trim();
  info.hasUncommittedChanges = st.length > 0;
  info.committed = false;
  if (info.branch !== 'develop') warnings.push(`当前分支是 ${info.branch}，约定应改在 develop`);
} catch (e) {
  warnings.push(`git 状态读取失败：${e.message}`);
}

/* ── 输出 ── */
const result = { ok: errors.length === 0, errors, warnings, info };
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
