const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyseFlashPixels, ambientFallbackISO } = require('../src/exposure.js');

function patch(width, height, background, portrait = background) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const centre = x > width * .35 && x < width * .65 && y > height * .2 && y < height * .65;
    const value = Math.round((centre ? portrait : background) * 255), i = (y * width + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = value; data[i + 3] = 255;
  }
  return data;
}

test('flash check rejects an unmistakably dark portrait area', () => {
  assert.equal(analyseFlashPixels(patch(200, 150, .04, .10), 200, 150).clearlyUnderlit, true);
});

test('flash check accepts a lit face against a dark booth', () => {
  const result = analyseFlashPixels(patch(200, 150, .05, .62), 200, 150);
  assert.equal(result.clearlyUnderlit, false);
  assert.ok(result.p85 > .5);
});

test('flash check accepts a deliberately low-key but usable frame', () => {
  assert.equal(analyseFlashPixels(patch(200, 150, .14, .38), 200, 150).clearlyUnderlit, false);
});

test('ambient fallback lowers ISO in a bright room and raises it in a dark room', () => {
  assert.equal(ambientFallbackISO(.20), 200);
  assert.equal(ambientFallbackISO(.10), 800);
  assert.equal(ambientFallbackISO(.05), 3200);
  assert.equal(ambientFallbackISO(0), 6400);
});
