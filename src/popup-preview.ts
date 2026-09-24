/**
 * Replays one recorded match and shows its kill/death popups, a few seconds
 * apart, with made-up ranks (no API calls: fixture IDs are fake and could
 * belong to real players). `npm run popup:preview`; works on macOS.
 *
 *   APEX_RECORDINGS_DIR   recordings to use (default: fixtures/recordings)
 *   APEX_REPLAY_MATCH     match id to replay (default: the latest with popups)
 *   APEX_UI_SCREENSHOT    folder: save each popup as popup-N.png, then quit
 */
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { EncounterTracker } from './encounters';
import { PlayerHistory, type LookupValue } from './player-history';
import { PopupService } from './popup-service';
import { PopupWindow } from './popup-window';
import type { PlayerQuery, RankFetcher, RecordLine } from './recorder';
import { readRecordings } from './recordings';
import type { Popup } from './ui/popup-card';

const GAP_MS = 4000;
const TIERS: [string, number][] = [['Silver', 3000], ['Gold', 5400], ['Platinum', 8200], ['Diamond', 11400], ['Master', 15000]];

const recordings = process.env.APEX_RECORDINGS_DIR || path.join(__dirname, '..', 'fixtures', 'recordings');
const lines = readRecordings([recordings]);

/** Deterministic made-up rank per player, spread around the lobby's Platinum. */
function fakeRank(uid: string, seasonsAgo = 0) {
  let h = 0;
  for (const c of uid) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const t = Math.min(TIERS.length - 1, [0, 1, 1, 2, 2, 2, 2, 3, 3, 4][h % 10] + seasonsAgo);
  const [tier, floor] = TIERS[t];
  const div = tier === 'Master' ? 0 : 1 + ((h >>> 4) % 4);
  return {
    rankName: tier,
    rankDiv: div,
    rankScore: floor + (4 - (div || 4)) * 700 + ((h >>> 8) % 600),
    rankedSeason: seasonsAgo ? 'br_ranked_s29_s2' : 'br_ranked_s30_s2',
    ALStopPercent: 5 + ((h >>> 12) % 60),
    level: 20 + ((h >>> 16) % 900),
  };
}

const fakeClient: RankFetcher = {
  async fetchPlayer(q: PlayerQuery) {
    const uid = 'uid' in q ? q.uid : q.name;
    const rank = fakeRank(uid);
    return { status: 200, body: { global: { uid, level: rank.level, rank } } };
  },
};

function lookupLine(uid: string, value: LookupValue, at: string): RecordLine {
  return { schema: 1, session_id: 'replay', seq: 0, received_at: at, kind: 'player_lookup', match_id: null, feature: null, category: null, key: uid, value };
}

/** The match to replay: APEX_REPLAY_MATCH, else the latest one that has popups. */
function pickMatch(): string | null {
  if (process.env.APEX_REPLAY_MATCH) return process.env.APEX_REPLAY_MATCH;
  const scratch = new PlayerHistory();
  const tracker = new EncounterTracker(scratch);
  let last: string | null = null;
  for (const l of lines) {
    scratch.add(l);
    if (tracker.onLine(l).triggers.length) last = l.match_id;
  }
  return last;
}

async function main(): Promise<void> {
  const target = pickMatch();
  if (!target) {
    console.log(`No match with kills or deaths in ${recordings}`);
    app.quit();
    return;
  }

  const history = new PlayerHistory();
  const popups: Popup[] = [];
  const service = new PopupService({
    history,
    lookup: fakeClient,
    recordLookup: (uid, value) => service.onLine(lookupLine(uid, value, new Date().toISOString())),
    show: (popup, trigger) => {
      if (trigger.matchId === target) popups.push({ ...popup, demo: true });
    },
  });

  // Pretend a third of this match's lobby was seen higher last season, to show the peak line.
  const start = lines.find((l) => l.match_id === target)!.received_at;
  const lobby = new Set<string>();
  for (const l of lines) {
    if (l.match_id !== target || !l.key?.startsWith('roster_') || typeof l.value !== 'string') continue;
    const uid = (JSON.parse(l.value) as { origin_id?: string } | null)?.origin_id;
    if (uid) lobby.add(uid);
  }
  [...lobby].filter((_, i) => i % 3 === 0).forEach((uid) =>
    history.add(lookupLine(uid, { name: '', status: 200, global: { rank: fakeRank(uid, 1) } }, '2026-06-01T00:00:00.000Z')));

  for (const l of lines) service.onLine(l);
  await new Promise((resolve) => setTimeout(resolve, 200)); // let the fake lookups settle

  // Lookups finish in any order; in the game each popup shows at its own moment.
  popups.sort((a, b) => a.at.localeCompare(b.at));
  console.log(`Replaying match ${target} (started ${start}): ${popups.length} popups`);
  const shots = process.env.APEX_UI_SCREENSHOT;
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const window = new PopupWindow();
  for (const [i, p] of popups.entries()) {
    const k = p.knockedBy ? ` (knocked by ${p.knockedBy.name})` : '';
    console.log(`${p.at.slice(11, 19)} ${p.moment === 'killed_by' ? 'Killed by' : 'You killed'} ${p.player.name}: ${p.player.kills} kills${p.player.killLeader ? ', kill leader' : ''}${k}`);
    window.show(p);
    await new Promise((resolve) => setTimeout(resolve, shots ? 800 : GAP_MS));
    if (shots) {
      const image = await window.browserWindow.webContents.capturePage();
      fs.writeFileSync(path.join(shots, `popup-${i + 1}.png`), image.toPNG());
    }
  }
  app.quit();
}

app.whenReady().then(main);
app.on('window-all-closed', () => undefined);
