const test = require('node:test');
const assert = require('node:assert/strict');
const { ReceiptPrinter } = require('../src/receipt.cjs');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

for (const [paper, ready, message] of [
  ['adequate', true, 'ready'],
  ['near-end', true, 'running low'],
  ['out', false, 'run out']
]) test(`receipt printer reports paper ${paper}`, { skip: process.platform !== 'darwin' }, async () => {
  const run = async (_command, args) => {
    if (args[0] === '-p') return { stdout: 'EPSON USB 0x04b8 0x0e28' };
    if (args[0] === '-c') return { stdout: '' };
    if (args.includes('--status')) return { stdout: JSON.stringify({ paper }) };
    throw new Error('unexpected command');
  };
  const printer = new ReceiptPrinter({ script: '/tmp/print-receipt.py', python: '/tmp/python', run });
  const status = await printer.status();
  assert.equal(status.present, true); assert.equal(status.ready, ready); assert.equal(status.paper, paper); assert.match(status.message, new RegExp(message));
});

test('receipt status stays usable when the paper query is unavailable', { skip: process.platform !== 'darwin' }, async () => {
  const run = async (_command, args) => {
    if (args[0] === '-p') return { stdout: 'EPSON USB 0x04b8 0x0e28' };
    if (args[0] === '-c') return { stdout: '' };
    throw new Error('query unavailable');
  };
  const status = await new ReceiptPrinter({ script: '/tmp/print-receipt.py', python: '/tmp/python', run }).status();
  assert.deepEqual({ present: status.present, ready: status.ready, paper: status.paper }, { present: true, ready: true, paper: 'unknown' });
});

test('receipt headings come from the local event profile', async t => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'party-receipt-')); t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const image = path.join(folder, 'photo.jpg'); await fs.writeFile(image, 'jpeg');
  let invoked;
  const printer = new ReceiptPrinter({ script: '/tmp/print-receipt.py', python: '/tmp/python', title: 'ALEX + SAM', venue: 'TOWN HALL', run: async (command, args) => { invoked = { command, args }; return { stdout: 'printed\n' }; } });
  await printer.print({ id: 'capture-one', image, url: 'https://photos.example/?photo=0123456789abcdef0123456789abcdef' });
  assert.equal(invoked.command, '/tmp/python');
  assert.deepEqual(invoked.args.slice(-5), ['--title', 'ALEX + SAM', '--venue', 'TOWN HALL', '--print']);
});
