const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const exifr = require('exifr');
const exec = promisify(execFile);

const binaries = ['/opt/homebrew/bin/gphoto2', '/usr/local/bin/gphoto2'];
const CAMERA_APP_PATTERNS = [
  /\/Photos\.app\/Contents\/MacOS\/Photos(?:\s|$)/i,
  /\/Image Capture\.app\/Contents\/MacOS\/Image Capture(?:\s|$)/i,
  /\/EOS Utility[^/]*\.app\/Contents\/MacOS\//i,
  /\/EULauncher(?:\s|$)/i,
  /\/ptpcamerad(?:\s|$)/i,
  /\/PTPCamera(?:\s|$)/i,
  /\/icdd(?:\s|$)/i
];

function parseCameraBlockers(output = '', currentUser = os.userInfo().username) {
  const blockers = [];
  for (const line of String(output).split(/\r?\n/)) {
    const match = /^\s*(\S+)\s+(\d+)\s+(.+)$/.exec(line); if (!match) continue;
    const [, user, pid, command] = match;
    if (!CAMERA_APP_PATTERNS.some(pattern => pattern.test(command))) continue;
    blockers.push({ user, pid: Number(pid), command, own: user === currentUser });
  }
  return blockers;
}

async function cameraBlockers(run = exec, currentUser = os.userInfo().username) {
  if (process.platform !== 'darwin') return [];
  try {
    const { stdout } = await run('/bin/ps', ['-axo', 'user=,pid=,args='], { timeout: 5000, maxBuffer: 2 * 1024 * 1024 });
    return parseCameraBlockers(stdout, currentUser);
  } catch { return []; }
}

async function releaseCameraApps(run = exec, currentUser = os.userInfo().username) {
  const before = await cameraBlockers(run, currentUser), own = before.filter(item => item.own);
  for (const blocker of own) {
    try { await run('/bin/kill', ['-TERM', String(blocker.pid)], { timeout: 3000, maxBuffer: 64 * 1024 }); } catch {}
  }
  if (own.length) await new Promise(resolve => setTimeout(resolve, 800));
  const after = await cameraBlockers(run, currentUser);
  for (const blocker of after.filter(item => item.own && /\/(?:ptpcamerad|PTPCamera|icdd)(?:\s|$)/i.test(item.command))) {
    try { await run('/bin/kill', ['-KILL', String(blocker.pid)], { timeout: 3000, maxBuffer: 64 * 1024 }); } catch {}
  }
  const final = own.length ? await cameraBlockers(run, currentUser) : after;
  return { closed: own.length, remainingOwn: final.filter(item => item.own), otherUsers: [...new Set(final.filter(item => !item.own).map(item => item.user))] };
}

function otherUserMessage(users = []) {
  if (!users.length) return null;
  const names = users.map(name => name.charAt(0).toUpperCase() + name.slice(1)).join(', ');
  return `The Canon is being held by ${names}'s macOS session. Log ${names} out completely—switching users is not enough—then reconnect the camera.`;
}

async function executable() {
  for (const file of binaries) { try { await fs.access(file); return file; } catch {} }
  return null;
}

function parseDetected(output = '') {
  return String(output).split(/\r?\n/).map(line => line.trim()).find(line => /^Canon EOS RP\s{2,}|^Canon EOS RP\t/.test(line))?.split(/\s{2,}|\t/)[0] || null;
}

function parseUsbPresence(output = '') {
  const text = String(output);
  return /Canon|EOS RP|"idVendor"\s*=\s*0x0?4a9|"USB Vendor Name"\s*=\s*"Canon"/i.test(text);
}

async function usbPresence(run = exec) {
  if (process.platform !== 'darwin') return null;
  try {
    const { stdout } = await run('/usr/sbin/ioreg', ['-p', 'IOUSB', '-l', '-w0'], { timeout: 5000, maxBuffer: 4 * 1024 * 1024 });
    return parseUsbPresence(stdout);
  } catch { return null; }
}

