const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

for (const name of ['warm-film.cube', 'soft-neutral.cube']) test(`${name} is a complete redistributable 3D LUT`, () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'src', 'luts', name), 'utf8');
  const size = Number(text.match(/LUT_3D_SIZE\s+(\d+)/)?.[1]);
  const values = text.split(/\r?\n/).filter(line => /^\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+$/.test(line));
  assert.equal(size, 17);
  assert.equal(values.length, size ** 3);
  assert.match(text, /Original LUT created for Party Appliances\. MIT licensed\./);
});
