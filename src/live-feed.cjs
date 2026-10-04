const fs = require('node:fs/promises');
const path = require('node:path');
const { atomicWrite } = require('./core.cjs');

const TOKEN = /^[a-f0-9]{32}$/;
const MAX_PHOTOS = 120;
const MAX_PER_POLL = 4;
const MAX_BYTES = 25 * 1024 * 1024;

class LivePhotoFeed {
  constructor({ root, endpoint, fetchImpl = global.fetch, onUpdate = () => {}, intervalMs = 12_000 }) {
    this.root = root; this.endpoint = endpoint; this.fetch = fetchImpl; this.onUpdate = onUpdate; this.intervalMs = intervalMs;
    this.indexFile = path.join(root, 'index.json'); this.photos = []; this.polling = false; this.timer = null; this.lastCheckedAt = null; this.lastError = null;
  }
  summary() {
    const count = this.photos.length;
    return { enabled: !!this.endpoint, count, connected: !!this.lastCheckedAt && !this.lastError, lastCheckedAt: this.lastCheckedAt, message: this.lastError ? `Offline · using ${count} cached booth photo${count === 1 ? '' : 's'}` : this.lastCheckedAt ? `${count} booth photo${count === 1 ? '' : 's'} ready` : 'Checking for booth photos…' };
  }
  items() {
    return this.photos.map(photo => ({ id: `booth-${photo.token}`, name: 'Photo booth', kind: 'image', source: 'booth', createdAt: photo.createdAt, filePath: path.join(this.root, photo.file), metadata: {} }));
  }
  async init() {
    await fs.mkdir(this.root, { recursive: true });
    try {
      const saved = JSON.parse(await fs.readFile(this.indexFile, 'utf8'));
      for (const photo of Array.isArray(saved.photos) ? saved.photos : []) {
        if (!TOKEN.test(photo.token) || photo.file !== `${photo.token}.jpg`) continue;
        try { const stat = await fs.stat(path.join(this.root, photo.file)); if (stat.isFile() && stat.size > 0) this.photos.push(photo); } catch {}
      }
    } catch (error) { if (error.code !== 'ENOENT') this.lastError = 'Could not read the booth photo cache'; }
    this.onUpdate(this.summary()); return this.summary();
  }
  start() {
    if (!this.endpoint || this.timer) return;
    this.poll().catch(() => {});
    this.timer = setInterval(() => this.poll().catch(() => {}), this.intervalMs);
  }
  stop() { clearInterval(this.timer); this.timer = null; }
  async persist() { await atomicWrite(this.indexFile, JSON.stringify({ version: 1, photos: this.photos }, null, 2)); }
  async download(photo) {
    const source = new URL(photo.url, this.endpoint), feedOrigin = new URL(this.endpoint).origin;
    if (source.origin !== feedOrigin || !source.pathname.startsWith('/media/')) throw new Error('Invalid booth photo URL');
    const response = await this.fetch(source, { headers: { accept: 'image/jpeg' }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Photo download returned ${response.status}`);
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) throw new Error('Booth photo is too large');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 4 || bytes.length > MAX_BYTES || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Booth photo is not a valid JPEG');
    const file = `${photo.token}.jpg`; await atomicWrite(path.join(this.root, file), bytes);
    return { token: photo.token, createdAt: String(photo.createdAt || ''), file };
  }
  async poll() {
    if (!this.endpoint || this.polling) return this.summary();
    this.polling = true;
    try {
      const response = await this.fetch(this.endpoint, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`Booth feed returned ${response.status}`);
      const manifest = await response.json(), known = new Set(this.photos.map(photo => photo.token));
      const newPhotos = (Array.isArray(manifest.photos) ? manifest.photos : []).filter(photo => photo && TOKEN.test(photo.token) && typeof photo.url === 'string' && !known.has(photo.token)).slice(0, MAX_PER_POLL);
      let changed = false;
      for (const photo of newPhotos) {
        try { this.photos.push(await this.download(photo)); changed = true; } catch {}
      }
      this.photos.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      if (this.photos.length > MAX_PHOTOS) {
        const removed = this.photos.splice(0, this.photos.length - MAX_PHOTOS);
        await Promise.all(removed.map(photo => fs.rm(path.join(this.root, photo.file), { force: true }).catch(() => {}))); changed = true;
      }
      if (changed) await this.persist();
      this.lastCheckedAt = new Date().toISOString(); this.lastError = null;
    } catch (error) { this.lastError = String(error.message || error); }
    finally { this.polling = false; this.onUpdate(this.summary()); }
    return this.summary();
  }
}

module.exports = { LivePhotoFeed, MAX_PHOTOS, MAX_PER_POLL };
