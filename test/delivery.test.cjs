const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { DeliveryQueue, cleanConfig } = require('../src/delivery.cjs');

async function fixture(t, config = null) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'delivery-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const configFile = path.join(root, 'delivery.json');
  if (config) await fs.writeFile(configFile, JSON.stringify(config));
  const folder = path.join(root, 'capture'); await fs.mkdir(folder);
  await fs.writeFile(path.join(folder, 'original.jpg'), Buffer.from([255,216,255,217]));
  await fs.writeFile(path.join(folder, 'print.jpg'), Buffer.from([255,216,1,255,217]));
  await fs.writeFile(path.join(folder, 'capture.json'), JSON.stringify({ id: 'capture-one', kind: 'photo', createdAt: '2026-09-12T12:00:00.000Z', files: ['original.jpg', 'print.jpg'] }));
  return { root, configFile, capture: { id: 'capture-one', folder } };
}

test('delivery config accepts HTTPS and local development only', () => {
  const config = cleanConfig({ endpoint: 'https://upload.example', publicUrl: 'https://photos.example', token: 'x', event: 'our-party' });
  assert.equal(config.endpoint, 'https://upload.example'); assert.equal(config.publicUrl, 'https://photos.example');
  assert.equal(cleanConfig({ endpoint: 'http://localhost:8787', token: 'x', event: 'our-party' }).endpoint, 'http://localhost:8787');
  assert.equal(cleanConfig({ endpoint: 'http://photos.example', token: 'x', event: '../bad' }).endpoint, '');
});

test('capture is durably queued before cloud sharing is configured', async t => {
  const f = await fixture(t), queue = new DeliveryQueue({ root: f.root, configFile: f.configFile });
  await queue.init(); const state = await queue.enqueue(f.capture);
  assert.equal(state.configured, false); assert.equal(state.pending, 1);
  const saved = JSON.parse(await fs.readFile(path.join(f.root, '.delivery-queue.json'), 'utf8'));
  assert.equal(saved.jobs[0].status, 'waiting-config'); assert.match(saved.jobs[0].publicToken, /^[a-f0-9]{32}$/);
});

test('configured delivery prints its permanent URL while the upload is still running', async t => {
  const f = await fixture(t, { endpoint: 'https://upload.example', publicUrl: 'https://photos.example', token: 'secret', event: 'our-party', printReceipts: true });
  let uploads = 0, prints = 0, sent, printFinished = false;
  let finishUpload; const uploadGate = new Promise(resolve => { finishUpload = resolve; });
  const fetchImpl = async (_url, options) => { assert.equal(printFinished, true); uploads++; sent = options; await uploadGate; return Response.json({ shareUrl: 'https://wrong.example/old-style', galleryUrl: 'https://wrong.example' }); };
  const printer = { status: async () => ({ present: true, ready: true }), print: async job => { prints++; assert.match(job.url, /^https:\/\/photos\.example\/\?photo=[a-f0-9]{32}$/); printFinished = true; finishUpload(); } };
  const queue = new DeliveryQueue({ root: f.root, configFile: f.configFile, fetchImpl, printer }); await queue.init();
  await queue.enqueue(f.capture); while (queue.draining) await new Promise(r => setTimeout(r, 5));
  assert.equal(uploads, 1); assert.equal(prints, 1); assert.match(sent.headers.authorization, /secret/);
  assert.deepEqual(sent.body.getAll('files').map(file => file.name), ['print.jpg']); assert.equal(queue.jobs[0].status, 'uploaded'); assert.equal(queue.jobs[0].printStatus, 'printed');
  assert.match(queue.jobs[0].shareUrl, /^https:\/\/photos\.example\/\?photo=/);
  await queue.drain(); assert.equal(uploads, 1); assert.equal(prints, 1);
});

