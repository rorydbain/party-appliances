const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Library, saveCapture, cleanSettings, cleanManualDetails } = require('../src/core.cjs');
async function fixture(t) { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'party-test-')); t.after(() => fs.rm(root, { recursive: true, force: true })); return root; }
test('import is independent of originals, persists order and serializes changes', async t => {
  const root = await fixture(t), source = path.join(root, 'source.jpg'); await fs.writeFile(source, 'photo');
  const lib = new Library(path.join(root, 'library')); await lib.init();
  await Promise.all([lib.import([source]), lib.import([source])]);
  assert.equal(lib.state.items.length, 2); await fs.unlink(source);
  assert.equal(await fs.readFile(path.join(lib.root, 'media', lib.state.items[0].file), 'utf8'), 'photo');
  const ids = lib.state.items.map(i => i.id).reverse(); await lib.update(ids, { seconds: 10, sound: true });
  const reopened = new Library(lib.root); await reopened.init(); assert.deepEqual(reopened.state.items.map(i => i.id), ids); assert.equal(reopened.state.settings.seconds, 10);
  await assert.rejects(lib.update([ids[0], ids[0]], {}), /Invalid/);
  await lib.update([ids[1]], {}); assert.equal(lib.state.items.length, 1);
});
test('bad sources report errors without discarding usable files', async t => {
  const root = await fixture(t), good = path.join(root, 'good.png'), empty = path.join(root, 'empty.jpg'); await fs.writeFile(good, 'png'); await fs.writeFile(empty, '');
  const lib = new Library(path.join(root, 'library')); await lib.init(); const result = await lib.import([good, empty, path.join(root, 'missing.mp4'), 'bad.heic']); assert.equal(result.errors.length, 3); assert.equal(result.state.items.length, 1);
});
test('media dimensions and video duration are cached once in the library', async t => {
  const root = await fixture(t), image = path.join(root, 'image.jpg'), video = path.join(root, 'video.mp4');
  await fs.writeFile(image, 'image'); await fs.writeFile(video, 'video');
  const lib = new Library(path.join(root, 'library')); await lib.init(); await lib.import([image, video]);
  const [imageItem, videoItem] = lib.state.items;
  await lib.cacheMetrics([{ id: imageItem.id, width: 4000, height: 3000, duration: 99 }, { id: videoItem.id, width: 1080, height: 1920, duration: 12.5 }]);
  const reopened = new Library(lib.root); await reopened.init();
  assert.deepEqual({ width: reopened.state.items[0].width, height: reopened.state.items[0].height, duration: reopened.state.items[0].duration }, { width: 4000, height: 3000, duration: undefined });
  assert.deepEqual({ width: reopened.state.items[1].width, height: reopened.state.items[1].height, duration: reopened.state.items[1].duration }, { width: 1080, height: 1920, duration: 12.5 });
});
test('removing one library item persists the remaining sequence and identifies its copied file', async t => {
  const root = await fixture(t), first = path.join(root, 'first.jpg'), second = path.join(root, 'second.jpg');
  await fs.writeFile(first, 'first'); await fs.writeFile(second, 'second');
  const lib = new Library(path.join(root, 'library')); await lib.init(); await lib.import([first, second]);
  const removed = await lib.remove(lib.state.items[0].id); assert.equal(removed.name, 'first.jpg'); assert.equal(lib.state.items.length, 1);
  const reopened = new Library(lib.root); await reopened.init(); assert.deepEqual(reopened.state.items.map(item => item.name), ['second.jpg']);
});
test('content hashes identify exact copies independently of their filenames', async t => {
  const root = await fixture(t), first = path.join(root, 'first.jpg'), renamed = path.join(root, 'renamed.jpg'), different = path.join(root, 'different.jpg');
  await fs.writeFile(first, 'same photo bytes'); await fs.writeFile(renamed, 'same photo bytes'); await fs.writeFile(different, 'different photo bytes');
  const lib = new Library(path.join(root, 'library')); await lib.init(); await lib.import([first, renamed, different]);
  const result = await lib.scanContentHashes(); assert.equal(result.scanned, 3);
  assert.equal(lib.state.items[0].contentHash, lib.state.items[1].contentHash); assert.notEqual(lib.state.items[0].contentHash, lib.state.items[2].contentHash);
  assert.equal((await lib.scanContentHashes()).scanned, 0);
  const reopened = new Library(lib.root); await reopened.init(); assert.equal(reopened.state.items[0].contentHash, lib.state.items[0].contentHash);
});
test('visual fingerprints cache independently and bulk removal persists', async t => {
  const root = await fixture(t), first = path.join(root, 'first.jpg'), second = path.join(root, 'second.jpg'), third = path.join(root, 'third.jpg');
  await fs.writeFile(first, 'first'); await fs.writeFile(second, 'second'); await fs.writeFile(third, 'third');
  const lib = new Library(path.join(root, 'library')); await lib.init(); await lib.import([first, second, third]);
  await lib.cacheMetrics([{ id: lib.state.items[0].id, visualHash: '0123456789abcdef' }]); assert.equal(lib.state.items[0].visualHash, '0123456789abcdef');
  const removed = await lib.removeMany(lib.state.items.slice(0, 2).map(item => item.id)); assert.equal(removed.length, 2); assert.equal(lib.state.items.length, 1);
  const reopened = new Library(lib.root); await reopened.init(); assert.equal(reopened.state.items.length, 1); assert.equal(reopened.state.items[0].name, 'third.jpg');
});
test('manual captions, partial dates and places persist without changing embedded metadata', async t => {
  const root = await fixture(t), source = path.join(root, 'image.jpg'); await fs.writeFile(source, 'image');
  const lib = new Library(path.join(root, 'library')); await lib.init(); await lib.import([source]);
  const item = lib.state.items[0], original = structuredClone(item.metadata);
  await lib.updateDetails(item.id, { caption: '  Summer   holiday  ', date: '1998-07', place: ' Loch Lomond ' });
  const reopened = new Library(lib.root); await reopened.init();
  assert.deepEqual({ ...reopened.state.items[0].metadata, manual: undefined }, { ...original, manual: undefined });
  assert.equal(reopened.state.items[0].metadata.manual.caption, 'Summer holiday');
  assert.equal(reopened.state.items[0].metadata.manual.date, '1998-07');
  assert.equal(reopened.state.items[0].metadata.manual.place, 'Loch Lomond');
  assert.ok(reopened.state.items[0].metadata.manual.reviewedAt);
  await reopened.updateDetails(item.id, null); assert.equal(reopened.state.items[0].metadata.manual, undefined);
});
test('manual date validation accepts useful precision and rejects impossible dates', () => {
  for (const date of ['1998', '2004-06', '2014-08-17', '']) assert.equal(cleanManualDetails({ date }).date, date);
  assert.throws(() => cleanManualDetails({ date: '2014-02-30' }), /does not exist/);
  assert.throws(() => cleanManualDetails({ date: 'last summer' }), /Use a date/);
});
test('large-video optimisation swaps only the library copy and records its saving', async t => {
  const root = await fixture(t), source = path.join(root, 'large.mov'); await fs.writeFile(source, 'original source');
  const lib = new Library(path.join(root, 'library')); await lib.init(); await lib.import([source]);
  const item = lib.state.items[0], oldFile = item.file; item.bytes = 900 * 1024 * 1024; await lib.persist(lib.state);
  assert.equal(lib.optimizationSummary().count, 1);
  const replacement = `${item.id}.playback.m4v`; await fs.writeFile(path.join(lib.root, 'media', replacement), 'small');
  await lib.useOptimized(item.id, replacement, 5);
  assert.equal(await fs.readFile(source, 'utf8'), 'original source');
  await assert.rejects(fs.stat(path.join(lib.root, 'media', oldFile)));
  assert.equal(lib.optimizationSummary().count, 0); assert.equal(lib.state.items[0].optimized.originalBytes, 900 * 1024 * 1024);
});
test('damaged playlist is reported and not overwritten', async t => {
  const root = await fixture(t); await fs.writeFile(path.join(root, 'playlist.json'), '{'); const lib = new Library(root); await assert.rejects(lib.init(), /Cannot read/); assert.equal(await fs.readFile(lib.file, 'utf8'), '{');
});
test('captures keep original, treatment and metadata together with unique names', async t => {
  const root = await fixture(t); const capture = { kind: 'photo', files: [{ name: 'original.jpg', data: new Uint8Array([255, 216, 1]) }, { name: 'print.jpg', data: new Uint8Array([255, 216, 2]) }], metadata: { width: 3840, height: 2160, look: 'soft' } };
  const a = await saveCapture(root, capture), b = await saveCapture(root, capture); assert.notEqual(a.folder, b.folder);
  const meta = JSON.parse(await fs.readFile(path.join(a.folder, 'capture.json'), 'utf8')); assert.equal(meta.width, 3840); assert.equal(meta.files.length, 2); assert.equal((await fs.readFile(a.files[0]))[2], 1);
  assert.ok(!(await fs.readdir(path.dirname(a.folder))).some(f => f.endsWith('.partial')));
});
test('invalid capture filenames, empty photos and booth videos cannot be saved', async t => {
  const root = await fixture(t); await assert.rejects(saveCapture(root, { kind: 'photo', files: [{ name: '../escape.jpg', data: [1] }] }), /Invalid filename/); await assert.rejects(saveCapture(root, { kind: 'photo', files: [{ name: 'original.jpg', data: [] }] }), /Empty/); await assert.rejects(saveCapture(root, { kind: 'video', files: [{ name: 'clip.webm', data: [1] }] }), /Invalid capture/);
});
test('settings keep photo timers, display fit and layout in supported bounds', () => { assert.equal(cleanSettings({ seconds: -50 }).seconds, 2); assert.equal(cleanSettings({ seconds: 100 }).seconds, 60); assert.equal(cleanSettings({ fit: 'anything' }).fit, 'contain'); assert.equal(cleanSettings({ layout: 'grid' }).layout, 'grid'); assert.equal(cleanSettings({ layout: 'other' }).layout, 'single'); });
