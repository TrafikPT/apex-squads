/**
 * Settings on disk: one JSON file in the app's data folder, so every
 * entry point (the Overwolf app, the dashboard preview, the live popups) reads
 * the same one. Read again before each popup, so changes apply without a
 * restart. APEX_SETTINGS_FILE points elsewhere (tests, a second setup).
 */
import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from './data-dir';
import { type Settings, withDefaults } from './ui/app-settings';

export function settingsFile(): string {
  return process.env.APEX_SETTINGS_FILE || path.join(dataDir(), 'settings.json');
}

/** The saved settings, or the defaults when there's no file yet or it can't be read. */
export function loadSettings(): Settings {
  try {
    return withDefaults(JSON.parse(fs.readFileSync(settingsFile(), 'utf8')));
  } catch {
    return withDefaults(null);
  }
}

const savedListeners: ((settings: Settings) => void)[] = [];

export function saveSettings(settings: Settings): Settings {
  const clean = withDefaults(settings);
  const file = settingsFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(clean, null, 2)}\n`);
  for (const listener of savedListeners) listener(clean);
  return clean;
}

/** For what reads settings once instead of before each use (the hotkeys). */
export function onSettingsSaved(listener: (settings: Settings) => void): void {
  savedListeners.push(listener);
}