async function status(run = exec, usbRun = exec, binaryOverride = null) {
  const binary = binaryOverride || await executable();
  if (!binary) return { available: false, connected: false, message: 'Install gphoto2 to use Canon still capture.' };
  try {
    const { stdout } = await run(binary, ['--auto-detect'], { timeout: 12000, maxBuffer: 1024 * 1024 });
    const model = parseDetected(stdout);
    if (model) return { available: true, connected: true, model, message: `${model} connected for tethered stills.` };
    const visibleOnUsb = await usbPresence(usbRun);
    if (visibleOnUsb === false) return { available: true, connected: false, usbVisible: false, reason: 'usb-missing', message: 'The Mac cannot see a Canon USB device. Switch the RP off, reconnect it directly with a data cable, then switch it on.' };
    if (visibleOnUsb === true) return { available: true, connected: false, usbVisible: true, reason: 'driver-unavailable', message: 'The Mac sees the Canon, but cannot open it. Disable the camera’s Wi-Fi connection and close EOS Utility, Photos and Image Capture.' };
    return { available: true, connected: false, reason: 'not-detected', message: 'Canon RP not detected. Connect USB, switch it on, and close EOS Utility.' };
  } catch (error) { return { available: true, connected: false, message: `Could not check the Canon RP: ${cleanError(error)}` }; }
}

function parseHealth(summary) {
  const match = /Battery Level[^\n]*?value:\s*(\d+)%/i.exec(summary);
  const battery = match ? Number(match[1]) : null;
  return { battery: battery !== null && battery >= 0 && battery <= 100 ? battery : null, checkedAt: Date.now() };
}
function parseFlashStatus(value) {
  if (typeof value !== 'string') return null;
  if (/^flash fired/i.test(value)) return true;
  if (/^flash did not fire/i.test(value)) return false;
  return null;
}
async function health(run = exec, binaryOverride = null) {
  const binary = binaryOverride || await executable();
  try { const { stdout } = await run(binary, ['--summary'], { timeout: 6000, maxBuffer: 1024 * 1024 }); return parseHealth(stdout); }
  catch { return { battery: null, checkedAt: Date.now() }; }
}
async function prepare(run = exec, binaryOverride = null) {
  const binary = binaryOverride || await executable();
  if (!binary) throw new Error('gphoto2 is not installed.');
  try {
    await run(binary, [
      '--set-config', '/main/capturesettings/continuousaf=Off',
      '--set-config', '/main/settings/autopoweroff=30',
      '--set-config', '/main/settings/capturetarget=Memory card',
      '--set-config', '/main/imgsettings/imageformat=M',
      '--set-config', '/main/imgsettings/imageformatsd=M'
    ], { timeout: 12000, maxBuffer: 1024 * 1024 });
    return { continuousAF: false, autoPowerOff: 30, captureTarget: 'Memory card', imageFormat: 'M' };
  } catch (error) { throw new Error(`Canon RP setup failed: ${cleanError(error)}`); }
}

function transientConfigError(error) {
  return /\/main not found in configuration tree|configuration tree.*(?:unavailable|not found)|PTP I\/O error|device busy/i.test(`${error?.stderr || ''}\n${error?.message || ''}`);
}