test('RAW stays local while the treated photo and lightweight thumbnail upload', async t => {
  const f = await fixture(t, { endpoint: 'https://photos.example', token: 'secret', event: 'our-party' });
  await fs.writeFile(path.join(f.capture.folder, 'original.cr3'), Buffer.from([1,2,3]));
  await fs.writeFile(path.join(f.capture.folder, 'thumb.jpg'), Buffer.from([255,216,2,255,217]));
  await fs.writeFile(path.join(f.capture.folder, 'capture.json'), JSON.stringify({ id: 'capture-one', kind: 'photo', createdAt: '2026-09-12T12:00:00.000Z', files: ['original.jpg', 'print.jpg', 'thumb.jpg', 'original.cr3'] }));
  let names;
  const queue = new DeliveryQueue({ root: f.root, configFile: f.configFile, fetchImpl: async (_url, options) => { names = options.body.getAll('files').map(file => file.name); return Response.json({ shareUrl: 'https://photos.example/photo', galleryUrl: 'https://photos.example/gallery' }); } });
  await queue.init(); await queue.enqueue(f.capture); while (queue.draining) await new Promise(resolve => setTimeout(resolve, 5));
  assert.deepEqual(names.sort(), ['print.jpg', 'thumb.jpg']);
});

test('a failed physical print stops for attention instead of duplicating automatically', async t => {
  const f = await fixture(t, { endpoint: 'https://photos.example', token: 'secret', event: 'our-party', printReceipts: true });
  let prints = 0;
  const queue = new DeliveryQueue({ root: f.root, configFile: f.configFile, fetchImpl: async () => Response.json({ shareUrl: 'https://photos.example/e/our-party/p/token', galleryUrl: 'https://photos.example/e/our-party' }), printer: { status: async () => ({ present: true, ready: true }), print: async () => { prints++; throw new Error('paper jam'); } } });
  await queue.init(); await queue.enqueue(f.capture); while (queue.draining) await new Promise(r => setTimeout(r, 5));
  assert.equal(queue.jobs[0].printStatus, 'attention'); await queue.drain(); assert.equal(prints, 1);
});

test('a saved photograph can be manually reprinted without changing delivery state', async t => {
  const f = await fixture(t, { endpoint: 'https://upload.example', publicUrl: 'https://photos.example', token: 'secret', event: 'our-party', printReceipts: false });
  let printed;
  const printer = { status: async () => ({ present: true, ready: true }), print: async job => { printed = job; } };
  const queue = new DeliveryQueue({ root: f.root, configFile: f.configFile, printer, fetchImpl: async () => Response.json({ shareUrl: 'https://photos.example/?photo=one', galleryUrl: 'https://photos.example' }) });
  await queue.init(); await queue.enqueue(f.capture); while (queue.draining) await new Promise(resolve => setTimeout(resolve, 5));
  const before = queue.jobs[0].printStatus, history = await queue.receiptHistory(), result = await queue.reprint('capture-one');
  assert.equal(history.length, 1); assert.match(history[0].thumbnail, /print\.jpg$/); assert.equal(result.printed, true);
  assert.match(printed.image, /print\.jpg$/); assert.equal(printed.url, queue.jobs[0].shareUrl); assert.equal(queue.jobs[0].printStatus, before);
});

test('a crash while printing requires a host decision instead of risking a duplicate receipt', async t => {
  const f = await fixture(t, { endpoint: 'https://photos.example', token: 'secret', event: 'our-party', printReceipts: true });
  await fs.writeFile(path.join(f.root, '.delivery-queue.json'), JSON.stringify({ jobs: [{ id: 'capture-one', publicToken: 'a'.repeat(32), folder: f.capture.folder, kind: 'photo', createdAt: '2026-09-12T12:00:00.000Z', files: ['original.jpg'], status: 'uploaded', printStatus: 'printing' }] }));
  const queue = new DeliveryQueue({ root: f.root, configFile: f.configFile }); await queue.init();
  assert.equal(queue.jobs[0].printStatus, 'attention'); assert.match(queue.jobs[0].printError, /closed while/i);
});

test('manual retry clears upload backoff and succeeds with the same public identity', async t => {
  const f = await fixture(t, { endpoint: 'https://upload.example', publicUrl: 'https://photos.example', token: 'secret', event: 'our-party' });
  let calls = 0;
  const queue = new DeliveryQueue({ root: f.root, configFile: f.configFile, fetchImpl: async () => { calls++; if (calls === 1) throw new Error('offline'); return Response.json({ shareUrl: 'https://ignored.example', galleryUrl: 'https://ignored.example' }); } });
  await queue.init(); await queue.enqueue(f.capture); while (queue.draining) await new Promise(r => setTimeout(r, 5));
  const originalToken = queue.jobs[0].publicToken; assert.equal(queue.jobs[0].attempts, 1);
  await queue.retry('capture-one'); while (queue.draining) await new Promise(r => setTimeout(r, 5));
  assert.equal(queue.jobs[0].status, 'uploaded'); assert.equal(queue.jobs[0].publicToken, originalToken); assert.equal(calls, 2);
});

