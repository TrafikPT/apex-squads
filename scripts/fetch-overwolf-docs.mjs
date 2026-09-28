// Downloads the ow-electron docs as plain text, to refresh docs/overwolf/.
//   node scripts/fetch-overwolf-docs.mjs <out dir>
// Keeps what docs/overwolf/README.md covers: all of ow-electron except other games'
// GEP pages (Apex only), the video recorder's API details and the console stats APIs.
// Writes one <path with / as __>.md per page; the out dir should be outside the repo.
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2];
if (!out) {
  console.error('usage: node scripts/fetch-overwolf-docs.mjs <out dir>');
  process.exit(1);
}
const BASE = 'https://dev.overwolf.com/ow-electron/';
const SKIP = [
  /\/live-game-data-gep\/supported-games\/(?!apex-legends)/,
  /\/recorder\/(interfaces|type-aliases|classes)\//,
  /\/dev-console-apis\/(?!overview)/,
];

const sitemap = await (await fetch('https://dev.overwolf.com/sitemap.xml')).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1])
  .filter((u) => u.startsWith(BASE) && !SKIP.some((re) => re.test(u)));
fs.mkdirSync(out, { recursive: true });

let failed = 0;
for (let i = 0; i < urls.length; i += 8) {
  await Promise.all(urls.slice(i, i + 8).map(async (url) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const name = url.slice(BASE.length).replace(/\/$/, '').replace(/\//g, '__');
      fs.writeFileSync(path.join(out, `${name}.md`), `Source: ${url}\n\n${toText(await res.text())}`);
    } catch (err) {
      failed++;
      console.error(`${url}: ${err}`);
    }
  }));
}
console.log(`${urls.length - failed} of ${urls.length} pages written to ${out}`);

/** The page's <article> as Markdown-ish text: headings, lists, code, tables, links. */
function toText(html) {
  let s = /<article[^>]*>([\s\S]*?)<\/article>/.exec(html)?.[1] ?? html;
  s = s
    .replace(/<(script|style|svg|button|nav)[\s\S]*?<\/\1>/gi, '')
    .replace(/<a [^>]*class="hash-link"[\s\S]*?<\/a>/gi, '')
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, code) => '\n```\n' + code
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(div|span)>\s*(?=<(div|span)[^>]*class="token-line)/gi, '\n')
      .replace(/<[^>]+>/g, '') + '\n```\n')
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n\n${'#'.repeat(+n)} ${t.replace(/<[^>]+>/g, '').trim()}\n\n`)
    .replace(/<li[^>]*>/gi, '\n- ').replace(/<\/li>/gi, '')
    .replace(/<tr[^>]*>/gi, '\n|').replace(/<\/t[dh]>/gi, ' |').replace(/<t[dh][^>]*>/gi, ' ')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => '`' + c.replace(/<[^>]+>/g, '') + '`')
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => {
      const text = t.replace(/<[^>]+>/g, '').trim();
      return text ? `[${text}](${href.startsWith('/') ? `https://dev.overwolf.com${href}` : href})` : '';
    })
    .replace(/<(p|div|br|ul|ol|table|blockquote|section)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return s
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'").replace(/&#x2F;/g, '/').replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
