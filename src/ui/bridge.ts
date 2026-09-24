import type { Dataset } from './facts';

/** Exposed by src/preload.ts. Absent when the UI runs outside the app (plain browser). */
export interface ApexBridge {
  loadDataset(): Promise<Dataset>;
}

declare global {
  interface Window {
    apex?: ApexBridge;
  }
}
