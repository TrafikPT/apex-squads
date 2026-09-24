/**
 * The dashboard's only way to reach the main process (the window is sandboxed):
 * `window.apex.loadDataset()` returns the stats built from the recordings.
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('apex', {
  loadDataset: () => ipcRenderer.invoke('apex:dataset'),
});
