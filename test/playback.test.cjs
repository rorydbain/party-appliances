const test = require('node:test');
const assert = require('node:assert/strict');
const { photoDuration, featuredPhotoDuration, videoSegmentCount, videoExcerpt, videoPlaybackSeconds, estimatedVideoSeconds, videoAppearances, preferredVideoRegion, expandVideoItems, shuffleItems, mediaFit } = require('../src/playback.js');

test('grid photos vary around the selected duration', () => {
  assert.equal(photoDuration(10, () => 0), 7800);
  assert.equal(photoDuration(10, () => 1), 12800);
});

test('a newly arrived booth photo gets twice its normal first-show duration', () => {
  assert.equal(featuredPhotoDuration(8000, true), 16000);
  assert.equal(featuredPhotoDuration(8000, false), 8000);
});

test('short videos play in full and long videos use a bounded random excerpt', () => {
  assert.deepEqual(videoExcerpt(12, () => 0.5), { start: 0, end: 12, chopped: false });
  const values = [0.25];
  const excerpt = videoExcerpt(60, () => values.shift());
  assert.equal(excerpt.chopped, true);
  assert.equal(excerpt.end - excerpt.start, 12);
  assert.equal(excerpt.start, 12);
  assert.equal(excerpt.end, 24);
});

test('runtime estimates use full short clips and ten seconds for long or unknown videos', () => {
  assert.equal(estimatedVideoSeconds(7.5), 7.5);
  assert.equal(estimatedVideoSeconds(90), 10);
  assert.equal(estimatedVideoSeconds(undefined), 10);
});

test('every video appearance has a twelve-second hard limit even without reliable metadata', () => {
  assert.equal(videoPlaybackSeconds(8, { start: 0, end: 8 }), 8);
  assert.equal(videoPlaybackSeconds(200, { start: 50, end: 61.5 }), 11.5);
  assert.equal(videoPlaybackSeconds(Infinity, { start: 0, end: Infinity }), 12);
  assert.equal(videoPlaybackSeconds(200, { start: 0, end: 30 }), 12);
});

test('long videos reappear later as separate excerpt opportunities', () => {
  assert.equal(videoAppearances(12), 1); assert.equal(videoAppearances(13), 2); assert.equal(videoAppearances(61), 3); assert.equal(videoAppearances(120), 4); assert.equal(videoAppearances(243), 9); assert.equal(videoAppearances(433), 12);
  const items = [{ id: 'a', kind: 'image' }, { id: 'long', kind: 'video', duration: 61 }, { id: 'b', kind: 'image' }, { id: 'short', kind: 'video', duration: 8 }];
  const expanded = expandVideoItems(items);
  assert.equal(expanded.filter(item => (item.sourceId || item.id) === 'long').length, 3);
  assert.equal(expanded.filter(item => (item.sourceId || item.id) === 'short').length, 1);
  assert.equal(new Set(expanded.map(item => item.id)).size, expanded.length);
  assert.deepEqual(expanded.filter(item => (item.sourceId || item.id) === 'long').map(item => item.excerptOrdinal).sort((a, b) => a - b), [0, 1, 2]);
});

test('long-video appearances are deliberately spread across early, middle and late regions', () => {
  const duration = 120, appearances = videoAppearances(duration);
  const regions = Array.from({ length: appearances }, (_, ordinal) => preferredVideoRegion(duration, ordinal, appearances));
  assert.deepEqual(regions, [1, 3, 6, 8]);
  const excerpts = regions.map(region => videoExcerpt(duration, () => 0, [], region));
  assert.ok(excerpts[0].start < duration * .25); assert.ok(excerpts[1].start < duration * .5); assert.ok(excerpts[2].start > duration * .5); assert.ok(excerpts.at(-1).start > duration * .75);
});

test('playback starts from a shuffled deck and keeps repeated excerpts apart', () => {
  const items = [{ id: 'a' }, { id: 'long', sourceId: 'long' }, { id: 'long:excerpt:1', sourceId: 'long' }, { id: 'b' }];
  const shuffled = shuffleItems(items, () => 0);
  assert.notDeepEqual(shuffled.map(item => item.id), items.map(item => item.id));
  for (let index = 1; index < shuffled.length; index++) assert.notEqual(shuffled[index].sourceId || shuffled[index].id, shuffled[index - 1].sourceId || shuffled[index - 1].id);
});

test('successive long-video excerpts use different regions across the full duration', () => {
  const random = () => 0;
  const first = videoExcerpt(120, random);
  const second = videoExcerpt(120, random, [first]);
  const third = videoExcerpt(120, random, [first, second]);
  assert.equal(first.start, 0);
  assert.equal(second.start, 12);
  assert.equal(third.start, 24);
  assert.notEqual(Math.floor(first.start / 10), Math.floor(second.start / 10));
  assert.notEqual(Math.floor(second.start / 10), Math.floor(third.start / 10));
});

test('excerpt history prevents a long video repeatedly returning to its opening', () => {
  const history = [];
  for (let appearance = 0; appearance < 12; appearance++) {
    const excerpt = videoExcerpt(240, () => 0.01, history);
    history.push(excerpt);
  }
  const starts = history.map(item => Math.floor(item.start));
  assert.equal(new Set(starts).size, starts.length);
  assert.ok(starts.at(-1) > starts[0] + 100);
});

test('long-video segments cover the duration before returning to an earlier region', () => {
  const duration = 95, count = videoSegmentCount(duration), history = [];
  for (let appearance = 0; appearance < count; appearance++) {
    const excerpt = videoExcerpt(duration, () => 0, history); history.push(excerpt);
  }
  assert.equal(new Set(history.map(item => item.region)).size, count);
  assert.equal(history[0].start, 0);
  assert.equal(history.at(-1).end, duration);
});

test('balanced grid fit fills close aspect ratios and contains poor matches', () => {
  assert.equal(mediaFit('contain', 1600, 1000, 1000, 1000), 'contain');
  assert.equal(mediaFit('cover', 1500, 1000, 1400, 1000), 'cover');
  assert.equal(mediaFit('cover', 1600, 900, 1000, 900), 'cover');
  assert.equal(mediaFit('cover', 1600, 900, 600, 900), 'contain');
  assert.equal(mediaFit('cover', 900, 1600, 1600, 900), 'contain');
});
