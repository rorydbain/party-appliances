const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { parseRange, localMediaResponse } = require('../src/media-response.cjs');

test('media byte ranges support video seeking', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'party-range-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'clip.mp4'); await fs.writeFile(file, '0123456789');
  const response = await localMediaResponse(file, new Request('https://local/clip', { headers: { Range: 'bytes=3-6' } }));
  assert.equal(response.status, 206); assert.equal(response.headers.get('accept-ranges'), 'bytes'); assert.equal(response.headers.get('content-range'), 'bytes 3-6/10'); assert.equal(response.headers.get('content-length'), '4'); assert.equal(await response.text(), '3456');
});

test('media ranges support open ends, suffixes, HEAD and invalid requests', async t => {
  assert.deepEqual(parseRange('bytes=4-', 10), { start: 4, end: 9 }); assert.deepEqual(parseRange('bytes=-3', 10), { start: 7, end: 9 }); assert.equal(parseRange('bytes=20-30', 10), false);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'party-range-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'clip.mov'); await fs.writeFile(file, '0123456789');
  const head = await localMediaResponse(file, new Request('https://local/clip', { method: 'HEAD', headers: { Range: 'bytes=4-' } })); assert.equal(head.status, 206); assert.equal(await head.text(), '');
  const invalid = await localMediaResponse(file, new Request('https://local/clip', { headers: { Range: 'bytes=20-30' } })); assert.equal(invalid.status, 416); assert.equal(invalid.headers.get('content-range'), 'bytes */10');
});
