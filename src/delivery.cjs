const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { atomicWrite } = require('./core.cjs');

const MAX_JOBS = 500;
const RETRY = [5_000, 15_000, 60_000, 5 * 60_000, 15 * 60_000];
const SHAREABLE = new Set(['original.jpg', 'print.jpg', 'thumb.jpg', 'clip.webm', 'clip.mp4']);
const TERMINAL_UPLOAD = new Set(['uploaded', 'local-only']);

function cleanConfig(value = {}) {
  const endpoint = String(value.endpoint || process.env.FRAME_DELIVERY_ENDPOINT || '').replace(/\/+$/, '');
  const publicUrl = String(value.publicUrl || process.env.FRAME_PUBLIC_GALLERY_URL || endpoint).replace(/\/+$/, '');
  const token = String(value.token || process.env.FRAME_DELIVERY_TOKEN || '');
  const event = String(value.event || process.env.FRAME_EVENT || '').toLowerCase();
  const printReceipts = value.printReceipts === true || process.env.FRAME_PRINT_RECEIPTS === '1';
  const validEndpoint = /^https:\/\//.test(endpoint) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(endpoint);
  const validPublicUrl = /^https:\/\//.test(publicUrl) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(publicUrl);
  return { endpoint: validEndpoint ? endpoint : '', publicUrl: validPublicUrl ? publicUrl : '', token, event: /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(event) ? event : '', printReceipts };
}

function shareLinks(config, publicToken) {
  if (!config.publicUrl || !config.event || !publicToken) return {};
  return {
    shareUrl: `${config.publicUrl}/?photo=${encodeURIComponent(publicToken)}`,
    galleryUrl: config.publicUrl
  };
}

