import type { Dataset } from './facts';
import type { Popup } from './popup-card';

/** Exposed by src/preload.ts. Absent when the UI runs outside the app (plain browser). */
export interface ApexBridge {
  loadDataset(): Promise<Dataset>;
  /** A match finished since the last load. */
  onDatasetChanged(callback: () => void): void;
  onPopup(callback: (popup: Popup) => void): void;
}

declare global {
  interface Window {
    apex?: ApexBridge;
  }
}
