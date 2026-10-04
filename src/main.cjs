const { app, BrowserWindow, ipcMain, dialog, screen, protocol, session, shell, powerSaveBlocker, systemPreferences, Menu } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const { Library, saveCapture } = require('./core.cjs');
const { appleLookup, resolvePlaces } = require('./places.cjs');
const canon = require('./canon.cjs');
const { DeliveryQueue } = require('./delivery.cjs');
const { ReceiptPrinter } = require('./receipt.cjs');
const { LivePhotoFeed } = require('./live-feed.cjs');
const { localMediaResponse } = require('./media-response.cjs');
const { cleanEventProfile, loadEventProfile } = require('./event-config.cjs');
const exec = promisify(execFile);
let placeLookupRunning = false, placeLookupCancelled = false, canonChain = Promise.resolve();
let bundled = {};
try { bundled = require('../appliance.json'); } catch {}
const mode = process.argv.find(x => x.startsWith('--mode='))?.split('=')[1] || bundled.mode || 'home';
const test = process.env.PARTY_TEST === '1' && !app.isPackaged;
if (process.env.PARTY_DATA_DIR) app.setPath('userData', path.join(process.env.PARTY_DATA_DIR, 'preferences'));
else if (mode === 'booth') app.setPath('userData', path.join(app.getPath('appData'), 'Frame'));
if (test) { app.commandLine.appendSwitch('use-fake-ui-for-media-stream'); app.commandLine.appendSwitch('use-fake-device-for-media-stream'); }
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
protocol.registerSchemesAsPrivileged([{ scheme: 'party', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
let control, output, library, delivery, liveFeed, root, boothRoot, eventProfile, running = false, blocker, captureBusy = false, boothAwake = false, stopCanonPreview;
const outputMetrics = new Map();
const media = new Map();
const runId = `${Date.now().toString(36)}-${process.pid}`;
let diagnosticFile = null, playbackFile = null, diagnosticChain = Promise.resolve(), playbackChain = Promise.resolve(), lastOutputStatusAt = 0, lastOutputStatus = null, healthTimer = null;
const alertStates = new Map();
const ALERT_MESSAGES = {
  'test': '🖨️ Photobooth: test alert received. Camera battery and receipt-paper warnings are ready.',
  'camera-low': '🖨️ Photobooth: Canon RP battery is at 20% or below. Please replace or charge it soon.',
  'paper-low': '🖨️ Photobooth: receipt paper is running low. Please fit a fresh roll soon.',
  'paper-out': '🖨️ Photobooth: receipt paper has run out. Printing is paused until the roll is replaced.',
  'flash-problem': '🖨️ Photobooth: a photo may have missed its flash. The photo was kept; please check the Speedlite batteries.'
};
const IMESSAGE_SCRIPT = `on run argv
set destinationKind to item 1 of argv
set destinationValue to item 2 of argv
set alertText to item 3 of argv
tell application "Messages"
if destinationKind is "group" then
set matchingChats to every chat whose name is destinationValue
if (count matchingChats) is 0 then error "No Messages group named “" & destinationValue & "” was found."
if (count matchingChats) is greater than 1 then error "More than one Messages group is named “" & destinationValue & "”."
send alertText to item 1 of matchingChats
else
set targetService to first service whose service type = iMessage
set targetBuddy to buddy destinationValue of targetService
send alertText to targetBuddy
end if
end tell
end run`;
function safeDiagnosticValue(value) {
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (typeof value === 'bigint') return Number(value);
  return value;
}
function diagnostic(event, detail = {}) {
  if (!diagnosticFile) return;
  let line;
  try { line = `${JSON.stringify({ at: new Date().toISOString(), runId, event, ...detail }, (_key, value) => safeDiagnosticValue(value))}\n`; }
  catch { line = `${JSON.stringify({ at: new Date().toISOString(), runId, event, detail: 'Could not serialize diagnostic detail.' })}\n`; }
  diagnosticChain = diagnosticChain.then(() => fs.appendFile(diagnosticFile, line)).catch(() => {});
}
async function initialiseDiagnostics() {
  const folder = path.join(root, 'Diagnostics');
  diagnosticFile = path.join(folder, `${mode === 'loop' ? 'Loop' : 'Photobooth'}.log`);
  playbackFile = path.join(folder, 'Loop playback.jsonl');
  await fs.mkdir(folder, { recursive: true });
  try {
    const info = await fs.stat(diagnosticFile);
    if (info.size > 5 * 1024 * 1024) {
      await fs.rm(`${diagnosticFile}.previous`, { force: true });
      await fs.rename(diagnosticFile, `${diagnosticFile}.previous`);
    }
  } catch {}
  if (mode === 'loop') try {
    const info = await fs.stat(playbackFile);
    if (info.size > 10 * 1024 * 1024) {
      await fs.rm(`${playbackFile}.previous`, { force: true });
      await fs.rename(playbackFile, `${playbackFile}.previous`);
    }
  } catch {}
  diagnostic('run-start', { version: app.getVersion(), packaged: app.isPackaged, platform: process.platform, arch: process.arch });
}
function recordPlayback(value) {
  if (!playbackFile || mode !== 'loop' || !value || typeof value !== 'object') return;
  const allowed = ['event', 'playbackId', 'layout', 'tile', 'itemId', 'sourceId', 'name', 'kind', 'index', 'duration', 'requestedStart', 'requestedEnd', 'actualStart', 'actualEnd', 'excerptOrdinal', 'excerptCount', 'featured', 'reason'];
  const clean = { at: new Date().toISOString(), runId };
  for (const key of allowed) {
    const entry = value[key];
    if (typeof entry === 'string') clean[key] = entry.replace(/[\r\n\x00-\x1f]/g, ' ').slice(0, key === 'name' ? 300 : 80);
    else if (typeof entry === 'number' && Number.isFinite(entry)) clean[key] = Math.round(entry * 1000) / 1000;
  }
  playbackChain = playbackChain.then(() => fs.appendFile(playbackFile, `${JSON.stringify(clean)}\n`)).catch(() => {});
}
process.on('uncaughtExceptionMonitor', error => { diagnostic('uncaught-exception', { error }); });
process.on('unhandledRejection', reason => { diagnostic('unhandled-rejection', { error: reason instanceof Error ? reason : String(reason) }); });
app.on('child-process-gone', (_event, details) => diagnostic('child-process-gone', { details }));
const trusted = wc => wc && [control?.webContents.id, output?.webContents.id].includes(wc.id);
const controller = event => { if (!control || event.sender.id !== control.webContents.id) throw new Error('Not allowed'); };
function mediaURL(file) { const id = require('node:crypto').createHash('sha256').update(file).digest('hex'); media.set(id, file); return `party://media/${id}`; }
function state() { return { ...library.state, items: library.state.items.map(i => ({ ...i, url: mediaURL(path.join(library.root, 'media', i.file)) })) }; }
function playbackState() {
  const local = state(), items = local.items.map(item => outputMetrics.has(item.id) ? { ...item, ...outputMetrics.get(item.id) } : item);
  for (const photo of liveFeed?.items() || []) {
    const hash = require('node:crypto').createHash('sha256').update(photo.id).digest().readUInt32BE(0);
    items.splice(hash % (items.length + 1), 0, { ...photo, url: mediaURL(photo.filePath) });
  }
  return { ...local, items };
}
function emit(channel, data) { if (control && !control.isDestroyed()) control.webContents.send(channel, data); }
function sendOutput(channel, data) { if (output && !output.isDestroyed()) output.webContents.send(channel, data); }
function updatePower() { if ((running || captureBusy || boothAwake) && !blocker) blocker = powerSaveBlocker.start('prevent-display-sleep'); if (!running && !captureBusy && !boothAwake && blocker) { powerSaveBlocker.stop(blocker); blocker = null; } }
function makeWindow(options = {}) {
  const win = new BrowserWindow({ width: 1240, height: 850, minWidth: 860, minHeight: 650, backgroundColor: '#f1f0e9', titleBarStyle: 'hiddenInset', ...options, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.on('render-process-gone', (_event, details) => diagnostic('renderer-gone', { title: win.getTitle(), details }));
  win.webContents.on('unresponsive', () => diagnostic('renderer-unresponsive', { title: win.getTitle() }));
  win.webContents.on('responsive', () => diagnostic('renderer-responsive', { title: win.getTitle() }));
  win.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => diagnostic('load-failed', { title: win.getTitle(), code, description, url, isMainFrame }));
  win.webContents.on('console-message', (_event, levelOrDetails, message, line, sourceId) => {
    const details = typeof levelOrDetails === 'object' ? levelOrDetails : { level: levelOrDetails, message, lineNumber: line, sourceId };
    if (details.level === 'warning' || details.level === 'error' || Number(details.level) >= 2) diagnostic('renderer-console', { title: win.getTitle(), ...details });
  });
  return win;
}
const ownInstance = app.requestSingleInstanceLock();
if (!ownInstance) app.quit();
app.on('second-instance', () => { if (control) { if (control.isMinimized()) control.restore(); control.focus(); } });
app.whenReady().then(async () => {
  if (!ownInstance) return;
  root = process.env.PARTY_DATA_DIR || path.join(app.getPath('videos'), 'Party Appliances');
  boothRoot = path.join(root, 'Booth captures');
  const eventFile = process.env.PARTY_EVENT_CONFIG || path.join(app.getPath('appData'), 'Party Appliances', 'event.json');
  eventProfile = await loadEventProfile(eventFile).catch(error => { dialog.showErrorBox('Could not open event profile', error.message); return cleanEventProfile(); });
  await initialiseDiagnostics().catch(() => {});
  library = new Library(path.join(root, 'Loop library'));
  try {
    await library.init(); await fs.mkdir(boothRoot, { recursive: true });
    const printerScript = app.isPackaged ? path.join(process.resourcesPath, 'print-receipt.py') : path.join(__dirname, '..', 'scripts', 'print-receipt.py');
    const printerPython = process.env.FRAME_PRINTER_PYTHON || path.join(app.getPath('userData'), 'printer-venv', 'bin', 'python');
    delivery = new DeliveryQueue({ root: path.join(root, 'Delivery queue'), configFile: path.join(app.getPath('userData'), 'delivery.json'), printer: new ReceiptPrinter({ script: printerScript, python: printerPython, title: eventProfile.receiptTitle, venue: eventProfile.receiptVenue }), trash: folder => shell.trashItem(folder), onStatus: info => emit('delivery-status', info) });
    await delivery.init(); delivery.start();
    const derivedFeed = delivery.config.publicUrl && delivery.config.event ? `${delivery.config.publicUrl}/api/events/${delivery.config.event}/photos` : '';
    const feedEndpoint = process.env.LOOP_LIVE_FEED_ENDPOINT === 'off' ? '' : process.env.LOOP_LIVE_FEED_ENDPOINT || eventProfile.liveFeedUrl || derivedFeed || bundled.liveFeed || '';
    if (mode === 'loop' && feedEndpoint && !test) {
      liveFeed = new LivePhotoFeed({ root: path.join(library.root, 'booth-feed'), endpoint: feedEndpoint, onUpdate: info => { emit('live-feed-status', info); sendOutput('playlist', playbackState()); } });
      await liveFeed.init();
    }
  } catch(e) { dialog.showErrorBox('Could not open library', e.message); app.quit(); return; }
  protocol.handle('party', async request => {
    const url = new URL(request.url), file = media.get(url.pathname.slice(1));
    if (url.hostname !== 'media' || !file) return new Response('Not found', { status: 404 });
    try { return await localMediaResponse(file, request); } catch { return new Response('Not found', { status: 404 }); }
  });
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => callback(trusted(wc) && ['media', 'fullscreen'].includes(permission)));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => trusted(wc) && ['media', 'fullscreen'].includes(permission));
  // Renderers never load remote content. Explicit place preparation uses a native Apple helper.
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, cb) => cb({ cancel: true }));
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] }, { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] }, { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'togglefullscreen' }] }]));
  control = makeWindow({ title: mode === 'booth' ? 'Photobooth' : 'Loop — Projection player' });
  await control.loadFile(path.join(__dirname, 'index.html'), { query: { mode } });
  diagnostic('control-ready', { mode });
  if (mode === 'loop') {
    healthTimer = setInterval(() => {
      const metrics = app.getAppMetrics().map(entry => ({ type: entry.type, cpu: Math.round(entry.cpu.percentCPUUsage * 10) / 10, memoryMB: Math.round(entry.memory.workingSetSize / 1024) }));
      diagnostic('health', { running, outputAlive: !!output && !output.isDestroyed(), status: lastOutputStatus, processes: metrics });
    }, 5 * 60 * 1000);
    healthTimer.unref?.();
  }
  liveFeed?.start();
  control.on('close', e => { if (captureBusy) { e.preventDefault(); emit('close-blocked', 'Finish or cancel the capture before closing.'); } });
  control.on('closed', () => { diagnostic('control-closed'); clearInterval(healthTimer); delivery?.stop(); liveFeed?.stop(); stopCanonPreview?.(); output?.destroy(); app.quit(); });
  const changed = () => emit('displays-changed', displays());
  screen.on('display-added', changed); screen.on('display-removed', () => { output?.close(); changed(); });
});
function displays() { return screen.getAllDisplays().map(d => ({ id: d.id, label: `${d.label || (d.internal ? 'Built-in display' : 'External display')} · ${d.size.width} × ${d.size.height}`, internal: d.internal })); }
ipcMain.handle('bootstrap', async e => { if (!trusted(e.sender)) throw new Error('Not allowed'); const disk = await fs.statfs(root); return { mode, state: state(), displays: displays(), captureRoot: boothRoot, freeGB: Math.round(disk.bavail * disk.bsize / 1e9), delivery: delivery?.summary(), liveFeed: liveFeed?.summary(), event: eventProfile, optimization: library.optimizationSummary(), test }; });
ipcMain.handle('photo-luts', async e => {
  if (!trusted(e.sender)) throw new Error('Not allowed');
  const definitions = [
    { id: 'warm-film', name: 'Warm film', file: 'warm-film.cube', grain: 3.2 },
    { id: 'soft-neutral', name: 'Soft neutral', file: 'soft-neutral.cube', grain: 1.4 }
  ];
  const loaded = [];
  for (const definition of definitions) {
    try { loaded.push({ ...definition, data: await fs.readFile(path.join(__dirname, 'luts', definition.file), 'utf8') }); }
    catch (error) { diagnostic('lut-unavailable', { id: definition.id, error }); }
  }
  return loaded;
});
ipcMain.handle('still-camera-status', async e => {
  controller(e); if (test) return { available: true, connected: true, model: 'Canon EOS RP', message: 'Canon EOS RP connected for tethered stills.' };
  return withCanon(async () => {
    let result = await canon.status();
    if (result.reason !== 'driver-unavailable') return result;
    const released = await canon.releaseCameraApps();
    if (released.closed) result = await canon.status();
    if (result.connected) return { ...result, releasedCameraApps: released.closed };
    const message = canon.otherUserMessage(released.otherUsers);
    return message ? { ...result, reason: 'other-user', otherUsers: released.otherUsers, message } : result;
  });
});
ipcMain.handle('prepare-still-camera', async e => {
  controller(e); if (test) return { continuousAF: false, captureTarget: 'Memory card' };
  return withCanon(async () => {
    try { return await canon.prepare(); }
    catch (firstError) {
      if (!/another app is using the camera/i.test(firstError.message)) throw firstError;
      const released = await canon.releaseCameraApps(), message = canon.otherUserMessage(released.otherUsers);
      if (message) throw new Error(message);
      if (!released.closed) throw firstError;
      return canon.prepare();
    }
  });
});
async function stopPreviewProcess() {
  const stop = stopCanonPreview; stopCanonPreview = null;
  if (stop) await stop();
}
ipcMain.handle('start-still-preview', async e => { controller(e); if (test) return true; return withCanon(async () => { await stopPreviewProcess(); await canon.previewSettings(undefined, undefined, { onRetry: detail => diagnostic('still-preview-setup-retry', detail) }); emit('still-health', await canon.health()); stopCanonPreview = await canon.previewStream(frame => emit('still-preview-frame', frame), error => emit('still-preview-error', error.message)); return true; }); });
ipcMain.handle('stop-still-preview', async e => { controller(e); return withCanon(stopPreviewProcess); });
ipcMain.handle('rest-still-camera', async e => { controller(e); if (test) return true; return withCanon(async () => { await stopPreviewProcess(); return canon.rest(); }); });
ipcMain.handle('focus-still', async (e, exposure) => { controller(e); if (test) return true; return withCanon(async () => { await stopPreviewProcess(); return canon.focus(undefined, undefined, exposure); }); });
const testJpeg = () => Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAAgACADAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAQG/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AsrHogAAAAAAAAAAAAAAH/9k=', 'base64');
const withCanon = task => { const result = canonChain.then(task); canonChain = result.catch(() => {}); return result; };
ipcMain.handle('still-preview', async e => { controller(e); return test ? testJpeg() : withCanon(() => canon.preview()); });
ipcMain.handle('printer-status', async e => { controller(e); return delivery?.printer ? delivery.printer.status() : { present: false, ready: false, message: 'Receipt printer is unavailable.' }; });
ipcMain.handle('host-alert', async (e, request = {}) => {
  controller(e);
  const kind = String(request.kind || ''), active = request.active === true, recipient = String(request.recipient || '').trim();
  if (!Object.hasOwn(ALERT_MESSAGES, kind)) throw new Error('Unknown alert');
  if (!active) { alertStates.delete(kind); return { sent: false, cleared: true }; }
  if (!recipient || recipient.length > 160 || /[\r\n]/.test(recipient)) return { sent: false, configured: false };
  const previous = alertStates.get(kind), now = Date.now();
  if (previous?.recipient === recipient && (previous.sent || now - previous.attemptedAt < 15 * 60 * 1000)) return { sent: false, duplicate: true, error: previous.error || null };
  try {
    const group = recipient.toLowerCase().startsWith('group:'), destination = group ? recipient.slice(recipient.indexOf(':') + 1).trim() : recipient;
    if (!destination) return { sent: false, configured: false };
    if (!test) await exec('/usr/bin/osascript', ['-e', IMESSAGE_SCRIPT, group ? 'group' : 'person', destination, ALERT_MESSAGES[kind]], { timeout: 15000, maxBuffer: 1024 * 1024 });
    alertStates.set(kind, { recipient, attemptedAt: now, sent: true }); diagnostic('host-alert-sent', { kind }); return { sent: true };
  } catch (error) {
    const message = String(error.stderr || error.message || error).replace(/\s+/g, ' ').trim().slice(0, 240);
    alertStates.set(kind, { recipient, attemptedAt: now, sent: false, error: message }); diagnostic('host-alert-failed', { kind, error }); return { sent: false, error: message };
  }
});
ipcMain.handle('capture-still', async (e, request = {}) => {
  controller(e);
  if (test) return { model: 'Canon EOS RP', files: [{ name: 'original.jpg', data: testJpeg() }] };
  const ambientFallback = request?.ambientFallback === true;
  const iso = Number(request?.iso);
  return withCanon(async () => { await stopPreviewProcess(); if (ambientFallback) await canon.ambientFallback(undefined, undefined, { iso }); return canon.capture(); });
});
ipcMain.handle('import', async e => { controller(e); const result = await dialog.showOpenDialog(control, { title: 'Choose photos and videos', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Photos and videos', extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'mp4', 'mov', 'm4v', 'webm'] }] }); if (result.canceled) return null; const data = await library.import(result.filePaths); return { ...data, state: state() }; });
ipcMain.handle('playlist', async (e, ids, settings) => { controller(e); await library.update(ids, settings); sendOutput('playlist', playbackState()); return state(); });
ipcMain.handle('remove-media', async (e, id) => {
  controller(e); if (running) throw new Error('Close the projection before deleting media.');
  const item = await library.remove(String(id || '')), file = path.join(library.root, 'media', item.file);
  try { await shell.trashItem(file); } catch (error) { diagnostic('media-trash-failed', { id: item.id, file, error }); }
  sendOutput('playlist', playbackState()); return state();
});
ipcMain.handle('remove-media-many', async (e, ids) => {
  controller(e); if (running) throw new Error('Close the projection before deleting media.');
  const removed = await library.removeMany((ids || []).map(id => String(id || '')));
  for (const item of removed) {
    const file = path.join(library.root, 'media', item.file);
    try { await shell.trashItem(file); } catch (error) { diagnostic('media-trash-failed', { id: item.id, file, error }); }
  }
  sendOutput('playlist', playbackState()); return state();
});
ipcMain.handle('scan-content-hashes', async e => {
  controller(e); if (running) throw new Error('Close the projection before finding duplicates.');
  const result = await library.scanContentHashes(info => emit('duplicate-progress', info));
  return { ...result, state: state() };
});
ipcMain.handle('media-details', async (e, id, details) => { controller(e); await library.updateDetails(String(id || ''), details); sendOutput('playlist', playbackState()); return state(); });
ipcMain.handle('media-metrics', async (e, entries) => { controller(e); return library.cacheMetrics(entries); });
ipcMain.handle('optimise-videos', async e => {
  controller(e); if (running) throw new Error('Close the projection before optimising videos.');
  const candidates = library.optimizationSummary().items, errors = []; let completed = 0, savedBytes = 0;
  for (const candidate of candidates) {
    const item = library.state.items.find(entry => entry.id === candidate.id); if (!item) continue;
    emit('optimise-progress', { running: true, completed, total: candidates.length, name: item.name });
    const source = path.join(library.root, 'media', item.file), temp = path.join(library.root, 'media', `${item.id}.optimising.m4v`), finalName = `${item.id}.playback.m4v`, final = path.join(library.root, 'media', finalName);
    try {
      await fs.rm(temp, { force: true });
      await exec('/usr/bin/avconvert', ['--source', source, '--preset', 'Preset1920x1080', '--output', temp, '--replace'], { maxBuffer: 4 * 1024 * 1024 });
      const converted = await fs.stat(temp);
      if (!converted.size || converted.size >= item.bytes * .9) { await fs.rm(temp, { force: true }); errors.push(`${item.name}: the 1080p copy was not meaningfully smaller`); }
      else { await fs.rm(final, { force: true }); await fs.rename(temp, final); await library.useOptimized(item.id, finalName, converted.size); savedBytes += item.bytes - converted.size; }
    } catch (error) { await fs.rm(temp, { force: true }).catch(() => {}); await fs.rm(final, { force: true }).catch(() => {}); errors.push(`${item.name}: ${error.message}`); }
    completed++; emit('optimise-progress', { running: true, completed, total: candidates.length, name: item.name });
  }
  const result = { state: state(), summary: library.optimizationSummary(), completed, savedBytes, errors };
  emit('optimise-progress', { running: false, ...result }); return result;
});
ipcMain.handle('lookup-places', async e => {
  controller(e); if (placeLookupRunning) throw new Error('Place lookup is already running.');
  placeLookupRunning = true; placeLookupCancelled = false;
  try {
    const helper = app.isPackaged ? path.join(process.resourcesPath, 'bin', 'resolve-place') : path.join(__dirname, '..', 'bin', 'resolve-place');
    const result = await resolvePlaces(library, point => appleLookup(helper, point), info => { emit('place-progress', info); sendOutput('playlist', playbackState()); }, () => placeLookupCancelled);
    return { ...result, state: state() };
  } finally { placeLookupRunning = false; }
});
ipcMain.handle('cancel-places', e => { controller(e); placeLookupCancelled = true; });
ipcMain.handle('output', async (e, displayId, metrics = {}) => {
  controller(e);
  outputMetrics.clear();
  const knownIds = new Set(library.state.items.map(item => item.id));
  if (metrics && typeof metrics === 'object' && !Array.isArray(metrics)) for (const [id, value] of Object.entries(metrics)) {
    if (!knownIds.has(id) || !value || typeof value !== 'object') continue;
    const clean = {};
    if (Number.isFinite(value.duration) && value.duration > 0 && value.duration < 24 * 60 * 60) clean.duration = value.duration;
    if (Number.isFinite(value.width) && value.width > 0 && value.width < 100000) clean.width = value.width;
    if (Number.isFinite(value.height) && value.height > 0 && value.height < 100000) clean.height = value.height;
    if (Object.keys(clean).length) outputMetrics.set(id, clean);
  }
  if (!playbackState().items.length) throw new Error('Add some photos or wait for a booth photograph first.');
  output?.destroy();
  const display = screen.getAllDisplays().find(d => d.id === displayId);
  if (!display) throw new Error('That display is no longer connected.');
  output = makeWindow({ ...display.bounds, minWidth: 100, minHeight: 100, title: 'Loop — Output', frame: false, titleBarStyle: 'default', backgroundColor: '#000000', fullscreen: true });
  output.on('closed', () => { diagnostic('output-closed'); output = null; running = false; updatePower(); emit('output-closed'); });
  await output.loadFile(path.join(__dirname, 'output.html'), test ? { query: { test: '1' } } : undefined);
  running = true; updatePower();
  diagnostic('output-started', { displayId, itemCount: playbackState().items.length, settings: library.state.settings });
  sendOutput('play', playbackState());
  return true;
});
ipcMain.handle('transport', (e, action) => { controller(e); if (action === 'close') { output?.close(); return; } if (!['pause', 'next', 'previous', 'blackout'].includes(action)) throw new Error('Unknown action'); sendOutput('transport', action); });
ipcMain.handle('output-status', (e, status) => {
  if (e.sender.id !== output?.webContents.id) throw new Error('Not allowed');
  lastOutputStatus = { itemId: status?.itemId || null, paused: !!status?.paused, blackout: !!status?.blackout, error: status?.error || null };
  const now = Date.now();
  if (status?.error || now - lastOutputStatusAt >= 30000) { diagnostic(status?.error ? 'playback-warning' : 'playback-heartbeat', lastOutputStatus); lastOutputStatusAt = now; }
  emit('output-status', status);
});
ipcMain.handle('playback-observation', (e, observation) => {
  if (e.sender.id !== output?.webContents.id) throw new Error('Not allowed');
  recordPlayback(observation); return true;
});
ipcMain.handle('fullscreen', e => { controller(e); control.setFullScreen(!control.isFullScreen()); return control.isFullScreen(); });
ipcMain.handle('media-permission', async (e, kind) => { controller(e); if (kind !== 'camera') return false; if (test || process.platform !== 'darwin') return true; return systemPreferences.askForMediaAccess(kind); });
ipcMain.handle('booth-active', (e, active, awake) => { controller(e); captureBusy = !!active; if (awake !== undefined) boothAwake = !!awake; updatePower(); });
ipcMain.handle('save-capture', async (e, capture) => {
  controller(e); const result = await saveCapture(boothRoot, capture); let deliveryState = delivery?.summary();
  try { deliveryState = await delivery?.enqueue(result); }
  catch (error) { deliveryState = { ...(delivery?.summary() || {}), attention: (delivery?.summary().attention || 0) + 1, message: `Saved locally; sharing queue needs attention: ${error.message}` }; emit('delivery-status', deliveryState); }
  return { ...result, urls: result.files.map(mediaURL), delivery: deliveryState };
});
ipcMain.handle('delivery-retry', async (e, id) => { controller(e); return delivery.retry(String(id || '')); });
ipcMain.handle('delivery-delete', async (e, id) => { controller(e); return delivery.remove(String(id || '')); });
ipcMain.handle('receipt-history', async e => {
  controller(e);
  const items = await delivery.receiptHistory();
  return items.map(item => ({ ...item, image: undefined, thumbnail: undefined, imageUrl: mediaURL(item.thumbnail) }));
});
ipcMain.handle('reprint-receipt', async (e, id) => {
  controller(e); diagnostic('receipt-reprint-start', { id: String(id || '') });
  try { const result = await delivery.reprint(String(id || '')); diagnostic('receipt-reprint-complete', { id: result.id }); return result; }
  catch (error) { diagnostic('receipt-reprint-failed', { id: String(id || ''), error }); throw error; }
});
ipcMain.handle('open-share', async (e, value) => {
  controller(e); const url = new URL(String(value || ''));
  let expected; try { expected = new URL(delivery?.config.publicUrl || eventProfile.publicUrl); } catch {}
  const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if ((!local && url.protocol !== 'https:') || !expected || url.origin !== expected.origin || !/^[a-f0-9]{32}$/.test(url.searchParams.get('photo') || '')) throw new Error('Invalid photo link');
  await shell.openExternal(url.toString()); return true;
});
ipcMain.handle('reveal', async (e, which) => {
  controller(e);
  if (which === 'playback') { await fs.appendFile(playbackFile, ''); shell.showItemInFolder(playbackFile); return; }
  const dest = which === 'captures' ? boothRoot : library.root; await shell.openPath(dest);
});
ipcMain.handle('preferences', async (e, value) => { controller(e); const file = path.join(app.getPath('userData'), 'booth.json'); if (value !== undefined) { await require('./core.cjs').atomicWrite(file, JSON.stringify(value)); return value; } try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return {}; } });
if (test) ipcMain.handle('test-import', async (e, files) => { controller(e); await library.import(files); return state(); });
app.on('window-all-closed', () => { diagnostic('all-windows-closed'); clearInterval(healthTimer); delivery?.stop(); app.quit(); });
app.on('before-quit', () => diagnostic('run-stop'));
