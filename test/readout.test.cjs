const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/readout.js'), 'utf8'), context);
const lines = (item, settings = {}) => Array.from(context.window.readout.lines(item, { metadata: true, gps: true, camera: false, ...settings }));

test('manual details display on scans and videos while camera names stay hidden', () => {
  const scan = { kind: 'image', metadata: { source: 'scan', camera: 'Scanner', capturedAt: '2026-01-01T00:00:00', manual: { caption: 'The old kitchen', date: '1998-07', place: 'Glasgow' } } };
  assert.deepEqual(lines(scan), ['The old kitchen', 'Glasgow · July 1998']);
  const video = { kind: 'video', metadata: { manual: { caption: 'First flat', date: '2007', place: '' } } };
  assert.deepEqual(lines(video), ['First flat', '2007']);
});

test('blank manual corrections can suppress incorrect automatic details', () => {
  const item = { kind: 'image', metadata: { capturedAt: '2014-08-17T16:42:09', placeName: 'Wrong place', manual: { date: '', place: '' } } };
  assert.deepEqual(lines(item), []);
});
