const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hamming, groupItems } = require('../src/duplicates.js');

test('duplicate grouping finds identical contents regardless of filename', () => {
  const hash = 'a'.repeat(64), items = [{ id: 'a', name: 'one.jpg', kind: 'image', contentHash: hash }, { id: 'b', name: 'renamed.jpg', kind: 'image', contentHash: hash }, { id: 'c', name: 'other.jpg', kind: 'image', contentHash: 'b'.repeat(64) }];
  const groups = groupItems(items); assert.equal(groups.length, 1); assert.equal(groups[0].kind, 'exact'); assert.deepEqual(groups[0].items.map(item => item.id), ['a', 'b']);
});
test('visual grouping is conservative about distance and aspect ratio', () => {
  assert.equal(hamming('0000000000000000', '0000000000000003'), 2);
  const items = [
    { id: 'a', kind: 'image', width: 4000, height: 3000, visualHash: '0000000000000000', contentHash: 'a'.repeat(64) },
    { id: 'b', kind: 'image', width: 1600, height: 1200, visualHash: '0000000000000003', contentHash: 'b'.repeat(64) },
    { id: 'far', kind: 'image', width: 1600, height: 1200, visualHash: '00000000000000ff', contentHash: 'c'.repeat(64) },
    { id: 'portrait', kind: 'image', width: 1200, height: 1600, visualHash: '0000000000000001', contentHash: 'd'.repeat(64) }
  ];
  const groups = groupItems(items); assert.equal(groups.length, 1); assert.equal(groups[0].kind, 'similar'); assert.deepEqual(groups[0].items.map(item => item.id), ['a', 'b']);
});
