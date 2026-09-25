/**
 * Builds the rank badges the app shows (ui/assets/ranks/<tier>-<division>.png,
 * master.png, apex-predator.png): the game's ranked badges, one per division
 * with its numeral, as apexlegendsstatus.com hosts them for their API's
 * `rankImg`. Downloaded once and bundled, so the dashboard never loads them
 * from their server. Use of game art: see DESIGN.md §10.
 *
 * Usage: node scripts/fetch-rank-badges.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE = 'https://api.mozambiquehe.re/assets/ranks';
const OUT_DIR = path.join(import.meta.dirname, '..', 'ui', 'assets', 'ranks');
const SIZE = 120;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36';

const DIVIDED = ['rookie', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];
/** [source file, output file]; Master and Predator have no divisions. */
const BADGES = [
  ...DIVIDED.flatMap((tier) => [1, 2, 3, 4].map((d) => [`${tier}${d}`, `${tier}-${d}`])),
  ['master', 'master'],
  ['apexpredator1', 'apex-predator'],
];

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  for (const [source, out] of BADGES) {
    const res = await fetch(`${SOURCE}/${source}.png`, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${res.status} ${source}`);
    const png = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    await fs.writeFile(path.join(OUT_DIR, `${out}.png`), png);
  }
  console.log(`${BADGES.length} badges → ${OUT_DIR}`);
}

await main();
