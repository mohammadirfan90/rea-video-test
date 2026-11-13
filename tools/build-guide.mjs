#!/usr/bin/env node
/**
 * Build the interactive artifact from assets/*.
 *
 *   assets/index.template.html  +  __CSS__ __JS__ __DATA__ tokens
 *   assets/data.json            (written by tools/extract-data.py)
 *
 * Output: artifact/index.html  (single file, self-contained)
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const ASSETS = resolve(ROOT, 'assets');
const OUT = resolve(ROOT, 'index.html');

const TOKEN = {
  CSS: '__CSS__',
  JS: '__JS__',
  DATA: '__DATA__',
};

async function read(p) {
  if (!existsSync(p)) throw new Error(`missing input: ${p}`);
  return readFile(p, 'utf8');
}

/** Guard: a token must appear exactly once in the template. */
function assertToken(html, token, name) {
  const parts = html.split(token);
  if (parts.length !== 2) {
    throw new Error(
      `template must contain ${token} exactly once (found ${parts.length - 1}) — ${name}`
    );
  }
  return parts;
}

async function build() {
  const [template, css, js, dataRaw] = await Promise.all([
    read(resolve(ASSETS, 'index.template.html')),
    read(resolve(ASSETS, 'guide.css')),
    read(resolve(ASSETS, 'guide.js')),
    read(resolve(ASSETS, 'data.json')),
  ]);

  // Data must be valid JSON and must not contain a raw "</script>".
  const data = JSON.parse(dataRaw);
  if (/<\/script/i.test(dataRaw)) {
    throw new Error('data.json contains a literal </script — would break the inline JSON island');
  }

  // Sanitise the JSON for embedding: escape < and & inside the script island.
  const dataSafe = dataRaw
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  // Resolve tokens against the template only. Checking the final output would
  // false-positive whenever an injected asset legitimately contains a token
  // string (e.g. this script's own TOKEN map).
  let html = template;
  html = assertToken(html, TOKEN.CSS, 'CSS').join(css);
  html = assertToken(html, TOKEN.JS, 'JS').join(js);
  html = assertToken(html, TOKEN.DATA, 'DATA').join(dataSafe);

  // Balance check on the most common tags we inject.
  const checks = [
    ['<style>', '</style>'],
    ['<script', '</script>'],
    ['<body>', '</body>'],
    ['<html', '</html>'],
  ];
  for (const [open, close] of checks) {
    const o = html.split(open).length - 1;
    const c = html.split(close).length - 1;
    if (o !== c) throw new Error(`unbalanced ${open}/${close}: ${o} vs ${c}`);
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, html, 'utf8');

  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log(`built ${OUT}`);
  console.log(`  shots: ${(data.shots || []).length}`);
  console.log(`  characters: ${((data.cast || {}).characters || []).length}`);
  console.log(`  scenes: ${((data.cast || {}).scenes || []).length}`);
  console.log(`  size: ${kb} KB`);
}

build().catch((err) => {
  console.error(`build failed: ${err.message}`);
  process.exit(1);
});
