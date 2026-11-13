#!/usr/bin/env node
/**
 * Headless-Chrome verification for artifact/index.html.
 *
 * Checks:
 *   - the page loads with no console errors and no page errors
 *   - every section renders content (not empty)
 *   - the shot list contains all 58 rows
 *   - filters narrow the list, and reset restores it
 *   - the search box returns hits
 *   - the lightbox opens and closes
 *   - every referenced media file resolves on disk
 *   - no horizontal overflow at desktop and mobile widths
 *   - a full-page screenshot is written
 */
import { readFile, stat, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const PROJECT = resolve(ROOT, '..');
const PAGE = resolve(ROOT, 'index.html');
const MEDIA_DIR = resolve(PROJECT, 'out', 'trailer');
const SHOT_DIR = resolve(MEDIA_DIR, 'shots');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const results = [];
let failed = 0;

function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  if (!ok) failed++;
}

async function main() {
  if (!existsSync(PAGE)) throw new Error(`missing ${PAGE} — run npm run build first`);

  let chromePath = null;
  for (const c of CHROME_CANDIDATES) {
    if (existsSync(c)) { chromePath = c; break; }
  }
  if (!chromePath) throw new Error('no Chrome/Edge binary found; set CHROME_PATH');

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files',
           '--hide-scrollbars', '--force-device-scale-factor=1'],
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('requestfailed', (r) => {
    consoleErrors.push(`requestfailed: ${r.url()} (${r.failure()?.errorText})`);
  });

  await page.setViewport({ width: 1440, height: 950 });
  await page.goto('file:///' + PAGE.replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
  await new Promise((r) => setTimeout(r, 600));

  /* ---------------------------------------------------- console cleanliness */
  check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 4).join(' | '));

  /* --------------------------------------------------------- section render */
  const sections = ['hero-facts', 'mix-legend', 'verdict-stats', 'timeline-strip',
                    'shot-list', 'characters', 'scenes', 'props', 'audio-cards',
                    'music-segs', 'stickers', 'aspects', 'shoot-plan',
                    'open-questions'];
  for (const id of sections) {
    const n = await page.$eval(`#${id}`, (e) => e.children.length).catch(() => -1);
    check(`#${id} populated`, n > 0, `children=${n}`);
  }
  // The footer spans carry text, not child elements.
  for (const id of ['foot-source', 'foot-review']) {
    const t = await page.$eval(`#${id}`, (e) => e.textContent.trim()).catch(() => '');
    check(`#${id} populated`, t.length > 10, `"${t.slice(0, 60)}"`);
  }

  /* ------------------------------------------------------- duplicate ids */
  const dupIds = await page.evaluate(() => {
    const seen = {}, dups = [];
    document.querySelectorAll('[id]').forEach((e) => {
      const id = e.id;
      if (seen[id]) dups.push(id); else seen[id] = 1;
    });
    return [...new Set(dups)];
  });
  check('no duplicate element ids', dupIds.length === 0, dupIds.join(', '));

  /* ----------------------------------------------- timeline containment */
  const tl = await page.evaluate(() => {
    const strip = document.getElementById('timeline-strip');
    const seg = strip.querySelector('.timeline__seg');
    const sr = strip.getBoundingClientRect();
    const gr = seg.getBoundingClientRect();
    return {
      pos: getComputedStyle(strip).position,
      h: Math.round(sr.height),
      segH: Math.round(gr.height),
      contained: gr.top >= sr.top - 1 && gr.bottom <= sr.bottom + 1,
    };
  });
  check('timeline strip is a positioned 54px container',
        tl.pos === 'relative' && tl.h <= 60, `pos=${tl.pos} h=${tl.h}`);
  check('timeline segments stay inside the strip',
        tl.contained && tl.segH <= 60, `segH=${tl.segH} contained=${tl.contained}`);

  /* ------------------------------------------------------------- shot count */
  const shotRows = await page.$$eval('.shot', (els) => els.length);
  check('58 shot rows rendered', shotRows === 58, `got ${shotRows}`);

  const timelineSegs = await page.$$eval('.timeline__seg', (els) => els.length);
  check('timeline has 58 segments', timelineSegs === 58, `got ${timelineSegs}`);

  const navLinks = await page.$$eval('.nav__link', (els) => els.length);
  check('nav has 10 section links', navLinks === 10, `got ${navLinks}`);

  const resultText = await page.$eval('#result-count', (e) => e.textContent.trim());
  check('result counter shows all shots', /^58 of 58/.test(resultText), resultText);

  /* ---------------------------------------------------------------- filters */
  // Programmatic clicks: the rows sit far down the page and a synthetic
  // mouse click at the element's box can land on the sticky filter bar.
  await page.evaluate(() => document.querySelector('.chip[data-label="live_action"]').click());
  await new Promise((r) => setTimeout(r, 200));
  const filtered = await page.$$eval('.shot', (els) => els.length);
  check('label filter narrows the list', filtered > 0 && filtered < 58, `got ${filtered}`);

  await page.evaluate(() => document.getElementById('reset-filters').click());
  await new Promise((r) => setTimeout(r, 200));
  const restored = await page.$$eval('.shot', (els) => els.length);
  check('reset restores all 58', restored === 58, `got ${restored}`);

  const sceneOpts = await page.$$eval('#filter-scene option', (els) => els.length);
  check('scene filter populated', sceneOpts >= 10, `options=${sceneOpts}`);

  // scene dropdown narrows too
  const sceneNarrowed = await page.evaluate(() => {
    const sel = document.getElementById('filter-scene');
    const opt = [...sel.options].find((o) => o.value);
    if (!opt) return -1;
    sel.value = opt.value;
    sel.dispatchEvent(new Event('change'));
    return document.querySelectorAll('.shot').length;
  });
  check('scene filter narrows the list',
        sceneNarrowed > 0 && sceneNarrowed < 58, `got ${sceneNarrowed}`);
  await page.evaluate(() => document.getElementById('reset-filters').click());
  await new Promise((r) => setTimeout(r, 200));

  /* ----------------------------------------------------------------- search */
  await page.focus('#search');
  await page.type('#search', 'bamboo');
  await new Promise((r) => setTimeout(r, 350));
  const hits = await page.$$eval('.sr__item', (els) => els.length);
  const searchOpen = await page.$eval('#search-results', (e) => e.classList.contains('is-open'));
  check('search returns hits', hits > 0, `hits=${hits}`);
  check('search panel opens', searchOpen, `is-open=${searchOpen}`);
  await page.$eval('#search', (e) => { e.value = ''; });
  await page.keyboard.press('Escape');

  /* --------------------------------------------------------------- lightbox */
  await page.evaluate(() => document.querySelector('.shot .shot__chev').click());
  await new Promise((r) => setTimeout(r, 250));
  const detailOpen = await page.$eval('.shot', (e) => e.classList.contains('is-open'));
  check('shot detail expands', detailOpen, `is-open=${detailOpen}`);

  const detailImgs = await page.$$eval('.shot.is-open .detail__media img', (els) => els.length);
  check('detail shows contact-sheet + 3 frames', detailImgs >= 4, `imgs=${detailImgs}`);

  const detailText = await page.$eval('.shot.is-open .detail__body', (e) => e.textContent);
  check('detail shows evidence and prompts',
        /Evidence/i.test(detailText) && /Remake prompt/i.test(detailText),
        `len=${detailText.length}`);

  const lbOpen = await page.evaluate(() => {
    const img = document.querySelector('.shot.is-open .detail__media img');
    if (!img) return false;
    img.click();
    return document.getElementById('lightbox').classList.contains('is-open');
  });
  check('lightbox opens on image click', lbOpen, `is-open=${lbOpen}`);
  const lbSrc = await page.$eval('#lb-img', (e) => e.getAttribute('src'));
  check('lightbox shows an image', !!lbSrc && lbSrc.length > 4, lbSrc || '');
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 200));
  const lbClosed = await page.$eval('#lightbox', (e) => !e.classList.contains('is-open'));
  check('lightbox closes on Escape', lbClosed, `closed=${lbClosed}`);

  /* ------------------------------------------------------------ media files */
  const mediaRefs = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('img[src]').forEach((i) => {
      const s = i.getAttribute('src');
      if (s && !/^(data:|https?:)/.test(s)) out.push(s);
    });
    return [...new Set(out)];
  });
  let missing = [];
  for (const ref of mediaRefs) {
    const abs = resolve(dirname(PAGE), ref);
    if (!existsSync(abs)) missing.push(ref);
  }
  check(`all ${mediaRefs.length} media refs resolve on disk`, missing.length === 0,
        missing.slice(0, 5).join(', '));

  /* ----------------------------------------------------------- no overflow */
  for (const [w, label] of [[1440, 'desktop'], [390, 'mobile']]) {
    await page.setViewport({ width: w, height: 900 });
    await new Promise((r) => setTimeout(r, 400));
    const diag = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const over = document.documentElement.scrollWidth - docW;
      const bad = [];
      if (over > 1) {
        document.querySelectorAll('body *').forEach((e) => {
          const r = e.getBoundingClientRect();
          if (r.width > 0 && r.right > docW + 1) {
            // ignore nodes inside a scroll container (they scroll, not overflow)
            let p = e.parentElement, scrolls = false;
            while (p && p !== document.body) {
              const ov = getComputedStyle(p).overflowX;
              if (ov === 'auto' || ov === 'scroll' || ov === 'hidden') { scrolls = true; break; }
              p = p.parentElement;
            }
            if (!scrolls) {
              bad.push(`${e.tagName}.${String(e.className).split(' ')[0]}@${Math.round(r.right)}`);
            }
          }
        });
      }
      return { over, bad: [...new Set(bad)].slice(0, 6) };
    });
    check(`no horizontal overflow @${w} (${label})`, diag.over <= 1,
          diag.over <= 1 ? 'clean' : `overflow=${diag.over}px :: ${diag.bad.join(', ')}`);
  }

  /* --------------------------------------------------------------- a11y-ish */
  await page.setViewport({ width: 1440, height: 950 });
  const a11y = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')];
    const noAlt = imgs.filter((i) => i.getAttribute('alt') === null);
    const emptyAlt = imgs.filter((i) => i.getAttribute('alt') === '');
    const h1 = document.querySelectorAll('h1').length;
    const main = document.querySelectorAll('main').length;
    const skip = document.querySelectorAll('.skip').length;
    return { noAlt: noAlt.length, emptyAlt: emptyAlt.length, h1, main, skip, total: imgs.length };
  });
  check('every img has an alt attribute', a11y.noAlt === 0, `missing=${a11y.noAlt}/${a11y.total}`);
  check('no img has an empty alt', a11y.emptyAlt === 0, `empty=${a11y.emptyAlt}`);
  check('exactly one h1', a11y.h1 === 1, `h1=${a11y.h1}`);
  check('single main landmark', a11y.main === 1, `main=${a11y.main}`);
  check('skip link present', a11y.skip === 1, `skip=${a11y.skip}`);

  /* -------------------------------------------------------------- screenshot */
  await mkdir(resolve(ROOT, 'shots'), { recursive: true });
  const shotPath = resolve(ROOT, 'shots', 'artifact-full.png');
  await page.screenshot({ path: shotPath, fullPage: true });
  const st = await stat(shotPath);
  check('full-page screenshot written', st.size > 20000, `${(st.size / 1024).toFixed(0)} KB`);

  await page.setViewport({ width: 1440, height: 950 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: resolve(ROOT, 'shots', 'artifact-viewport.png') });

  // A second viewport shot at the shot explorer, where the table lives.
  await page.evaluate(() => {
    const t = document.getElementById('shots');
    if (t) t.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: resolve(ROOT, 'shots', 'artifact-shots.png') });

  // Section shots, so each block can be eyeballed without opening the file.
  for (const id of ['verdict', 'cast', 'sound', 'packaging', 'craft', 'remake', 'confidence']) {
    await page.evaluate((sid) => {
      const t = document.getElementById(sid);
      if (t) t.scrollIntoView({ behavior: 'instant', block: 'start' });
    }, id);
    await new Promise((r) => setTimeout(r, 350));
    await page.screenshot({ path: resolve(ROOT, 'shots', `section-${id}.png`) });
  }

  // Mobile view of the shot table.
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(() => {
    const t = document.getElementById('shots');
    if (t) t.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: resolve(ROOT, 'shots', 'artifact-mobile.png') });

  await browser.close();

  /* --------------------------------------------------------------- report */
  console.log('\n  artifact verification\n  ' + '─'.repeat(58));
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  (' + r.detail + ')' : ''}`);
  }
  console.log('  ' + '─'.repeat(58));
  console.log(`  ${results.length - failed}/${results.length} checks passed\n`);
  console.log(`  screenshot: ${shotPath}\n`);

  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(`verify failed: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
