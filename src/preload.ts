/**
 * The only way the app's windows reach the main process (they're sandboxed):
 * `window.apex.loadDataset()`, `onDatasetChanged()` and the settings calls for
 * the dashboard, `onPopup()` for the popup, `openRecordingsFolder()` for Help,
 * `loadStatus()`/`onStatus()` for the title bar.
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('apex', {
  loadDataset: () => ipcRenderer.invoke('apex:dataset'),
  onDatasetChanged: (callback: () => void) => {
    ipcRenderer.on('apex:dataset-changed', () => callback());
  },
  loadSettings: () => ipcRenderer.invoke('apex:settings'),
  saveSettings: (settings: unknown) => ipcRenderer.invoke('apex:save-settings', settings),
  testPopup: () => ipcRenderer.invoke('apex:test-popup'),
  onPopup: (callback: (popup: unknown) => void) => {
    ipcRenderer.on('apex:popup', (_event, popup) => callback(popup));
  },
  openRecordingsFolder: () => ipcRenderer.invoke('apex:open-recordings'),
  dataInfo: () => ipcRenderer.invoke('apex:data-info'),
  loadStatus: () => ipcRenderer.invoke('apex:status'),
  onStatus: (callback: (status: unknown) => void) => {
    ipcRenderer.on('apex:status-changed', (_event, status) => callback(status));
  },
  installOverlayHelper: () => ipcRenderer.invoke('apex:install-overlay-helper'),
});
