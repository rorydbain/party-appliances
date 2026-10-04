const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { Library } = require('../src/core.cjs');
const { resolvePlaces } = require('../src/places.cjs');
const { withExif } = require('./exif-fixture.cjs');
async function setup(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'loop-places-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'photo.jpg'); await fs.writeFile(file, withExif());
  const lib = new Library(path.join(dir, 'library')); await lib.init(); await lib.import([file, file]); return { lib, file };
}
test('place lookup deduplicates nearby coordinates, preserves concurrent edits and survives offline restart', async t => {
  const { lib, file } = await setup(t); let calls = 0;
  const ids = lib.state.items.map(i => i.id).reverse();
  const result = await resolvePlaces(lib, async () => { calls++; await lib.update(ids, { sound: true, metadataCorner: 'left' }); return 'Edinburgh, United Kingdom'; }, undefined, undefined, 0);
  assert.equal(calls, 1); assert.equal(result.resolved, 1); assert.equal(lib.state.settings.sound, true); assert.deepEqual(lib.state.items.map(i => i.id), ids);
  assert.ok(lib.state.items.every(i => i.metadata.placeName === 'Edinburgh, United Kingdom'));
  const reopened = new Library(lib.root); await reopened.init(); await reopened.import([file]);
  await resolvePlaces(reopened, () => { throw new Error('offline'); }, undefined, undefined, 0);
  assert.equal(reopened.state.items.at(-1).metadata.placeName, 'Edinburgh, United Kingdom');
});
test('failed lookups remain retryable; repeated errors stop the batch; cancellation preserves completed work', async t => {
  const { lib, file } = await setup(t); await lib.import([file, file]);
  lib.state.items.forEach((item, i) => item.metadata.location.latitude += i); await lib.persist(lib.state);
  const failed = await resolvePlaces(lib, () => { throw new Error('offline'); }, undefined, undefined, 0);
  assert.equal(failed.failed, 3); assert.equal(failed.done, 3); assert.equal(failed.stoppedEarly, true);
  assert.ok(lib.state.items.every(i => !i.metadata.placeName));
  let cancel = false;
  const partial = await resolvePlaces(lib, async () => 'A place', info => { if (info.done === 1) cancel = true; }, () => cancel, 0);
  assert.equal(partial.cancelled, true); assert.equal(partial.resolved, 1);
  const retried = await resolvePlaces(lib, async () => 'Another place', undefined, undefined, 0);
  assert.equal(retried.resolved, 3); assert.ok(lib.state.items.every(i => i.metadata.placeName));
});
