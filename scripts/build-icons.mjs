// Renders build/icon.svg into every icon file the app needs: `npm run icons`.
// Runs in Electron (Chromium draws the SVG), so no image tools are needed.
//   build/icon.ico            Windows exe, installer and shortcuts (16-256 px)
//   build/icon.png            512 px, for electron-builder and anything else
//   build/store-icon-55.png   the Overwolf store listing's app icon
//   ui/assets/icon/tray*.png  the tray icon at 100/125/150/200% scaling
//   ui/assets/icon/window.png the dashboard window's icon (dev runs; installs use the exe's)
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(root, 'build', 'icon.svg'), 'utf8');
const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const TRAY = { 'tray.png': 16, 'tray@1.25x.png': 20, 'tray@1.5x.png': 24, 'tray@2x.png': 32 };

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ show: false });
    await win.loadURL('data:text/html,<canvas></canvas>');
    /** RGBA pixels and PNG bytes of the icon drawn at size x size, whatever the screen's scaling. */
    const render = async (size) => {
      const { png, rgba } = await win.webContents.executeJavaScript(`(async () => {
        const img = new Image();
        img.src = 'data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}';
        await img.decode();
        const c = document.querySelector('canvas');
        c.width = c.height = ${size};
        const g = c.getContext('2d');
        g.clearRect(0, 0, ${size}, ${size});
        g.drawImage(img, 0, 0, ${size}, ${size});
        return { png: c.toDataURL('image/png'), rgba: Array.from(g.getImageData(0, 0, ${size}, ${size}).data) };
      })()`);
      return { png: Buffer.from(png.split(',')[1], 'base64'), rgba: Buffer.from(rgba) };
    };

    const write = (file, bytes) => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
      console.log(`${path.relative(root, file)} (${bytes.length} bytes)`);
    };
    const images = new Map();
    for (const size of new Set([...ICO_SIZES, 55, 512, ...Object.values(TRAY)])) images.set(size, await render(size));

    write(path.join(root, 'build', 'icon.ico'), ico(ICO_SIZES.map((s) => ({ size: s, ...images.get(s) }))));
    write(path.join(root, 'build', 'icon.png'), images.get(512).png);
    write(path.join(root, 'build', 'store-icon-55.png'), images.get(55).png);
    for (const [name, size] of Object.entries(TRAY)) write(path.join(root, 'ui', 'assets', 'icon', name), images.get(size).png);
    write(path.join(root, 'ui', 'assets', 'icon', 'window.png'), images.get(256).png);
    app.exit(0);
  } catch (err) {
    console.error(err);
    app.exit(1);
  }
});

/**
 * A Windows .ico. The 256 px image goes in as PNG; the smaller ones as 32-bit
 * bitmaps, because the NSIS installer rejects PNG-compressed small icons.
 */
function ico(images) {
  const entries = images.map(({ size, png, rgba }) => ({ size, data: size >= 256 ? png : dib(size, rgba) }));
  const header = Buffer.alloc(6 + 16 * entries.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // icon
  header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  entries.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, at); // 0 means 256
    header.writeUInt8(size >= 256 ? 0 : size, at + 1);
    header.writeUInt8(0, at + 2); // no palette
    header.writeUInt8(0, at + 3);
    header.writeUInt16LE(1, at + 4); // colour planes
    header.writeUInt16LE(32, at + 6); // bits per pixel
    header.writeUInt32LE(data.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...entries.map((e) => e.data)]);
}

/** A 32-bit BGRA bitmap as an .ico stores it: bottom-up, double height, then a blank AND mask. */
function dib(size, rgba) {
  const maskRow = Math.ceil(size / 32) * 4;
  const out = Buffer.alloc(40 + size * size * 4 + maskRow * size);
  out.writeUInt32LE(40, 0); // BITMAPINFOHEADER size
  out.writeInt32LE(size, 4);
  out.writeInt32LE(size * 2, 8); // image plus mask
  out.writeUInt16LE(1, 12);
  out.writeUInt16LE(32, 14);
  out.writeUInt32LE(size * size * 4 + maskRow * size, 20);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const from = (y * size + x) * 4;
      const to = 40 + ((size - 1 - y) * size + x) * 4;
      out[to] = rgba[from + 2];
      out[to + 1] = rgba[from + 1];
      out[to + 2] = rgba[from];
      out[to + 3] = rgba[from + 3];
    }
  }
  return out; // the AND mask stays zero: alpha does the masking
}
