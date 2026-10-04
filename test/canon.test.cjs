const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { parseDetected, parseUsbPresence, parseFlashStatus, parseCameraBlockers, otherUserMessage, cleanError, status, prepare, previewSettings, transientConfigError, rest, focus, ambientFallback, capture, preview } = require('../src/canon.cjs');

test('Canon detector selects the RP and ignores headings and other cameras', () => {
  assert.equal(parseDetected('Model                          Port\n----------------------------------------------------------\nCanon EOS RP                   usb:001,004\n'), 'Canon EOS RP');
  assert.equal(parseDetected('Canon EOS R6                   usb:001,004\n'), null);
  assert.equal(parseDetected(''), null);
});

test('Canon USB presence distinguishes a missing cable from a driver handoff problem', async () => {
  assert.equal(parseUsbPresence('+-o Canon Digital Camera@00100000\n  "idVendor" = 0x04a9'), true);
  assert.equal(parseUsbPresence('+-o USB3.0 Card Reader@00210000'), false);
  const noCamera = async () => ({ stdout: 'Model                          Port\n----------------------------------------------------------\n' });
  const noUsb = async () => ({ stdout: '+-o USB3.0 Card Reader@00210000' });
  const canonUsb = async () => ({ stdout: '+-o Canon Digital Camera@00100000' });
  assert.equal((await status(noCamera, noUsb)).reason, 'usb-missing');
  assert.equal((await status(noCamera, canonUsb)).reason, 'driver-unavailable');
});

test('Canon USB ownership errors become useful host instructions', () => {
  assert.match(cleanError({ stderr: 'Could not claim the USB device' }), /another app/);
  assert.match(cleanError({ stderr: 'No camera found' }), /not found/);
});

test('camera blocker detection separates this login from another active user', () => {
  const processes = [
    'owner 101 /usr/libexec/ptpcamerad',
    'guest 202 /System/Applications/Photos.app/Contents/MacOS/Photos',
    'owner 303 /System/Applications/Photos.app/Contents/PlugIns/PhotosReliveWidget.appex/Contents/MacOS/PhotosReliveWidget',
    'owner 404 /Applications/Frame.app/Contents/MacOS/Frame'
  ].join('\n');
  const blockers = parseCameraBlockers(processes, 'owner');
  assert.deepEqual(blockers.map(item => [item.user, item.pid, item.own]), [['owner', 101, true], ['guest', 202, false]]);
  assert.match(otherUserMessage(['guest']), /Log Guest out completely/);
});

test('Canon EXIF flash status distinguishes a fired and missed flash', () => {
  assert.equal(parseFlashStatus('Flash fired, compulsory flash mode'), true);
  assert.equal(parseFlashStatus('Flash did not fire'), false);
  assert.equal(parseFlashStatus(undefined), null);
});

test('Canon booth setup disables idle focusing and selects a faster medium JPEG', async () => {
  let args;
  const run = async (_binary, nextArgs) => { args = nextArgs; return { stdout: '' }; };
  assert.deepEqual(await prepare(run, '/fake/gphoto2'), { continuousAF: false, autoPowerOff: 30, captureTarget: 'Memory card', imageFormat: 'M' });
  assert.deepEqual(args, [
    '--set-config', '/main/capturesettings/continuousaf=Off',
    '--set-config', '/main/settings/autopoweroff=30',
    '--set-config', '/main/settings/capturetarget=Memory card',
    '--set-config', '/main/imgsettings/imageformat=M',
    '--set-config', '/main/imgsettings/imageformatsd=M'
  ]);
});

test('Canon pre-focus invokes autofocus before the shutter command', async () => {
  let args;
  const run = async (_binary, nextArgs) => { args = nextArgs; return { stdout: '' }; };
  assert.equal(await focus(run, '/fake/gphoto2'), true);
  assert.deepEqual(args, [
    '--set-config', '/main/capturesettings/autoexposuremode=Manual',
    '--set-config', '/main/capturesettings/shutterspeed=1/80',
    '--set-config', '/main/capturesettings/aperture=5.6',
    '--set-config', '/main/imgsettings/iso=400',
    '--set-config', '/main/imgsettings/whitebalance=Flash',
    '--set-config', '/main/actions/eosremoterelease=Press Half AF'
  ]);
});

test('Canon pre-focus accepts only the booth meter’s bounded ISO values', async () => {
  const calls = [];
  const run = async (_binary, args) => { calls.push(args); return { stdout: '' }; };
  await focus(run, '/fake/gphoto2', { iso: 800 });
  await focus(run, '/fake/gphoto2', { iso: 12800 });
  assert.ok(calls[0].includes('/main/imgsettings/iso=800'));
  assert.ok(calls[1].includes('/main/imgsettings/iso=400'));
});

