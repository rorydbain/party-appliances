import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

class Bucket {
  constructor() { this.items = new Map(); }
  async put(key, value, options = {}) {
    const bytes = value instanceof ReadableStream ? new Uint8Array(await new Response(value).arrayBuffer()) : new TextEncoder().encode(String(value));
    this.items.set(key, { bytes, options });
  }
  async get(key) {
    const found = this.items.get(key); if (!found) return null;
    return { body: found.bytes, httpEtag: '"test"', writeHttpMetadata(headers) { if (found.options.httpMetadata?.contentType) headers.set('content-type', found.options.httpMetadata.contentType); }, async json() { return JSON.parse(new TextDecoder().decode(found.bytes)); } };
  }
  async head(key) { return this.items.has(key) ? { key } : null; }
  async list({ prefix, limit = 1000, cursor }) {
    const matches = [...this.items].filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b));
    const offset = cursor ? Number(cursor) : 0;
    const page = matches.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    return {
      objects: page.map(([key, value]) => ({ key, customMetadata: value.options.customMetadata })),
      truncated: nextOffset < matches.length,
      cursor: nextOffset < matches.length ? String(nextOffset) : undefined
    };
  }
  async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) this.items.delete(key); }
}

test('upload creates one treated download, a lightweight gallery tile and a ZIP of the party', async () => {
  const bucket = new Bucket(), env = { FRAME_BUCKET: bucket, UPLOAD_TOKEN: 'secret', EVENT_NAME: 'Alex & Sam', DEFAULT_EVENT: 'our-party', EVENT_TIMEZONE: 'Europe/London', PUBLIC_GALLERY_ORIGIN: 'https://photos.example.com' };
  const token = '0123456789abcdef0123456789abcdef', form = new FormData();
  form.set('metadata', JSON.stringify({ id: 'capture-1', token, event: 'our-party', kind: 'photo', createdAt: '2026-09-12T12:00:00Z' }));
  form.append('files', new Blob([new Uint8Array([255,216,1,255,217])], { type: 'image/jpeg' }), 'print.jpg');
  form.append('files', new Blob([new Uint8Array([255,216,2,255,217])], { type: 'image/jpeg' }), 'thumb.jpg');
  const uploaded = await worker.fetch(new Request('https://photos.example/api/captures', { method: 'POST', headers: { authorization: 'Bearer secret' }, body: form }), env);
  assert.equal(uploaded.status, 200); const links = await uploaded.json(); assert.equal(links.shareUrl, `https://photos.example.com/?photo=${token}`);
  const selected = await worker.fetch(new Request(`https://worker.example/?photo=${token}`), env); assert.equal(selected.status, 200); const selectedHtml = await selected.text();
  assert.match(selectedHtml, /Download photo/); assert.match(selectedHtml, /print\.jpg\?download=1/); assert.match(selectedHtml, /class="back"[^>]+href="\/e\/our-party"/); assert.doesNotMatch(selectedHtml, /<p class="muted">Your photograph|<h1>Here you are|<h1>Keep this one|Download original|Download Portra|Download all|class="gallery"|thumb\.jpg/);
  const individual = await worker.fetch(new Request(`https://worker.example/e/our-party/p/${token}`), env); const individualHtml = await individual.text();
  assert.equal(individual.status, 200); assert.match(individualHtml, /Download photo/); assert.match(individualHtml, /class="back"[^>]+aria-label="Back to all photographs"/); assert.doesNotMatch(individualHtml, /See the whole party|<p class="muted">Your photograph|<h1>Keep this one/);
  const gallery = await worker.fetch(new Request('https://worker.example/'), env); assert.equal(gallery.status, 200); const galleryHtml = await gallery.text();
  assert.match(galleryHtml, /Alex &amp; Sam/); assert.match(galleryHtml, /thumb\.jpg/); assert.match(galleryHtml, /Download all/); assert.match(galleryHtml, /12 Sept 2026 · 13:00/); assert.doesNotMatch(galleryHtml, /The whole party/);
  const feed = await worker.fetch(new Request('https://worker.example/api/events/our-party/photos'), env); const feedData = await feed.json();
  assert.equal(feed.status, 200); assert.equal(feed.headers.get('cache-control'), 'no-store'); assert.deepEqual(feedData.photos, [{ token, createdAt: '2026-09-12T12:00:00Z', url: `https://photos.example.com/media/our-party/${token}/print.jpg` }]);
  const download = await worker.fetch(new Request(`https://photos.example/media/our-party/${token}/print.jpg?download=1`), env);
  assert.equal(download.status, 200); assert.match(download.headers.get('content-disposition'), /attachment/);
  const archive = await worker.fetch(new Request('https://worker.example/e/our-party/download'), env); const archiveBytes = new Uint8Array(await archive.arrayBuffer());
  assert.equal(archive.status, 200); assert.equal(archive.headers.get('content-type'), 'application/zip'); assert.deepEqual([...archiveBytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]); assert.match(new TextDecoder().decode(archiveBytes), /photo-0001\.jpg/);
});