class DeliveryQueue {
  constructor({ root, configFile, fetchImpl = global.fetch, printer = null, onStatus = () => {}, now = () => Date.now(), trash = folder => fs.rm(folder, { recursive: true, force: true }) }) {
    this.root = root; this.file = path.join(root, '.delivery-queue.json'); this.configFile = configFile;
    this.fetch = fetchImpl; this.printer = printer; this.onStatus = onStatus; this.now = now; this.trash = trash;
    this.config = cleanConfig(); this.jobs = []; this.running = false; this.draining = false; this.timer = null;
  }
  async init() {
    try { this.config = cleanConfig(JSON.parse(await fs.readFile(this.configFile, 'utf8'))); } catch (e) { if (e.code !== 'ENOENT') this.configError = e.message; }
    try {
      const saved = JSON.parse(await fs.readFile(this.file, 'utf8'));
      this.jobs = Array.isArray(saved.jobs) ? saved.jobs.filter(j => j && typeof j.id === 'string' && typeof j.folder === 'string') : [];
      for (const job of this.jobs) {
        if (job.status === 'uploading') job.status = 'pending';
        if (job.printStatus === 'printing') {
          job.printStatus = 'attention';
          job.printError = 'Photobooth closed while this receipt was printing. Check whether it printed before retrying.';
        }
      }
    } catch (e) { if (e.code !== 'ENOENT') this.queueError = e.message; }
    await this.persist(); this.notify(); return this.summary();
  }
  configured() { return !!(this.config.endpoint && this.config.token && this.config.event); }
  summary() {
    const pending = this.jobs.filter(j => ['waiting-config', 'pending', 'uploading'].includes(j.status)).length;
    const deleting = this.jobs.filter(j => j.status === 'deleting').length;
    const printPending = this.jobs.filter(j => j.printStatus === 'pending').length;
    const attention = this.jobs.filter(j => j.status === 'failed' || j.printStatus === 'attention').length;
    const recent = this.jobs.slice(-20).reverse().map(j => ({ id: j.id, kind: j.kind, createdAt: j.createdAt, status: j.status, attempts: j.attempts || 0, nextAttemptAt: j.nextAttemptAt || 0, lastError: j.lastError || null, printStatus: j.printStatus, printError: j.printError || null, shareUrl: j.shareUrl || null }));
    return { configured: this.configured(), event: this.config.event || null, printReceipts: this.config.printReceipts, pending, deleting, printPending, attention, recent, lastShareUrl: [...this.jobs].reverse().find(j => j.shareUrl)?.shareUrl || null, message: deleting ? `${deleting} capture${deleting === 1 ? '' : 's'} waiting to delete.` : this.configured() ? (attention ? `${attention} item${attention === 1 ? '' : 's'} need attention.` : pending ? `${pending} capture${pending === 1 ? '' : 's'} waiting to upload.` : printPending ? `${printPending} receipt${printPending === 1 ? '' : 's'} waiting for the printer.` : 'All uploads complete.') : 'Cloud sharing not configured. Captures saved on this Mac.' };
  }
  notify() { this.onStatus(this.summary()); }
  trimJobs() {
    const active = this.jobs.filter(j => !TERMINAL_UPLOAD.has(j.status) || ['pending', 'printing', 'attention'].includes(j.printStatus));
    const terminalSlots = Math.max(0, MAX_JOBS - active.length);
    const terminal = this.jobs.filter(j => !active.includes(j));
    const terminalIds = new Set((terminalSlots ? terminal.slice(-terminalSlots) : []).map(j => j.id));
    this.jobs = this.jobs.filter(j => active.includes(j) || terminalIds.has(j.id));
  }
  async persist() { this.trimJobs(); await atomicWrite(this.file, JSON.stringify({ version: 1, jobs: this.jobs }, null, 2)); }
  start() { if (this.running) return; this.running = true; this.timer = setInterval(() => this.drain().catch(() => {}), 5_000); this.drain().catch(() => {}); }
  stop() { this.running = false; clearInterval(this.timer); this.timer = null; }
  async enqueue(capture) {
    const metadata = JSON.parse(await fs.readFile(path.join(capture.folder, 'capture.json'), 'utf8'));
    if (!this.jobs.some(j => j.id === capture.id)) {
      const publicToken = crypto.randomBytes(16).toString('hex');
      this.jobs.push({ id: capture.id, publicToken, ...shareLinks(this.config, publicToken), folder: capture.folder, kind: metadata.kind, createdAt: metadata.createdAt, files: metadata.files, status: this.configured() ? 'pending' : 'waiting-config', attempts: 0, nextAttemptAt: 0, printStatus: this.config.printReceipts && metadata.kind === 'photo' ? 'pending' : 'disabled' });
      await this.persist(); this.notify();
    }
    this.drain().catch(() => {});
    return this.summary();
  }
  async upload(job) {
    const form = new FormData();
    form.set('metadata', JSON.stringify({ id: job.id, token: job.publicToken, event: this.config.event, kind: job.kind, createdAt: job.createdAt }));
    const preferredPhoto = job.files.includes('print.jpg') ? 'print.jpg' : 'original.jpg';
    const guestFiles = job.kind === 'photo' ? job.files.filter(name => name === preferredPhoto || name === 'thumb.jpg') : job.files.filter(name => name === 'clip.webm' || name === 'clip.mp4');
    for (const name of guestFiles) {
      const data = await fs.readFile(path.join(job.folder, name));
      const type = name.endsWith('.jpg') ? 'image/jpeg' : name.endsWith('.mp4') ? 'video/mp4' : 'video/webm';
      form.append('files', new Blob([data], { type }), name);
    }
    const response = await this.fetch(`${this.config.endpoint}/api/captures`, { method: 'POST', headers: { authorization: `Bearer ${this.config.token}` }, body: form, signal: AbortSignal.timeout(90_000) });
    if (!response.ok) throw new Error(`Upload service returned ${response.status}`);
    const result = await response.json();
    if (typeof result.shareUrl !== 'string' || typeof result.galleryUrl !== 'string') throw new Error('Upload service returned an invalid link');
    job.shareUrl ||= result.shareUrl; job.galleryUrl ||= result.galleryUrl;
    if (job.status !== 'deleting') { job.status = 'uploaded'; job.uploadedAt = new Date(this.now()).toISOString(); job.lastError = null; }
  }
  async tryPrint(job) {
    if (!this.config.printReceipts || job.kind !== 'photo' || job.printStatus !== 'pending' || !job.shareUrl || !this.printer) return;
    const status = await this.printer.status();
    if (!status.present || !status.ready) return;
    job.printStatus = 'printing'; await this.persist(); this.notify();
    try { await this.printer.print({ id: job.id, image: path.join(job.folder, job.files.includes('print.jpg') ? 'print.jpg' : 'original.jpg'), url: job.shareUrl }); job.printStatus = 'printed'; job.printedAt = new Date(this.now()).toISOString(); job.printError = null; }
    catch (e) { job.printStatus = 'attention'; job.printError = String(e.message || e).slice(0, 300); }
  }
  async receiptHistory() {
    const items = [];
    for (const job of [...this.jobs].reverse()) {
      if (job.kind !== 'photo' || job.status === 'deleting' || !job.shareUrl) continue;
      const imageName = job.files.includes('print.jpg') ? 'print.jpg' : job.files.includes('original.jpg') ? 'original.jpg' : null;
      if (!imageName) continue;
      const image = path.join(job.folder, imageName), thumbnail = path.join(job.folder, job.files.includes('thumb.jpg') ? 'thumb.jpg' : imageName);
      try { await fs.access(image); await fs.access(thumbnail); }
      catch { continue; }
      items.push({ id: job.id, createdAt: job.createdAt, image, thumbnail, shareUrl: job.shareUrl, status: job.status, printStatus: job.printStatus });
    }
    return items;
  }
  async reprint(id) {
    const item = (await this.receiptHistory()).find(entry => entry.id === id);
    if (!item) throw new Error('That photograph is no longer available to print.');
    if (!this.printer) throw new Error('Receipt printer is unavailable.');
    const status = await this.printer.status();
    if (!status.present || !status.ready) throw new Error(status.message || 'Receipt printer is not ready.');
    await this.printer.print({ id: item.id, image: item.image, url: item.shareUrl });
    return { printed: true, id: item.id, message: 'Receipt printed.' };
  }
  async retry(id) {
    const job = this.jobs.find(item => item.id === id);
    if (!job || job.status === 'local-only') throw new Error('Capture is not in the sharing queue.');
    if (job.status === 'deleting') { job.nextAttemptAt = 0; job.lastError = null; }
    else if (job.status !== 'uploaded') { job.status = 'pending'; job.nextAttemptAt = 0; job.lastError = null; }
    if (job.printStatus === 'attention') { job.printStatus = 'pending'; job.printError = null; }
    await this.persist(); this.notify(); this.drain().catch(() => {}); return this.summary();
  }
  async remove(id) {
    const job = this.jobs.find(item => item.id === id);
    if (!job) throw new Error('Capture is no longer in the queue.');
    if (job.status !== 'deleting') {
      job.deleteCloud = !['local-only', 'waiting-config'].includes(job.status); job.status = 'deleting'; job.attempts = 0; job.nextAttemptAt = 0; job.lastError = null; job.printStatus = 'disabled';
      await this.persist(); this.notify();
    }
    this.drain().catch(() => {}); return this.summary();
  }
  async deleteJob(job) {
    if (job.deleteCloud) {
      if (!this.configured()) throw new Error('Cloud sharing is not configured.');
      const url = `${this.config.endpoint}/api/captures/${job.publicToken}?event=${encodeURIComponent(this.config.event)}`;
      const response = await this.fetch(url, { method: 'DELETE', headers: { authorization: `Bearer ${this.config.token}` }, signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`Delete service returned ${response.status}`);
    }
    await this.trash(job.folder);
    this.jobs = this.jobs.filter(item => item.id !== job.id);
  }
  async drain() {
    if (this.draining) return; this.draining = true;
    try {
      for (const job of [...this.jobs]) {
        if (job.status !== 'deleting' || (job.nextAttemptAt || 0) > this.now()) continue;
        try { await this.deleteJob(job); }
        catch (error) { job.attempts = (job.attempts || 0) + 1; job.lastError = String(error.message || error).slice(0, 300); job.nextAttemptAt = this.now() + RETRY[Math.min(job.attempts - 1, RETRY.length - 1)]; }
        await this.persist(); this.notify();
      }
      if (this.configured()) {
        for (const job of this.jobs) {
          Object.assign(job, shareLinks(this.config, job.publicToken));
          if (job.status === 'waiting-config') job.status = 'pending';
          if (job.status === 'pending' && (job.nextAttemptAt || 0) <= this.now()) {
            job.status = 'uploading'; await this.persist(); this.notify();
            // The QR URL is permanent from enqueue time, so print from the local
            // JPEG before any network or upload work can delay the receipt.
            await this.tryPrint(job);
            const uploadResult = this.upload(job).then(() => ({ ok: true }), error => ({ ok: false, error }));
            const result = await uploadResult;
            if (!result.ok && job.status !== 'deleting') { job.attempts = (job.attempts || 0) + 1; job.status = 'pending'; job.lastError = String(result.error.message || result.error).slice(0, 300); job.nextAttemptAt = this.now() + RETRY[Math.min(job.attempts - 1, RETRY.length - 1)]; }
            await this.persist(); this.notify();
          }
          if (job.status === 'uploaded') { await this.tryPrint(job); await this.persist(); this.notify(); }
        }
      }
    } finally { this.draining = false; }
  }
}

module.exports = { DeliveryQueue, cleanConfig, SHAREABLE };
