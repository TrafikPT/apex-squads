import type { Settings } from './app-settings';
import type { Dataset } from './facts';
import type { Popup } from './popup-card';

/** Exposed by src/preload.ts. Absent when the UI runs outside the app (plain browser). */
export interface ApexBridge {
  loadDataset(): Promise<Dataset>;
  /** A match finished since the last load. */
  onDatasetChanged(callback: () => void): void;
  loadSettings(): Promise<Settings>;
  /** Saves and returns what was stored (invalid values replaced by defaults). */
  saveSettings(settings: Settings): Promise<Settings>;
  /** Shows a made-up popup where the settings put it, even if popups are off. */
  testPopup(): Promise<void>;
  onPopup(callback: (popup: Popup) => void): void;
  /** Opens the folder of recordings in the file manager (for bug reports). */
  openRecordingsFolder(): Promise<void>;
}

declare global {
  interface Window {
    apex?: ApexBridge;
  }
}
