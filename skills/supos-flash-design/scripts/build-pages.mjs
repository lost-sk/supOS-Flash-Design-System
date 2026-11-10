#!/usr/bin/env node
/* 只重生成页面：node scripts/build-pages.mjs --out <dir>
 * 读取 <dir>/prototype.config.json，不重新复制资产、不改动应用文件。 */
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './new-prototype.mjs';

const a = process.argv.slice(2);
const i = a.indexOf('--out');
const out = resolve(i >= 0 ? a[i + 1] : './flash-prototype');
const config = JSON.parse(readFileSync(join(out, 'prototype.config.json'), 'utf8'));
const r = await generate(config, out, { rebuild: true, configDir: out });
console.log(`重生成 ${r.pageCount} 个页面 → ${r.out}`);
