const fs = require('node:fs/promises');
const nodeFs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readMetadata, VERSION } = require('./metadata.cjs');
const IMAGE = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const VIDEO = new Set(['.mp4', '.mov', '.m4v', '.webm']);
const LARGE_VIDEO_BYTES = 750 * 1024 * 1024;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
function cleanManualDetails(value) {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid media details');
  const result = {};
  for (const [key, limit] of [['caption', 180], ['place', 120]]) {
    if (!own(value, key)) continue;
    if (typeof value[key] !== 'string') throw new Error('Invalid media details');
    result[key] = value[key].replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
  }
  if (own(value, 'date')) {
    if (typeof value.date !== 'string') throw new Error('Invalid media details');
    const date = value.date.trim();
    if (date && !/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/.test(date)) throw new Error('Use a date like 1998, 2004-06 or 2014-08-17.');
    if (date && (Number(date.slice(0, 4)) < 1800 || Number(date.slice(0, 4)) > new Date().getFullYear() + 1)) throw new Error('Use a plausible year.');
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split('-').map(Number);
      if (day > new Date(Date.UTC(year, month, 0)).getUTCDate()) throw new Error('That date does not exist.');
    }
    result.date = date;
  }
  result.reviewedAt = new Date().toISOString();
  return result;
}
function mediaKind(file) { const ext = path.extname(file).toLowerCase(); return IMAGE.has(ext) ? 'image' : VIDEO.has(ext) ? 'video' : null; }
function cleanSettings(s = {}) {
  return { seconds: Math.max(2, Math.min(60, Number(s.seconds) || 8)), fit: s.fit === 'cover' ? 'cover' : 'contain', layout: s.layout === 'grid' ? 'grid' : 'single', sound: !!s.sound, metadata: s.metadata !== false, gps: s.gps !== false, metadataCorner: s.metadataCorner === 'left' ? 'left' : 'right' };
}
async function atomicWrite(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${crypto.randomUUID()}.partial`;
  try {
    const handle = await fs.open(temp, 'wx');
    try { await handle.writeFile(data); await handle.sync(); } finally { await handle.close(); }
    await fs.rename(temp, file);
  } catch (e) { await fs.rm(temp, { force: true }).catch(() => {}); throw e; }
}
function hashFile(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256'), stream = nodeFs.createReadStream(file);
    stream.on('error', reject); stream.on('data', chunk => hash.update(chunk)); stream.on('end', () => resolve(hash.digest('hex')));
  });
}
class Library {
  constructor(root) { this.root = root; this.file = path.join(root, 'playlist.json'); this.state = { items: [], settings: cleanSettings() }; this.chain = Promise.resolve(); }
  serial(fn) { const result = this.chain.then(fn); this.chain = result.catch(() => {}); return result; }
  async init() {
    await fs.mkdir(path.join(this.root, 'media'), { recursive: true });
    try {
      const data = JSON.parse(await fs.readFile(this.file, 'utf8'));
      if (!Array.isArray(data.items)) throw new Error('Invalid playlist');
      this.state = { items: data.items.filter(i => /^[a-f0-9-]+\.[a-z0-9]+$/.test(i.file) && mediaKind(i.file)), settings: cleanSettings(data.settings) };
    } catch (e) { if (e.code !== 'ENOENT') throw new Error(`Cannot read the saved playlist. Your media is safe in ${this.root}. ${e.message}`); }
    let updated = false;
    for (const item of this.state.items) {
      if (item.metadata?.version !== VERSION) {
        const previous = item.metadata;
        item.metadata = await readMetadata(path.join(this.root, 'media', item.file), item.kind);
        if (item.metadata.location && JSON.stringify(previous?.location) === JSON.stringify(item.metadata.location) && previous?.placeName) item.metadata.placeName = previous.placeName;
        updated = true;
      }
    }
    if (updated) await this.persist(this.state);
    return this.state;
  }
  async persist(next) { await atomicWrite(this.file, JSON.stringify(next, null, 2)); this.state = next; return this.state; }
  import(paths) { return this.serial(async () => {
    const added = [], errors = [];
    for (const source of paths) {
      const kind = mediaKind(source);
      if (!kind) { errors.push(`${path.basename(source)}: unsupported format`); continue; }
      try {
        const stat = await fs.stat(source);
        if (!stat.isFile() || !stat.size) throw new Error('empty or not a file');
        const disk = await fs.statfs(this.root); if (disk.bavail * disk.bsize < stat.size + 100 * 1024 * 1024) throw new Error('not enough free space');
        const id = crypto.randomUUID(), file = `${id}${path.extname(source).toLowerCase()}`;
        const dest = path.join(this.root, 'media', file);
        await fs.copyFile(source, dest + '.partial');
        await fs.rename(dest + '.partial', dest);
        added.push({ id, file, name: path.basename(source), kind, bytes: stat.size, metadata: await readMetadata(dest, kind) });
      } catch (e) { errors.push(`${path.basename(source)}: ${e.message}`); }
    }
    await this.persist({ ...this.state, items: [...this.state.items, ...added] });
    return { state: this.state, errors };
  }); }
  update(ids, settings) { return this.serial(async () => {
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some(id => !this.state.items.find(i => i.id === id))) throw new Error('Invalid playlist order');
    return this.persist({ items: ids.map(id => this.state.items.find(i => i.id === id)), settings: cleanSettings(settings) });
  }); }
  remove(id) { return this.serial(async () => {
    const item = this.state.items.find(entry => entry.id === id);
    if (!item) throw new Error('That item is no longer in the library.');
    await this.persist({ ...this.state, items: this.state.items.filter(entry => entry.id !== id) });
    return item;
  }); }
  removeMany(ids) { return this.serial(async () => {
    if (!Array.isArray(ids) || !ids.length || ids.length > 1000 || new Set(ids).size !== ids.length) throw new Error('Invalid items to delete.');
    const wanted = new Set(ids), removed = this.state.items.filter(item => wanted.has(item.id));
    if (removed.length !== wanted.size) throw new Error('One or more items are no longer in the library.');
    await this.persist({ ...this.state, items: this.state.items.filter(item => !wanted.has(item.id)) });
    return removed;
  }); }
  scanContentHashes(progress = () => {}) { return this.serial(async () => {
    const pending = this.state.items.filter(item => !/^[a-f0-9]{64}$/.test(item.contentHash || ''));
    let done = 0; const hashes = new Map();
    for (const item of pending) {
      progress({ done, total: pending.length, name: item.name });
      hashes.set(item.id, await hashFile(path.join(this.root, 'media', item.file))); done++;
    }
    if (hashes.size) await this.persist({ ...this.state, items: this.state.items.map(item => hashes.has(item.id) ? { ...item, contentHash: hashes.get(item.id) } : item) });
    progress({ done, total: pending.length, name: '' }); return { scanned: pending.length };
  }); }
  cacheMetrics(entries) { return this.serial(async () => {
    if (!Array.isArray(entries) || entries.length > 2500) throw new Error('Invalid media measurements');
    const incoming = new Map(entries.map(entry => [entry?.id, entry])); let changed = false;
    const items = this.state.items.map(item => {
      const entry = incoming.get(item.id); if (!entry) return item;
      const metric = {};
      if (Number.isFinite(entry.width) && entry.width > 0 && entry.width < 100000) metric.width = Math.round(entry.width);
      if (Number.isFinite(entry.height) && entry.height > 0 && entry.height < 100000) metric.height = Math.round(entry.height);
      if (item.kind === 'video' && Number.isFinite(entry.duration) && entry.duration > 0 && entry.duration < 24 * 60 * 60) metric.duration = entry.duration;
      if (item.kind === 'image' && /^[a-f0-9]{16}$/.test(entry.visualHash || '')) metric.visualHash = entry.visualHash;
      if (!Object.keys(metric).length) return item;
      if (Object.entries(metric).every(([key, value]) => item[key] === value)) return item;
      changed = true; return { ...item, ...metric };
    });
    if (changed) await this.persist({ ...this.state, items });
    return changed;
  }); }
  updateDetails(id, details) { return this.serial(async () => {
    const index = this.state.items.findIndex(item => item.id === id);
    if (index < 0) throw new Error('That item is no longer in the library.');
    const manual = cleanManualDetails(details), items = [...this.state.items], item = items[index];
    const metadata = { ...(item.metadata || {}) };
    if (manual === null) delete metadata.manual;
    else metadata.manual = manual;
    items[index] = { ...item, metadata };
    await this.persist({ ...this.state, items });
    return items[index];
  }); }
  optimizationSummary() {
    const items = this.state.items.filter(item => item.kind === 'video' && !item.optimized && Number(item.bytes) >= LARGE_VIDEO_BYTES);
    return { count: items.length, bytes: items.reduce((total, item) => total + Number(item.bytes || 0), 0), items: items.map(item => ({ id: item.id, name: item.name, bytes: item.bytes })) };
  }
  useOptimized(id, file, bytes) { return this.serial(async () => {
    if (!/^[a-f0-9-]+\.playback\.m4v$/.test(file) || !Number.isFinite(bytes) || bytes <= 0) throw new Error('Invalid optimized media');
    const index = this.state.items.findIndex(item => item.id === id && item.kind === 'video');
    if (index < 0) throw new Error('Video is no longer in the library');
    const previous = this.state.items[index], items = [...this.state.items];
    items[index] = { ...previous, file, bytes, optimized: { originalBytes: previous.bytes, createdAt: new Date().toISOString(), preset: '1080p' } };
    await this.persist({ ...this.state, items });
    await fs.rm(path.join(this.root, 'media', previous.file), { force: true }).catch(() => {});
    return items[index];
  }); }
}
async function saveCapture(root, capture) {
  if (!capture || capture.kind !== 'photo') throw new Error('Invalid capture');
  const files = capture.files;
  if (!Array.isArray(files) || !files.length || files.length > 3) throw new Error('Invalid capture files');
  let total = 0;
  for (const f of files) {
    if (!['original.jpg', 'print.jpg', 'thumb.jpg'].includes(f.name)) throw new Error('Invalid filename');
    f.buffer = Buffer.from(f.data); total += f.buffer.length;
    if (!f.buffer.length || total > 350 * 1024 * 1024) throw new Error('Empty or oversized capture');
  }
  if (new Set(files.map(f => f.name)).size !== files.length) throw new Error('Duplicate capture file');
  await fs.mkdir(root, { recursive: true });
  const disk = await fs.statfs(root); if (disk.bavail * disk.bsize < total + 100 * 1024 * 1024) throw new Error('Disk is nearly full. Free space, then retry saving.');
  const now = new Date(), day = now.toISOString().slice(0, 10);
  const id = `${now.toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}`;
  const parent = path.join(root, day), temp = path.join(parent, `.${id}.partial`), dest = path.join(parent, id);
  await fs.mkdir(temp, { recursive: true });
  try {
    for (const f of files) await atomicWrite(path.join(temp, f.name), f.buffer);
    await atomicWrite(path.join(temp, 'capture.json'), JSON.stringify({ id, createdAt: now.toISOString(), kind: capture.kind, ...capture.metadata, files: files.map(f => f.name) }, null, 2));
    await fs.rename(temp, dest);
    return { id, folder: dest, files: files.map(f => path.join(dest, f.name)) };
  } catch (e) { await fs.rm(temp, { recursive: true, force: true }).catch(() => {}); throw e; }
}
module.exports = { mediaKind, cleanSettings, cleanManualDetails, atomicWrite, Library, saveCapture, LARGE_VIDEO_BYTES };
