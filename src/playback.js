(function (root, factory) {
  const playback = factory();
  if (typeof module === 'object' && module.exports) module.exports = playback;
  else root.playback = playback;
})(typeof window === 'object' ? window : globalThis, () => {
  const LONG_VIDEO_SECONDS = 12;
  const MIN_EXCERPT_SECONDS = 8;
  const MAX_EXCERPT_SECONDS = 12;

  function photoDuration(baseSeconds, random = Math.random) {
    const seconds = Number(baseSeconds) || 8;
    return seconds * 1000 * (0.78 + random() * 0.5);
  }

  function featuredPhotoDuration(duration, featured = false) {
    return Math.max(1, Number(duration) || 1) * (featured ? 2 : 1);
  }

  function videoSegmentCount(duration) {
    if (!Number.isFinite(duration) || duration <= LONG_VIDEO_SECONDS) return 1;
    return Math.max(2, Math.ceil(duration / MAX_EXCERPT_SECONDS));
  }

  function videoExcerpt(duration, random = Math.random, previous = null, preferredRegion = null) {
    if (!Number.isFinite(duration) || duration <= LONG_VIDEO_SECONDS) return { start: 0, end: duration, chopped: false };
    const zoneCount = videoSegmentCount(duration), zoneLength = duration / zoneCount;
    const history = (Array.isArray(previous) ? previous : previous ? [previous] : []).filter(item => Number.isFinite(item?.start));
    const recent = history.slice(-Math.max(1, zoneCount - 1));
    const zoneOf = item => Number.isInteger(item.region) ? item.region : Math.min(zoneCount - 1, Math.floor(((item.start + item.end) / 2) / zoneLength));
    const used = new Set(recent.map(zoneOf));
    let choices = Array.from({ length: zoneCount }, (_value, zone) => zone).filter(zone => !used.has(zone));
    if (!choices.length) choices = Array.from({ length: zoneCount }, (_value, zone) => zone);
    const hasPreferred = preferredRegion !== null && preferredRegion !== undefined && Number.isFinite(Number(preferredRegion));
    const preferred = hasPreferred ? Math.max(0, Math.min(zoneCount - 1, Math.round(Number(preferredRegion)))) : -1;
    const zone = hasPreferred && choices.includes(preferred) ? preferred : choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
    const centre = (zone + .5) * zoneLength, length = Math.min(MAX_EXCERPT_SECONDS, Math.max(MIN_EXCERPT_SECONDS, zoneLength));
    const start = Math.max(0, Math.min(duration - length, centre - length / 2));
    return { start, end: Math.min(duration, start + length), chopped: true, region: zone };
  }

  function estimatedVideoSeconds(duration) {
    return Number.isFinite(duration) && duration > 0 && duration <= LONG_VIDEO_SECONDS ? duration : 10;
  }

  function videoPlaybackSeconds(duration, excerpt) {
    const excerptLength = Number(excerpt?.end) - Number(excerpt?.start);
    if (Number.isFinite(excerptLength) && excerptLength > 0) return Math.min(LONG_VIDEO_SECONDS, excerptLength);
    if (Number.isFinite(duration) && duration > 0) return Math.min(LONG_VIDEO_SECONDS, duration);
    return LONG_VIDEO_SECONDS;
  }

  function videoAppearances(duration) {
    if (!Number.isFinite(duration) || duration <= LONG_VIDEO_SECONDS) return 1;
    return Math.min(12, Math.max(2, Math.ceil(duration / 30)));
  }

  function stableNumber(value) {
    let hash = 2166136261;
    for (const character of String(value)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
  }

  function expandVideoItems(items) {
    const result = items.map(item => {
      if (item.kind !== 'video') return item;
      const excerptCount = videoAppearances(item.duration);
      return { ...item, excerptOrdinal: 0, excerptCount };
    });
    for (const item of items) {
      const appearances = item.kind === 'video' ? videoAppearances(item.duration) : 1;
      for (let repeat = 1; repeat < appearances; repeat++) {
        const clone = { ...item, id: `${item.id}:excerpt:${repeat}`, sourceId: item.sourceId || item.id, excerptOrdinal: repeat, excerptCount: appearances };
        let position = stableNumber(clone.id) % (result.length + 1);
        for (let attempt = 0; attempt <= result.length; attempt++) {
          const before = result[position - 1], after = result[position];
          const source = clone.sourceId;
          if ((before?.sourceId || before?.id) !== source && (after?.sourceId || after?.id) !== source) break;
          position = (position + 1) % (result.length + 1);
        }
        result.splice(position, 0, clone);
      }
    }
    return result;
  }

  function preferredVideoRegion(duration, ordinal, appearances) {
    const regions = videoSegmentCount(duration), count = Math.max(1, Number(appearances) || 1), position = Math.max(0, Math.min(count - 1, Number(ordinal) || 0));
    return Math.min(regions - 1, Math.floor((position + .5) * regions / count));
  }

  function shuffleItems(items, random = Math.random) {
    const result = [...items], source = item => item?.sourceId || item?.id;
    for (let index = result.length - 1; index > 0; index--) { const swap = Math.floor(random() * (index + 1)); [result[index], result[swap]] = [result[swap], result[index]]; }
    for (let index = 1; index < result.length; index++) {
      if (source(result[index]) !== source(result[index - 1])) continue;
      const swap = result.findIndex((item, candidate) => candidate > index && source(item) !== source(result[index - 1]) && (!result[index + 1] || source(item) !== source(result[index + 1])));
      if (swap > index) [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  }

  function mediaFit(requested, sourceWidth, sourceHeight, boxWidth, boxHeight) {
    if (requested !== 'cover') return 'contain';
    if (![sourceWidth, sourceHeight, boxWidth, boxHeight].every(value => Number.isFinite(value) && value > 0)) return 'cover';
    const sourceRatio = sourceWidth / sourceHeight;
    const boxRatio = boxWidth / boxHeight;
    const visibleFraction = Math.min(sourceRatio / boxRatio, boxRatio / sourceRatio);
    return visibleFraction >= 0.62 ? 'cover' : 'contain';
  }

  return { photoDuration, featuredPhotoDuration, videoSegmentCount, videoExcerpt, videoPlaybackSeconds, estimatedVideoSeconds, videoAppearances, preferredVideoRegion, expandVideoItems, shuffleItems, mediaFit };
});
