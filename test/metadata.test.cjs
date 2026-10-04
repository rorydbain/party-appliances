const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { normalizeMetadata, recordedDate, readMetadata } = require('../src/metadata.cjs');
const { Library } = require('../src/core.cjs');
const { withExif } = require('./exif-fixture.cjs');
test('capture date requires a model and DateTimeOriginal; modified/export timestamps are never substituted', () => {
  assert.equal(normalizeMetadata({ Make: 'Canon', DateTimeOriginal: '2014:08:17 16:42:09' }).capturedAt, null);
  assert.equal(normalizeMetadata({ Model: 'EOS RP', CreateDate: '2014:08:17 16:42:09', ModifyDate: '2026:09:06 00:00:00' }).capturedAt, null);
  assert.equal(recordedDate('2014:02:30 16:00:00'), null);
  assert.equal(recordedDate('2024:02:29 16:00:00'), '2024-02-29T16:00:00');
  assert.equal(recordedDate('2014:08:17 24:00:00'), null);
  assert.equal(normalizeMetadata({ latitude: NaN, longitude: 5 }).location, null);
});
test('real JPEG EXIF preserves wall time and signed GPS, survives copy and migrates old libraries', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'loop-exif-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const source = path.join(dir, 'photo.jpg'); await fs.writeFile(source, withExif());
  const data = await readMetadata(source, 'image');
  assert.equal(data.camera, 'Canon EOS RP'); assert.equal(data.capturedAt, '2014-08-17T16:42:09');
  assert.deepEqual(data.location, { latitude: 55.95, longitude: -3.2 });
  const lib = new Library(path.join(dir, 'library')); await lib.init(); await lib.import([source]); await fs.unlink(source);
  assert.deepEqual(lib.state.items[0].metadata, data);
  delete lib.state.items[0].metadata; await lib.persist(lib.state);
  const migrated = new Library(lib.root); await migrated.init(); assert.deepEqual(migrated.state.items[0].metadata, data);
  assert.equal((await readMetadata(path.join(dir, 'missing.jpg'), 'image')).camera, '');
  assert.equal((await readMetadata('movie.mov', 'video')).capturedAt, null);
});
test('scanner hardware and scanning software suppress dates, devices and GPS without hiding real cameras', () => {
  for (const tags of [
    { Make: 'FUJI PHOTO FILM CO., LTD.', Model: 'SP500' },
    { Make: 'FUJIFILM', Model: 'SP-3000' },
    { Make: 'NORITSU', Model: 'QSS-32_33' },
    { Make: 'Nikon', Model: 'LS-5000 ED' },
    { Make: 'EPSON', Model: 'Perfection V850' },
    { Model: 'Unknown', Software: 'VueScan 9.8' },
    { Model: 'Unknown', Software: 'SilverFast 9' }
  ]) {
    const data = normalizeMetadata({ ...tags, DateTimeOriginal: '2026:09:06 12:00:00', latitude: 55, longitude: -3 });
    assert.equal(data.source, 'scan'); assert.equal(data.camera, ''); assert.equal(data.capturedAt, null); assert.equal(data.location, null);
  }
  for (const model of ['Canon EOS RP', 'NIKON D750', 'FUJIFILM X-T5', 'OLYMPUS SP-500UZ']) assert.ok(normalizeMetadata({ Model: model, DateTimeOriginal: '2014:08:17 16:42:09' }).capturedAt);
  assert.equal(normalizeMetadata(null).camera, '');
});
