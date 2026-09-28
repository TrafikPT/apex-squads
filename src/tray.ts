/**
 * The tray icon that keeps the app running with no window open: recording goes on,
 * and the dashboard opens from here. Overwolf's advice for apps that miss events
 * when started after the game is to start with Windows and wait in the tray
 * (docs/overwolf/setup-and-release.md §10), so there's a "Start with Windows" item.
 */
import { Menu, Tray, app, nativeImage, type NativeImage } from 'electron';

/** Passed by the login item: start in the tray without opening the dashboard. */
export const HIDDEN_ARG = '--hidden';

export interface TrayActions {
  openDashboard(): void;
  quit(): void;
}

let tray: Tray | null = null;

export function createTray(actions: TrayActions): Tray {
  tray = new Tray(placeholderIcon());
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

/**
 * Until the app has an icon: the accent colour's rounded square with a white
 * chevron, drawn at 32 px for a 16 px tray slot at 2x.
 */
function placeholderIcon(): NativeImage {
  const size = 32;
  const pixels = Buffer.alloc(size * size * 4);
  const accent = [0x2a, 0x54, 0xe8]; // #e8542a as BGR
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!inRoundedSquare(x, y, size, 7)) continue;
      // Chevron: two strokes from the bottom corners up to the top centre.
      const t = (y - 6) / 20; // 0 at the apex, 1 at the base
      const half = 3 + t * 10;
      const onStroke = t >= 0 && t <= 1 && Math.abs(Math.abs(x + 0.5 - size / 2) - half) < 2.5;
      const [b, g, r] = onStroke ? [0xff, 0xff, 0xff] : accent;
      pixels[i] = b;
      pixels[i + 1] = g;
      pixels[i + 2] = r;
      pixels[i + 3] = 0xff;
    }
  }
  return nativeImage.createFromBitmap(pixels, { width: size, height: size, scaleFactor: 2 });
}

function inRoundedSquare(x: number, y: number, size: number, radius: number): boolean {
  const cx = Math.min(Math.max(x + 0.5, radius), size - radius);
  const cy = Math.min(Math.max(y + 0.5, radius), size - radius);
  return (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= radius ** 2;
}
