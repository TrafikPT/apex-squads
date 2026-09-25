/**
 * The only way the app's windows reach the main process (they're sandboxed):
 * `window.apex.loadDataset()` and `onDatasetChanged()` for the dashboard,
 * `onPopup()` for the popup.
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('apex', {
  loadDataset: () => ipcRenderer.invoke('apex:dataset'),
  onDatasetChanged: (callback: () => void) => {
    ipcRenderer.on('apex:dataset-changed', () => callback());
  },
  onPopup: (callback: (popup: unknown) => void) => {
    ipcRenderer.on('apex:popup', (_event, popup) => callback(popup));
  },
});