test('queue retention never drops unfinished captures at the history limit', async t => {
  const f = await fixture(t), queue = new DeliveryQueue({ root: f.root, configFile: f.configFile }); await queue.init();
  queue.jobs = Array.from({ length: 520 }, (_, index) => ({ id: `capture-${index}`, folder: f.capture.folder, status: index < 19 ? 'uploaded' : 'pending', printStatus: 'disabled' }));
  await queue.persist();
  assert.equal(queue.jobs.filter(job => job.status === 'pending').length, 501);
  assert.equal(queue.jobs.some(job => job.status === 'uploaded'), false);
});

test('deleting an uploaded capture removes the cloud copy before trashing local files', async t => {
  const f = await fixture(t, { endpoint: 'https://upload.example', publicUrl: 'https://photos.example', token: 'secret', event: 'our-party' });
  let deleted, trashed;
  const queue = new DeliveryQueue({ root: f.root, configFile: f.configFile,
    fetchImpl: async (url, options) => options.method === 'DELETE' ? (deleted = { url, options }, Response.json({ deleted: true })) : Response.json({ shareUrl: 'https://photos.example/?photo=x', galleryUrl: 'https://photos.example' }),
    trash: async folder => { trashed = folder; }
  });
  await queue.init(); await queue.enqueue(f.capture); while (queue.draining) await new Promise(resolve => setTimeout(resolve, 5));
  const token = queue.jobs[0].publicToken; await queue.remove('capture-one'); while (queue.draining) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(deleted.url, `https://upload.example/api/captures/${token}?event=our-party`); assert.equal(deleted.options.headers.authorization, 'Bearer secret'); assert.equal(trashed, f.capture.folder); assert.equal(queue.jobs.length, 0);
});

test('a failed cloud delete preserves local files and retries safely', async t => {
  const f = await fixture(t, { endpoint: 'https://upload.example', publicUrl: 'https://photos.example', token: 'secret', event: 'our-party' });
  let deleteCalls = 0, trashed = false;
  const queue = new DeliveryQueue({ root: f.root, configFile: f.configFile,
    fetchImpl: async (_url, options) => options.method === 'DELETE' ? (++deleteCalls === 1 ? new Response('', { status: 503 }) : Response.json({ deleted: true })) : Response.json({ shareUrl: 'https://photos.example/?photo=x', galleryUrl: 'https://photos.example' }),
    trash: async () => { trashed = true; }
  });
  await queue.init(); await queue.enqueue(f.capture); while (queue.draining) await new Promise(resolve => setTimeout(resolve, 5));
  await queue.remove('capture-one'); while (queue.draining) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(queue.jobs[0].status, 'deleting'); assert.equal(queue.jobs[0].attempts, 1); assert.equal(trashed, false);
  await queue.retry('capture-one'); while (queue.draining) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(deleteCalls, 2); assert.equal(trashed, true); assert.equal(queue.jobs.length, 0);
});

test('a local-only capture can be removed without cloud configuration', async t => {
  const f = await fixture(t); let trashed;
  const queue = new DeliveryQueue({ root: f.root, configFile: f.configFile, fetchImpl: async () => { throw new Error('should not fetch'); }, trash: async folder => { trashed = folder; } });
  await queue.init(); await queue.enqueue(f.capture); queue.jobs[0].status = 'local-only'; await queue.persist();
  await queue.remove('capture-one'); while (queue.draining) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(trashed, f.capture.folder); assert.equal(queue.jobs.length, 0);
});

test('a capture still waiting for sharing setup can be removed locally', async t => {
  const f = await fixture(t); let trashed;
  const queue = new DeliveryQueue({ root: f.root, configFile: f.configFile, fetchImpl: async () => { throw new Error('should not fetch'); }, trash: async folder => { trashed = folder; } });
  await queue.init(); await queue.enqueue(f.capture);
  await queue.remove('capture-one'); while (queue.draining) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(trashed, f.capture.folder); assert.equal(queue.jobs.length, 0);
});