async function previewSettings(run = exec, binaryOverride = null, options = {}) {
  const binary = binaryOverride || await executable();
  if (!binary) throw new Error('gphoto2 is not installed.');
  const args = [
      '--set-config', '/main/actions/eosremoterelease=Release',
      '--set-config', '/main/settings/output=PC',
      '--set-config', '/main/actions/viewfinder=1',
      '--set-config', '/main/capturesettings/autoexposuremode=AV',
      '--set-config', '/main/capturesettings/aperture=4',
      '--set-config', '/main/imgsettings/iso=Auto',
      '--set-config', '/main/imgsettings/whitebalance=AWB White'
  ];
  const retryDelays = options.retryDelays || [350, 750, 1500, 2500];
  for (let attempt = 0; ; attempt++) {
    try {
      await run(binary, args, { timeout: 12000, maxBuffer: 1024 * 1024 });
      return true;
    } catch (error) {
      if (!transientConfigError(error) || attempt >= retryDelays.length) throw new Error(`Canon RP live-view setup failed: ${cleanError(error)}`);
      const wait = retryDelays[attempt];
      await options.onRetry?.({ attempt: attempt + 1, wait, error: cleanError(error) });
      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }
}

async function rest(run = exec, binaryOverride = null) {
  const binary = binaryOverride || await executable();
  if (!binary) throw new Error('gphoto2 is not installed.');
  try {
    await run(binary, [
      '--set-config', '/main/actions/eosremoterelease=Release',
      '--set-config', '/main/actions/viewfinder=0',
      '--set-config', '/main/settings/output=Off'
    ], { timeout: 12000, maxBuffer: 1024 * 1024 });
    return true;
  } catch (error) { throw new Error(`Canon RP rest failed: ${cleanError(error)}`); }
}

async function focus(run = exec, binaryOverride = null, exposure = {}) {
  const binary = binaryOverride || await executable();
  if (!binary) throw new Error('gphoto2 is not installed.');
  const iso = [200, 400, 800].includes(Number(exposure.iso)) ? Number(exposure.iso) : 400;
  try {
    await run(binary, [
      '--set-config', '/main/capturesettings/autoexposuremode=Manual',
      '--set-config', '/main/capturesettings/shutterspeed=1/80',
      '--set-config', '/main/capturesettings/aperture=5.6',
      '--set-config', `/main/imgsettings/iso=${iso}`,
      '--set-config', '/main/imgsettings/whitebalance=Flash',
      '--set-config', '/main/actions/eosremoterelease=Press Half AF'
    ], { timeout: 15000, maxBuffer: 1024 * 1024 });
    return true;
  } catch (error) { throw new Error(`Canon RP autofocus failed: ${cleanError(error)}`); }
}

async function ambientFallback(run = exec, binaryOverride = null, exposure = {}) {
  const binary = binaryOverride || await executable();
  if (!binary) throw new Error('gphoto2 is not installed.');
  const iso = [100, 200, 400, 800, 1600, 3200, 6400].includes(Number(exposure.iso)) ? Number(exposure.iso) : 800;
  try {
    await run(binary, [
      '--set-config', '/main/capturesettings/autoexposuremode=Manual',
      '--set-config', '/main/capturesettings/shutterspeed=1/60',
      '--set-config', '/main/capturesettings/aperture=2.8',
      '--set-config', `/main/imgsettings/iso=${iso}`,
      '--set-config', '/main/imgsettings/whitebalance=AWB White'
    ], { timeout: 12000, maxBuffer: 1024 * 1024 });
    return { shutter: '1/60', aperture: 2.8, iso };
  } catch (error) { throw new Error(`Canon RP ambient fallback setup failed: ${cleanError(error)}`); }
}

function cleanError(error) {
  const text = `${error?.stderr || ''}\n${error?.message || ''}`;
  if (/\/main not found in configuration tree/i.test(text)) return 'the camera is still waking or finishing its previous operation.';
  if (/Could not claim the USB device|resource busy|claim interface/i.test(text)) return 'another app is using the camera. Close EOS Utility and Photos.';
  if (/No camera found/i.test(text)) return 'camera not found.';
  return text.replace(/\s+/g, ' ').trim().slice(0, 220) || 'unknown camera error.';
}

async function capture(run = exec, binaryOverride = null) {
  const binary = binaryOverride || await executable();
  if (!binary) throw new Error('gphoto2 is not installed.');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'frame-rp-'));
  try {
    await run(binary, ['--set-config', '/main/actions/eosremoterelease=Press Full MF', '--wait-event-and-download=CAPTURECOMPLETE', '--keep', '--force-overwrite', '--filename', 'capture.%C'], { cwd: dir, timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
    // Photobooth deliberately runs the RP in JPEG-only mode. Ignore any unexpected
    // RAW sidecar returned from a stale in-camera setting.
    const names = (await fs.readdir(dir)).filter(name => /\.jpe?g$/i.test(name));
    const jpegName = names.find(name => /\.jpe?g$/i.test(name));
    if (!jpegName) throw new Error('The RP did not return a JPEG. Reconnect it so Photobooth can restore JPEG-only capture.');
    const files = [];
    for (const name of names) {
      const data = await fs.readFile(path.join(dir, name));
      if (!data.length) continue;
      if (/\.jpe?g$/i.test(name) && (data[0] !== 0xff || data[1] !== 0xd8)) throw new Error('The RP returned a damaged JPEG.');
      files.push({ name: 'original.jpg', data });
    }
    const total = files.reduce((sum, file) => sum + file.data.length, 0);
    if (!files.length || total > 180 * 1024 * 1024) throw new Error('The RP returned an invalid or unexpectedly large capture.');
    let flash = null, flashFired = null;
    try {
      const jpeg = files.find(file => file.name === 'original.jpg');
      if (jpeg) { flash = (await exifr.parse(jpeg.data, ['Flash']))?.Flash || null; flashFired = parseFlashStatus(flash); }
    } catch {}
    return { model: 'Canon EOS RP', files, flash, flashFired };
  } catch (error) { throw new Error(`Canon RP capture failed: ${cleanError(error)}`); }
  finally {
    try { await run(binary, ['--set-config', '/main/actions/eosremoterelease=Release'], { timeout: 12000, maxBuffer: 1024 * 1024 }); } catch {}
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function preview(run = exec, binaryOverride = null) {
  const binary = binaryOverride || await executable();
  if (!binary) throw new Error('gphoto2 is not installed.');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'frame-rp-preview-'));
  try {
    await run(binary, ['--capture-preview', '--force-overwrite', '--filename', 'preview.jpg'], { cwd: dir, timeout: 20000, maxBuffer: 1024 * 1024 });
    const previewName = (await fs.readdir(dir)).find(name => /\.jpe?g$/i.test(name));
    if (!previewName) throw new Error('The RP did not return a preview JPEG.');
    const data = await fs.readFile(path.join(dir, previewName));
    if (data.length < 100 || data[0] !== 0xff || data[1] !== 0xd8) throw new Error('The RP returned an invalid preview.');
    return data;
  } catch (error) { throw new Error(`Canon RP preview failed: ${cleanError(error)}`); }
  finally { await fs.rm(dir, { recursive: true, force: true }); }
}

async function previewStream(onFrame, onError = () => {}, spawnProcess = spawn, binaryOverride = null) {
  const binary = binaryOverride || await executable();
  if (!binary) throw new Error('gphoto2 is not installed.');
  const child = spawnProcess(binary, ['--capture-movie=3600s', '--stdout'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let bytes = Buffer.alloc(0), stderr = '', stopped = false, lastSent = 0;
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4096); });
  child.stdout.on('data', chunk => {
    bytes = Buffer.concat([bytes, chunk]);
    while (true) {
      const start = bytes.indexOf(Buffer.from([0xff, 0xd8]));
      if (start < 0) { if (bytes.length > 1024 * 1024) bytes = Buffer.alloc(0); return; }
      const end = bytes.indexOf(Buffer.from([0xff, 0xd9]), start + 2);
      if (end < 0) { if (start) bytes = bytes.subarray(start); return; }
      const frame = bytes.subarray(start, end + 2); bytes = bytes.subarray(end + 2);
      const now = Date.now();
      if (now - lastSent >= 40) { lastSent = now; onFrame(Buffer.from(frame)); }
    }
  });
  child.on('error', error => { if (!stopped) onError(new Error(`Canon RP preview failed: ${cleanError(error)}`)); });
  child.on('close', code => { if (!stopped) onError(new Error(`Canon RP preview stopped: ${cleanError({ stderr })}`)); });
  return async () => {
    if (stopped) return; stopped = true;
    await new Promise(resolve => {
      if (child.exitCode !== null) return resolve();
      child.once('close', resolve); child.kill('SIGINT');
      setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 1500);
    });
  };
}

module.exports = { health, parseHealth, parseFlashStatus, parseDetected, parseUsbPresence, parseCameraBlockers, cameraBlockers, releaseCameraApps, otherUserMessage, status, prepare, previewSettings, transientConfigError, rest, focus, ambientFallback, capture, preview, previewStream, cleanError };
