// Turns DiscordChatExporter JSON exports into compact text, to refresh the Discord
// findings in docs/overwolf/ (see its README, "Sources").
//   node scripts/discord-to-text.mjs <json dir> <out dir>
// One .txt per channel with its threads, one per forum with its posts. Overwolf staff
// are tagged [OW-STAFF name]; everyone else becomes a per-channel alias (u1, u2...),
// so the text can be read without other people's names. Both dirs should be outside
// the repo: the exports hold other people's names and messages.
import fs from 'node:fs';
import path from 'node:path';

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error('usage: node scripts/discord-to-text.mjs <json dir> <out dir>');
  process.exit(1);
}
const STAFF = new Set(['Overwolf Team', 'Admin']);

const docs = [];
for (const file of fs.readdirSync(src).filter((f) => f.endsWith('.json'))) {
  try {
    docs.push(JSON.parse(fs.readFileSync(path.join(src, file), 'utf8')));
  } catch {
    console.error(`skipped (still being written?): ${file}`);
  }
}
const isThread = (d) => d.channel.type.includes('Thread');
const firstAt = (d) => d.messages[0]?.timestamp ?? '';
const parents = new Map(docs.filter((d) => !isThread(d)).map((d) => [d.channel.id, d]));
const threads = new Map();
for (const d of docs.filter(isThread)) {
  const list = threads.get(d.channel.categoryId) ?? [];
  list.push(d);
  threads.set(d.channel.categoryId, list);
}

function render(d, aliases, lines) {
  const num = new Map();
  for (const m of d.messages) {
    const a = m.author;
    const roles = new Set((a.roles ?? []).map((r) => r.name));
    let who;
    if ([...roles].some((r) => STAFF.has(r))) {
      who = `[OW-STAFF ${a.nickname || a.name}]`;
    } else {
      if (!aliases.has(a.id)) aliases.set(a.id, `u${aliases.size + 1}`);
      who = aliases.get(a.id) + (roles.has('Community Champion') ? '[champion]' : '');
    }
    num.set(m.id, num.size + 1);
    const ref = m.reference?.messageId;
    const re = num.has(ref) ? ` (re #${num.get(ref)})` : '';
    let text = m.content.trim();
    for (const e of m.embeds ?? []) {
      const bits = [e.title, e.description].filter(Boolean);
      if (bits.length) text += `\n  [embed] ${bits.join(' — ').slice(0, 600)}`;
    }
    for (const att of m.attachments ?? []) text += `\n  [attachment ${att.fileName}]`;
    if (text) lines.push(`#${num.get(m.id)} ${m.timestamp.slice(0, 16).replace('T', ' ')} ${who}${re}: ${text}`);
  }
}

function write(name, lines) {
  const file = `${name.replace(/[^\w-]+/gu, '').replace(/^-+|-+$/g, '')}.txt`;
  fs.writeFileSync(path.join(out, file), lines.join('\n') + '\n');
  console.log(`${file}: ${lines.length} lines`);
}

fs.mkdirSync(out, { recursive: true });
for (const [id, d] of parents) {
  const aliases = new Map();
  const where = [d.channel.category, d.channel.name].filter(Boolean).join(' / ');
  const lines = [`CHANNEL ${where} — ${d.messages.length} messages`];
  render(d, aliases, lines);
  for (const t of (threads.get(id) ?? []).sort((a, b) => firstAt(a).localeCompare(firstAt(b)))) {
    lines.push(`\n=== THREAD: ${t.channel.name} (${t.messages.length} messages)`);
    render(t, aliases, lines);
  }
  write(d.channel.name || id, lines);
}
// Forum channels export only their posts (threads), with no parent file.
for (const [id, ts] of threads) {
  if (parents.has(id)) continue;
  const aliases = new Map();
  const lines = [`FORUM ${ts[0].channel.category} — ${ts.length} posts`];
  for (const t of ts.sort((a, b) => firstAt(a).localeCompare(firstAt(b)))) {
    lines.push(`\n=== POST: ${t.channel.name} (${t.messages.length} messages)`);
    render(t, aliases, lines);
  }
  write(ts[0].channel.category || id, lines);
}
