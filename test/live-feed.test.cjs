const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { LivePhotoFeed } = require('../src/live-feed.cjs');

test('the booth feed caches new photos, deduplicates them and survives offline restart', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'loop-feed-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const endpoint = 'https://photos.example/api/events/our-party/photos';
  const photos = Array.from({ length: 5 }, (_, index) => {
    const token = String(index + 1).repeat(32);
    return { token, createdAt: `2026-09-15T12:00:0${index}Z`, url: `/media/our-party/${token}/print.jpg` };
  });
  let manifestCalls = 0, photoCalls = 0;
  const fetchImpl = async value => {
    const url = String(value);
    if (url === endpoint) { manifestCalls++; return Response.json({ photos }); }
    photoCalls++; return new Response(new Uint8Array([0xff, 0xd8, 1, 0xff, 0xd9]), { headers: { 'content-type': 'image/jpeg' } });
  };
  const feed = new LivePhotoFeed({ root, endpoint, fetchImpl }); await feed.init();
  await feed.poll(); assert.equal(feed.summary().count, 4);
  await feed.poll(); assert.equal(feed.summary().count, 5);
  await feed.poll(); assert.equal(feed.summary().count, 5);
  assert.equal(manifestCalls, 3); assert.equal(photoCalls, 5); assert.equal(feed.items().every(item => item.source === 'booth'), true);

  const offline = new LivePhotoFeed({ root, endpoint, fetchImpl: async () => { throw new Error('offline'); } });
  await offline.init(); assert.equal(offline.summary().count, 5);
  await offline.poll(); assert.equal(offline.summary().count, 5); assert.equal(offline.summary().connected, false); assert.match(offline.summary().message, /Offline/);
});
