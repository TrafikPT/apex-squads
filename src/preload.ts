/**
 * The only way the app's windows reach the main process (they're sandboxed):
 * `window.apex.loadDataset()` for the dashboard, `onPopup()` for the popup.
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('apex', {
  loadDataset: () => ipcRenderer.invoke('apex:dataset'),
  onPopup: (callback: (popup: unknown) => void) => {
    ipcRenderer.on('apex:popup', (_event, popup) => callback(popup));
  },
});
