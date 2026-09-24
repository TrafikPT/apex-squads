/**
 * Builds the legend portraits the app shows (ui/assets/legends/<slug>.jpg).
 *
 * 1. Preferred: the game's square legend portraits ("Portrait <Legend> square"),
 *    via the Apex Legends community wiki. Use cleared with Overwolf on Discord
 *    (2026-09-24, see DESIGN.md §10).
 * 2. Fallback for legends the wiki doesn't have yet (e.g. brand-new releases): a
 *    head-and-shoulders crop of EA's official transparent "hero" art from
 *    ea.com, located from the alpha channel.
 * 3. Last resort: EA's "grid tile" art, centre-cropped.
 *
 * The list of legends comes from ea.com's characters pages, so new legends are
 * picked up automatically. Rerun after a legend release.
 *
 * Usage: node scripts/fetch-legend-portraits.mjs [--sheet out.png]
 */
import fs from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
import sharp from 'sharp';

const HUB = 'https://www.ea.com/games/apex-legends/apex-legends/characters-hub';
const CLASS_HUBS = ['', '/assault-hub', '/skirmisher-hub', '/recon-hub', '/support-hub', '/controller-hub'];
const OUT_DIR = path.join(import.meta.dirname, '..', 'ui', 'assets', 'legends');
const SIZE = 128;
const SOURCE_WIDTH = 2400;
const WIKI_API = 'https://apexlegends.fandom.com/api.php';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36';

/**
 * Head detection: the head is the first row (from the top) whose widest opaque
 * run is at least this fraction of the image width. Thin things above it
 * (antennas, gun barrels) are narrower and get skipped.
 */
const HEAD_MIN_RUN = 0.05;
/** Crop square side, as a fraction of image height, and how far above the head top it starts. */
const CROP = { side: 0.34, above: 0.03 };
/**
 * Legends where a prop above the head fools the detection (drones, whips,
 * raised arms, big guns): explicit crop centre in units of image height, and
 * zoom (>1 = wider).
 */
const OVERRIDES = {
  alter: { cx: 0.83, cy: 0.33 },
  crypto: { cx: 0.74, cy: 0.34 },
  lifeline: { cx: 0.86, cy: 0.54 },
  pathfinder: { cx: 0.92, cy: 0.38, zoom: 1.1 },
  rampart: { cx: 0.69, cy: 0.3 },
};

const slugOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const squash = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const displayName = (slug) => slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function fetchImage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Wiki image URLs for "Portrait_<Name>_square.png", keyed by file name. */
async function wikiPortraits() {
  const byFile = new Map();
  let cont = '';
  do {
    const url = `${WIKI_API}?action=query&list=allimages&aiprefix=Portrait_&aiprop=url&ailimit=500&format=json${cont}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const json = await res.json();
    for (const img of json.query.allimages) byFile.set(img.name, img.url);
    cont = json.continue?.aicontinue ? `&aicontinue=${encodeURIComponent(json.continue.aicontinue)}` : '';
  } while (cont);
  return byFile;
}

/** The wiki's image host requires the wiki as referrer, and fetch() won't send a Referer header. */
function getWithReferer(url, referer) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA, Referer: referer } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(getWithReferer(new URL(res.headers.location, url).href, referer));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(String(res.statusCode)));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

const BACKGROUND = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    <defs><radialGradient id="g" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="#4a4d57"/><stop offset="1" stop-color="#16171b"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/></svg>`);

/** Transparent portrait → square JPEG on the app's dark background. */
async function onBackground(transparentSquare) {
  const face = await sharp(transparentSquare).resize(SIZE, SIZE).png().toBuffer();
  return sharp(BACKGROUND).composite([{ input: face }]).jpeg({ quality: 88 }).toBuffer();
}

async function listLegends() {
  const slugs = new Set();
  const tiles = new Map();
  for (const hub of CLASS_HUBS) {
    const html = await fetchText(HUB + hub);
    for (const [, s] of html.matchAll(/characters-hub\/([a-z0-9-]+)/g)) if (!s.endsWith('-hub')) slugs.add(s);
    for (const [url, file] of html.matchAll(/https:\/\/drop-assets\.ea\.com\/images\/[^"'\s\\?]+apex-grid-tile-legends-([A-Za-z]+)\.jpg/g)) {
      tiles.set(squash(file), url);
    }
  }
  return { slugs: [...slugs].sort(), tiles };
}

/** The legend's own transparent hero art on its page, if any. */
async function findHeroArt(slug) {
  const html = await fetchText(`${HUB}/${slug}`);
  for (const [url, name] of html.matchAll(/https:\/\/drop-assets\.ea\.com\/images\/[^"'\s\\?]+\/Apex-Legends_([A-Za-z-]+?)-16x9[^"'\s\\?/]*\.png/g)) {
    if (squash(name) === squash(slug)) return url;
  }
  return null;
}

/** Head top (y) and centre (x) from the alpha channel. */
async function findHead(img, width, height) {
  const { data } = await img.clone().ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  const minRun = Math.round(width * HEAD_MIN_RUN);
  const widestRun = (y) => {
    let best = { len: 0, mid: 0 };
    let start = -1;
    for (let x = 0; x <= width; x++) {
      const opaque = x < width && data[y * width + x] > 128;
      if (opaque && start < 0) start = x;
      if (!opaque && start >= 0) {
        if (x - start > best.len) best = { len: x - start, mid: (start + x) / 2 };
        start = -1;
      }
    }
    return best;
  };
  for (let y = 0; y < height; y++) {
    if (widestRun(y).len < minRun) continue;
    // Centre = average midpoint of the widest run over the next few percent of height.
    const mids = [];
    for (let yy = y; yy < Math.min(height, y + Math.round(height * 0.08)); yy += 4) mids.push(widestRun(yy).mid);
    return { top: y, cx: mids.reduce((s, m) => s + m, 0) / mids.length };
  }
  throw new Error('no head found');
}

async function headshot(buf, slug) {
  const img = sharp(buf);
  const { width, height } = await img.metadata();
  const o = OVERRIDES[slug];
  const side = Math.round(height * CROP.side * (o?.zoom ?? 1));
  let left;
  let top;
  if (o) {
    left = Math.round(o.cx * height - side / 2);
    top = Math.round(o.cy * height - side / 2);
  } else {
    const head = await findHead(img, width, height);
    left = Math.round(head.cx - side / 2);
    top = Math.round(head.top - height * CROP.above);
  }
  // Extend with transparency where the crop runs past the image edge.
  const pad = { top: Math.max(0, -top), left: Math.max(0, -left), bottom: Math.max(0, top + side - height), right: Math.max(0, left + side - width) };
  const cut = await sharp(await img.extend({ ...pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer())
    .extract({ left: left + pad.left, top: top + pad.top, width: side, height: side })
    .png()
    .toBuffer();
  return onBackground(cut);
}

async function tileCrop(buf) {
  const img = sharp(buf);
  const { width, height } = await img.metadata();
  const side = Math.round(width * 0.46);
  return img.extract({ left: Math.round((width - side) / 2), top: Math.round(height * 0.33 - side / 2), width: side, height: side })
    .resize(SIZE, SIZE).jpeg({ quality: 85 }).toBuffer();
}

/** Best available portrait for a legend, in order of preference (see header). */
async function portraitFor(slug, wiki, tiles) {
  const wikiUrl = wiki.get(`Portrait_${displayName(slug).replace(/ /g, '_')}_square.png`);
  if (wikiUrl) {
    return { out: await onBackground(await getWithReferer(wikiUrl, 'https://apexlegends.fandom.com/')), source: 'game portrait' };
  }
  const hero = await findHeroArt(slug);
  if (hero) {
    return { out: await headshot(await fetchImage(`${hero}?im=Resize=(${SOURCE_WIDTH})`), slug), source: 'EA hero art (fallback)' };
  }
  if (tiles.has(squash(slug))) {
    return { out: await tileCrop(await fetchImage(tiles.get(squash(slug)))), source: 'EA grid tile (fallback)' };
  }
  return null;
}

async function main() {
  const sheetArg = process.argv.indexOf('--sheet');
  const { slugs, tiles } = await listLegends();
  const wiki = await wikiPortraits();
  if (!slugs.length) throw new Error('No legends found: EA page layout may have changed.');
  await fs.mkdir(OUT_DIR, { recursive: true });

  const index = {};
  const results = [];
  for (const slug of slugs) {
    const found = await portraitFor(slug, wiki, tiles);
    if (!found) {
      console.warn(`${slug}: no art found, skipped`);
      continue;
    }
    const { out, source } = found;
    const fileName = `${slugOf(slug)}.jpg`;
    await fs.writeFile(path.join(OUT_DIR, fileName), out);
    index[displayName(slug)] = fileName;
    results.push(out);
    console.log(`${slug.padEnd(12)} ${source}`);
  }
  await fs.writeFile(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`${results.length} portraits → ${OUT_DIR}`);

  if (sheetArg > 0) {
    const cols = 7;
    const rows = Math.ceil(results.length / cols);
    await sharp({ create: { width: cols * (SIZE + 4), height: rows * (SIZE + 4), channels: 3, background: '#111' } })
      .composite(results.map((input, i) => ({ input, left: (i % cols) * (SIZE + 4), top: Math.floor(i / cols) * (SIZE + 4) })))
      .png().toFile(process.argv[sheetArg + 1]);
  }
}

await main();
