#!/usr/bin/env node
// Pre-publish check for dist/index.html. Usage: node scripts/check-dist.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDist, checkHtml, checkSource, DIST_FILES } from './check-dist-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function* sourceFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* sourceFiles(p);
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name)) yield p;
  }
}

let html;
try {
  html = readFileSync(join(root, 'dist', 'index.html'), 'utf8');
} catch {
  console.error('FAIL dist/index.html not found: run npm run build first');
  process.exit(1);
}

// The built bundle always contains the string (React itself names the prop), so the
// dangerouslySetInnerHTML ban is enforced on app source instead.
const problems = checkHtml(html);
const files = {};
for (const name of DIST_FILES) {
  try {
    files[name] = readFileSync(join(root, 'dist', name), 'utf8');
  } catch {
    files[name] = null;
  }
}
problems.push(...checkDist(files));
for (const f of sourceFiles(join(root, 'src'))) problems.push(...checkSource(readFileSync(f, 'utf8'), f.slice(root.length + 1)));

if (problems.length > 0) {
  for (const p of problems) console.error('FAIL ' + p);
  process.exit(1);
}
console.log('OK ' + Buffer.byteLength(html, 'utf8') + ' (publish: ' + DIST_FILES.join(', ') + ')');
