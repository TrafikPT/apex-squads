/**
 * Live popups before our app can use GEP itself: follows the Overwolf client's
 * GEP log (written while another Apex app, like TRN's tracker, runs) and shows
 * the kill/death and lobby cards as its lines land. `npm run popup:live`.
 *
 * On start it replays the current log session without showing anything, so a
 * match already under way has its roster and kills; only fresh moments pop up.
 * The session is also written to the recordings folder under the importer's
 * name for it, so the dashboard shows it after a reload (Ctrl+R).
 *
 *   APEX_RECORDINGS_DIR   recordings for the cards' history, and where the session goes (default: recordings/)
 *   APEX_GEP_LOG          log file to follow (default: the Overwolf client's)
 */
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {
  OVERWOLF_GEP_LOG_DIR,
  parseGepLogLine,
  ReplayClock,
  replayEntry,
  sessionIdFor,
  type GepLogEntry,
} from './gep-log';
import { JsonlSink } from './jsonl-sink';
import { LogTail } from './log-tail';
import { PlayerHistory } from './player-history';
import { describePopup, PopupService } from './popup-service';
import { PopupWindow } from './popup-window';
import { Recorder } from './recorder';
import { readRecordings } from './recordings';

const POLL_MS = 250;
/** Popups for moments older than this are from the catch-up, or stale: skip them. */
const FRESH_MS = 15_000;

const recordingsDir = process.env.APEX_RECORDINGS_DIR || path.join(__dirname, '..', 'recordings');
const logFile = process.env.APEX_GEP_LOG || path.join(OVERWOLF_GEP_LOG_DIR, 'index.html.log');

function log(message: string): void {
  console.log(`${new Date().toTimeString().slice(0, 8)} ${message}`);
}


function parse(lines: string[]): GepLogEntry[] {
  return lines.map(parseGepLogLine).filter((e): e is GepLogEntry => e !== null);
}

function main(): void {
  if (!fs.existsSync(logFile)) {
    log(`No GEP log at ${logFile}. Is Overwolf running?`);
    app.quit();
    return;
  }

  const tail = new LogTail(logFile);
  let entries = parse(tail.read().lines);
  // Only the current Overwolf session: earlier ones are already in the recordings.
  const lastStart = entries.map((e) => e.type).lastIndexOf('session_start');
  if (lastStart > 0) entries = entries.slice(lastStart);
  const currentSession = entries.length ? sessionIdFor(entries[0].at) : null;

  // The current session may have been imported already; the catch-up adds it again.
  const history = new PlayerHistory();
  let known = 0;
  for (const line of readRecordings([recordingsDir])) {
    if (line.session_id === currentSession) continue;
    history.add(line);
    known++;
  }
  log(`History: ${known} recorded lines from ${recordingsDir}`);

  const window = new PopupWindow();
  const popups = new PopupService({
    history,
    show: (popup) => {
      if (Date.now() - Date.parse(popup.at) > FRESH_MS) return;
      log(describePopup(popup));
      window.show(popup);
    },
  });

  const clock = new ReplayClock();
  let recorder: Recorder | null = null;
  let sink: JsonlSink | null = null;
  const startSession = (e: GepLogEntry): Recorder => {
    const sessionId = sessionIdFor(e.at);
    clock.at = e.at;
    recorder?.dispose();
    sink?.close();
    // A session that began in an older log file is only partly here: don't
    // overwrite a fuller import of it.
    sink = null;
    if (e.type === 'session_start') {
      fs.rmSync(path.join(recordingsDir, `${sessionId}.jsonl`), { force: true });
      sink = new JsonlSink(recordingsDir, `${sessionId}.jsonl`);
      log(`Recording to ${sink.filePath}`);
    } else {
      log('This session began in an older log file; not recording it (run the importer later).');
    }
    const out = sink;
    recorder = new Recorder(sessionId, {
      write: (l) => {
        out?.write(l);
        popups.onLine(l);
      },
    }, null, clock);
    recorder.lifecycle('session_start', { imported_from: 'overwolf_gep_log', live: true });
    return recorder;
  };
  const feed = (batch: GepLogEntry[], announce = true): void => {
    for (const e of batch) {
      const r = e.type === 'session_start' || !recorder ? startSession(e) : recorder;
      clock.at = e.at;
      replayEntry(r, e);
      if (!announce) continue;
      if (e.type === 'info' && e.msg.key === 'phase') log(`Phase: ${String(e.msg.value)}`);
      if (e.type === 'game_launched' || e.type === 'game_ended') log(`Game ${e.type === 'game_launched' ? 'launched' : 'ended'} (${e.gameId})`);
    }
  };

  feed(entries, false);
  log(`Following ${logFile} (caught up on ${entries.length} entries). Ctrl+C to stop.`);
  setInterval(() => {
    const { lines, restarted } = tail.read();
    if (restarted) log('Overwolf started a new log file.');
    feed(parse(lines));
  }, POLL_MS);
}

app.whenReady().then(main);
app.on('window-all-closed', () => undefined);