test('a permanent photo URL waits gracefully before its upload arrives', async () => {
  const token = '0123456789abcdef0123456789abcdef';
  const env = { FRAME_BUCKET: new Bucket(), DEFAULT_EVENT: 'our-party', EVENT_NAME: 'Alex & Sam' };
  const response = await worker.fetch(new Request(`https://worker.example/?photo=${token}`), env);
  const html = await response.text();
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(html, /Uploading/); assert.match(html, /developing-sheet/); assert.match(html, /class="back"[^>]+href="\/e\/our-party"/); assert.doesNotMatch(html, /Still developing|finishing your picture|class="gallery"/); assert.match(html, /fetch\('\/api\/captures\//); assert.match(html, /location\.reload/);
  const waiting = await worker.fetch(new Request(`https://worker.example/api/captures/${token}/status?event=our-party`), env);
  assert.deepEqual(await waiting.json(), { ready: false }); assert.equal(waiting.headers.get('cache-control'), 'no-store');
  await env.FRAME_BUCKET.put(`our-party/${token}/capture.json`, '{}');
  const ready = await worker.fetch(new Request(`https://worker.example/api/captures/${token}/status?event=our-party`), env);
  assert.deepEqual(await ready.json(), { ready: true });
});

test('the gallery continues through every storage page', async () => {
  const bucket = new Bucket(), token = 'ffffffffffffffffffffffffffffffff';
  for (let index = 0; index < 1000; index++) await bucket.put(`our-party/a-${String(index).padStart(4, '0')}`, 'filler');
  await bucket.put(`our-party/${token}/print.jpg`, 'photo');
  await bucket.put(`our-party/${token}/capture.json`, '{}', { customMetadata: { capture: 'ready', previewName: 'print.jpg', thumbnailName: 'print.jpg', downloadName: 'print.jpg', kind: 'photo', createdAt: '2026-09-27T12:00:00Z' } });
  const env = { FRAME_BUCKET: bucket, DEFAULT_EVENT: 'our-party', EVENT_NAME: 'Alex and Sam' };
  const response = await worker.fetch(new Request('https://worker.example/'), env);
  assert.equal(response.status, 200);
  assert.match(await response.text(), new RegExp(token));
});

test('uploads require the booth secret and reject oversized or unrecognised files', async () => {
  const env = { FRAME_BUCKET: new Bucket(), UPLOAD_TOKEN: 'secret' };
  const denied = await worker.fetch(new Request('https://photos.example/api/captures', { method: 'POST', body: new FormData() }), env);
  assert.equal(denied.status, 401);
  const form = new FormData(); form.set('metadata', JSON.stringify({ token: '0123456789abcdef0123456789abcdef', event: 'our-party', kind: 'photo' })); form.append('files', new Blob(['bad']), 'bad.txt');
  const invalid = await worker.fetch(new Request('https://photos.example/api/captures', { method: 'POST', headers: { authorization: 'Bearer secret' }, body: form }), env);
  assert.equal(invalid.status, 400);
});

test('the booth delete endpoint is authorised and idempotent', async () => {
  const bucket = new Bucket(), token = '0123456789abcdef0123456789abcdef';
  await bucket.put(`our-party/${token}/print.jpg`, 'photo'); await bucket.put(`our-party/${token}/capture.json`, '{}', { customMetadata: { capture: 'ready' } });
  const env = { FRAME_BUCKET: bucket, UPLOAD_TOKEN: 'secret' };
  const denied = await worker.fetch(new Request(`https://worker.example/api/captures/${token}?event=our-party`, { method: 'DELETE' }), env);
  assert.equal(denied.status, 401);
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await worker.fetch(new Request(`https://worker.example/api/captures/${token}?event=our-party`, { method: 'DELETE', headers: { authorization: 'Bearer secret' } }), env);
    assert.equal(response.status, 200); assert.equal((await response.json()).deleted, true);
  }
  assert.equal(bucket.items.size, 0);
});

test('the private admin page signs in and deletes only from the public origin', async () => {
  const bucket = new Bucket(), token = 'fedcba9876543210fedcba9876543210';
  await bucket.put(`our-party/${token}/print.jpg`, 'photo');
  await bucket.put(`our-party/${token}/capture.json`, '{}', { customMetadata: { capture: 'ready', previewName: 'print.jpg', thumbnailName: 'print.jpg', kind: 'photo', createdAt: '2026-09-12T12:00:00Z' } });
  const env = { FRAME_BUCKET: bucket, DEFAULT_EVENT: 'our-party', EVENT_NAME: 'Alex and Sam', ADMIN_PASSWORD: 'passcode', ADMIN_SECRET: 'signing-secret', PUBLIC_GALLERY_ORIGIN: 'https://photos.example.com' };
  const loginPage = await worker.fetch(new Request('https://photos.example.com/admin'), env); assert.match(await loginPage.text(), /Photo administration/);
  const loginForm = new FormData(); loginForm.set('passcode', 'passcode');
  const login = await worker.fetch(new Request('https://photos.example.com/api/admin/login', { method: 'POST', body: loginForm }), env);
  assert.equal(login.status, 303); const cookie = login.headers.get('set-cookie').split(';')[0];
  const admin = await worker.fetch(new Request('https://photos.example.com/admin', { headers: { cookie } }), env); const html = await admin.text(); assert.match(html, /Delete/); assert.match(html, new RegExp(token));
  const deleteForm = new FormData(); deleteForm.set('event', 'our-party'); deleteForm.set('token', token);
  const forbidden = await worker.fetch(new Request('https://photos.example.com/api/admin/delete', { method: 'POST', headers: { cookie, origin: 'https://wrong.example' }, body: deleteForm }), env); assert.equal(forbidden.status, 403);
  const deleted = await worker.fetch(new Request('https://photos.example.com/api/admin/delete', { method: 'POST', headers: { cookie, origin: 'https://photos.example.com' }, body: deleteForm }), env); assert.equal(deleted.status, 303);
  assert.equal(bucket.items.size, 0);
});
