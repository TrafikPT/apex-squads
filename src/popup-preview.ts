/**
 * Replays one recorded match and shows its popups, a few seconds apart, with
 * the history built from the recordings before it. `npm run popup:preview`;
 * works on macOS.
 *
 *   APEX_RECORDINGS_DIR   recordings to use (default: fixtures/recordings)
 *   APEX_REPLAY_MATCH     match id to replay (default: the latest with popups)
 *   APEX_UI_SCREENSHOT    folder: save each popup as popup-N.png, then quit
 */
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { PlayerHistory } from './player-history';
import { describePopup, PopupService } from './popup-service';
import { PopupWindow } from './popup-window';
import { readRecordings } from './recordings';
import type { Popup } from './ui/popup-card';

const GAP_MS = 4000;

const recordings = process.env.APEX_RECORDINGS_DIR || path.join(__dirname, '..', 'fixtures', 'recordings');
const lines = readRecordings([recordings]);

/** Every popup the recordings produce, per match, in order. */
async function collect(): Promise<Map<string, Popup[]>> {
  const byMatch = new Map<string, Popup[]>();
  const service = new PopupService({
    history: new PlayerHistory(),
    lobbyDelayMs: 0,
    show: (popup, matchId) => {
      if (!byMatch.has(matchId)) byMatch.set(matchId, []);
      byMatch.get(matchId)!.push(popup);
    },
  });
  for (const l of lines) service.onLine(l);
  await new Promise((resolve) => setTimeout(resolve, 10)); // the lobby cards' timers
  for (const popups of byMatch.values()) popups.sort((a, b) => a.at.localeCompare(b.at));
  return byMatch;
}

async function main(): Promise<void> {
  const byMatch = await collect();
  const target = process.env.APEX_REPLAY_MATCH || [...byMatch.keys()].at(-1);
  const popups = (target && byMatch.get(target)) || [];
  if (!popups.length) {
    console.log(`No popups for ${target ?? 'any match'} in ${recordings}`);
    app.quit();
    return;
  }

  console.log(`Replaying match ${target}: ${popups.length} popups`);
  const shots = process.env.APEX_UI_SCREENSHOT;
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const window = new PopupWindow();
  for (const [i, p] of popups.entries()) {
    console.log(`${p.at.slice(11, 19)} ${describePopup(p)}`);
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
