/**
 * The tray icon that keeps the app running with no window open: recording goes on,
 * and the dashboard opens from here. Overwolf's advice for apps that miss events
 * when started after the game is to start with Windows and wait in the tray
 * (docs/overwolf/setup-and-release.md §10), so there's a "Start with Windows" item.
 */
import { Menu, Tray, app } from 'electron';
import path from 'node:path';

/** Passed by the login item: start in the tray without opening the dashboard. */
export const HIDDEN_ARG = '--hidden';

export interface TrayActions {
  openDashboard(): void;
  quit(): void;
}

let tray: Tray | null = null;

export function createTray(actions: TrayActions): Tray {
  // tray.png plus its @1.25x/@1.5x/@2x siblings for Windows scaling (npm run icons).
  tray = new Tray(path.join(__dirname, '..', 'ui', 'assets', 'icon', 'tray.png'));
  tray.setToolTip('Apex Squads: recording');
  // Windows opens the menu on right-click; a left click should open the app.
  tray.on('click', () => actions.openDashboard());
  const rebuild = () => tray?.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Apex Squads', click: () => actions.openDashboard() },
    { type: 'separator' },
    startWithWindowsItem(rebuild),
    { type: 'separator' },
    { label: 'Quit', click: () => actions.quit() },
  ]));
  rebuild();
  return tray;
}

/** Whether this launch came from the login item. */
export function startedHidden(): boolean {
  return process.argv.includes(HIDDEN_ARG);
}

function startWithWindowsItem(rebuild: () => void): Electron.MenuItemConstructorOptions {
  // A dev run's login item would start node_modules' ow-electron with no app.
  if (!app.isPackaged) return { label: 'Start with Windows (installed app only)', enabled: false };
  const loginItem = { args: [HIDDEN_ARG] };
  return {
    label: 'Start with Windows',
    type: 'checkbox',
    checked: app.getLoginItemSettings(loginItem).openAtLogin,
    click: (item) => {
      app.setLoginItemSettings({ ...loginItem, openAtLogin: item.checked });
      rebuild();
    },
  };
}