test('ambient fallback uses a fast wide-aperture exposure without refocusing', async () => {
  let args;
  const run = async (_binary, nextArgs) => { args = nextArgs; return { stdout: '' }; };
  assert.deepEqual(await ambientFallback(run, '/fake/gphoto2', { iso: 200 }), { shutter: '1/60', aperture: 2.8, iso: 200 });
  assert.deepEqual(args, [
    '--set-config', '/main/capturesettings/autoexposuremode=Manual',
    '--set-config', '/main/capturesettings/shutterspeed=1/60',
    '--set-config', '/main/capturesettings/aperture=2.8',
    '--set-config', '/main/imgsettings/iso=200',
    '--set-config', '/main/imgsettings/whitebalance=AWB White'
  ]);
});

test('Canon live view automatically exposes ambient light independently of flash stills', async () => {
  let args;
  const run = async (_binary, nextArgs) => { args = nextArgs; return { stdout: '' }; };
  assert.equal(await previewSettings(run, '/fake/gphoto2'), true);
  assert.deepEqual(args, [
    '--set-config', '/main/actions/eosremoterelease=Release',
    '--set-config', '/main/settings/output=PC',
    '--set-config', '/main/actions/viewfinder=1',
    '--set-config', '/main/capturesettings/autoexposuremode=AV',
    '--set-config', '/main/capturesettings/aperture=4',
    '--set-config', '/main/imgsettings/iso=Auto',
    '--set-config', '/main/imgsettings/whitebalance=AWB White'
  ]);
});

test('Canon live view retries while a waking camera has no configuration tree', async () => {
  let attempts = 0, retries = 0;
  const run = async () => {
    attempts++;
    if (attempts < 3) throw { stderr: '*** Error *** /main not found in configuration tree.' };
    return { stdout: '' };
  };
  assert.equal(transientConfigError({ stderr: '/main not found in configuration tree' }), true);
  assert.equal(await previewSettings(run, '/fake/gphoto2', { retryDelays: [0, 0], onRetry: () => retries++ }), true);
  assert.equal(attempts, 3);
  assert.equal(retries, 2);
  assert.match(cleanError({ stderr: '/main not found in configuration tree' }), /still waking/);
});

test('Canon rest stops live view and turns off its display output', async () => {
  let args;
  const run = async (_binary, nextArgs) => { args = nextArgs; return { stdout: '' }; };
  assert.equal(await rest(run, '/fake/gphoto2'), true);
  assert.deepEqual(args, [
    '--set-config', '/main/actions/eosremoterelease=Release',
    '--set-config', '/main/actions/viewfinder=0',
    '--set-config', '/main/settings/output=Off'
  ]);
});

test('Canon capture keeps the SD copy and returns only JPEG even if a stale RAW sidecar appears', async () => {
  const calls = [];
  const run = async (_binary, passed, options) => { calls.push(passed); if (options.cwd) { await fs.writeFile(path.join(options.cwd, 'capture.JPG'), Buffer.from([255, 216, 255, 217])); await fs.writeFile(path.join(options.cwd, 'capture.CR3'), Buffer.from([1, 2, 3])); } return { stdout: '' }; };
  const result = await capture(run, '/fake/gphoto2');
  assert.ok(calls[0].includes('--keep')); assert.ok(calls[0].includes('--wait-event-and-download=CAPTURECOMPLETE')); assert.deepEqual(calls[1], ['--set-config', '/main/actions/eosremoterelease=Release']); assert.deepEqual(result.files.map(file => file.name), ['original.jpg']);
});

test('Canon preview returns a JPEG from its isolated transfer directory', async () => {
  const expected = Buffer.alloc(128, 7); expected[0] = 0xff; expected[1] = 0xd8;
  const run = async (_binary, _args, options) => { await fs.writeFile(path.join(options.cwd, 'thumb_preview.jpg'), expected); return { stdout: '' }; };
  assert.deepEqual(await preview(run, '/fake/gphoto2'), expected);
});

test('Battery telemetry distinguishes missing values and low battery', () => {
 const { parseHealth } = require('../src/canon.cjs');
 assert.equal(parseHealth('Battery Level (5001 ro u8 ): Enumeration [100,0,75,0,50] value: 20% (20)').battery,20);
 assert.equal(parseHealth('Battery Level: unknown').battery,null);
 assert.equal(parseHealth('Battery Level value: 255%').battery,null);
});
