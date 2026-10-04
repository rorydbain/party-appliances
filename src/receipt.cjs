const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);

const EPSON_VENDOR = '04b8';
const EPSON_PRODUCT = '0e28';

class ReceiptPrinter {
  constructor({ script, python = process.env.FRAME_PRINTER_PYTHON || 'python3', run = exec, title = 'YOUR EVENT', venue = '' } = {}) { this.script = script; this.python = python; this.run = run; this.title = String(title).slice(0, 48); this.venue = String(venue).slice(0, 64); this.chain = Promise.resolve(); }
  serial(task) { const result = this.chain.then(task); this.chain = result.catch(() => {}); return result; }
  status() { return this.serial(() => this.readStatus()); }
  async readStatus() {
    if (process.platform !== 'darwin') return { present: false, ready: false, message: 'Printer check is currently configured for macOS.' };
    try {
      const { stdout } = await this.run('/usr/sbin/ioreg', ['-p', 'IOUSB', '-l', '-w0'], { timeout: 5000, maxBuffer: 4 * 1024 * 1024 });
      const present = new RegExp(`(Epson|EPSON|0x${EPSON_VENDOR}|0x${EPSON_PRODUCT})`, 'i').test(stdout);
      if (!present) return { present: false, ready: false, message: 'Receipt printer is not connected.' };
      try {
        await this.run(this.python, ['-c', 'import PIL, qrcode, escpos'], { timeout: 5000 });
        try {
          const result = await this.run(this.python, [this.script, '--status'], { timeout: 5000, maxBuffer: 1024 * 1024 });
          const paper = JSON.parse(result.stdout).paper;
          if (paper === 'out') return { present: true, ready: false, paper, message: 'Receipt paper has run out.' };
          if (paper === 'near-end') return { present: true, ready: true, paper, message: 'Receipt paper is running low.' };
          if (paper === 'adequate') return { present: true, ready: true, paper, message: 'Receipt paper is ready.' };
        } catch {}
        return { present: true, ready: true, paper: 'unknown', message: 'Printer is connected; paper level is unavailable.' };
      }
      catch { return { present: true, ready: false, message: 'Printer software needs installing.' }; }
    } catch (e) { return { present: false, ready: false, message: e.message }; }
  }
  print(job) { return this.serial(() => this.send(job)); }
  async send({ id, image, url }) {
    await fs.access(image);
    const { stdout } = await this.run(this.python, [this.script, '--image', image, '--url', url, '--capture-id', id, '--title', this.title, '--venue', this.venue, '--print'], { timeout: 60_000, maxBuffer: 1024 * 1024 });
    return stdout.trim();
  }
}

module.exports = { ReceiptPrinter, EPSON_VENDOR, EPSON_PRODUCT };
