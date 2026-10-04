const api = window.party;
const stage = document.getElementById('stage');
const readout = document.getElementById('metadata-readout');
const GRID_RHYTHM = [0.82, 1.08, 1.31, 0.94, 1.19, 1.43];
const GRID_LAYOUTS = [
  { name: 'six-a', rects: [[0,0,.33,.62],[.33,0,.42,.38],[.75,0,.25,.62],[0,.62,.33,.38],[.33,.38,.42,.62],[.75,.62,.25,.38]] },
  { name: 'six-b', rects: [[0,0,.28,.45],[.28,0,.48,.62],[.76,0,.24,.35],[0,.45,.28,.55],[.28,.62,.48,.38],[.76,.35,.24,.65]] },
  { name: 'five', rects: [[0,0,.38,1],[.38,0,.38,.48],[.76,0,.24,.57],[.38,.48,.38,.52],[.76,.57,.24,.43]] },
  { name: 'four', rects: [[0,0,.57,1],[.57,0,.43,.48],[.57,.48,.22,.52],[.79,.48,.21,.52]] }
];
let state, index = 0, paused = false, blackout = false, generation = 0;
let single = null, slots = [], layoutTimer = null, currentLayout = null, nextGridChangeAt = 0, gridDeck = [], gridRecent = [], boothPriority = [], boothFirstShowing = new Set();
const excerptHistory = new Map();

function chooseVideoExcerpt(item, duration) {
  const sourceId = sourceOf(item), history = excerptHistory.get(sourceId) || [];
  const preferred = window.playback.preferredVideoRegion(duration, item.excerptOrdinal, item.excerptCount);
  const excerpt = window.playback.videoExcerpt(duration, Math.random, history, preferred);
  if (excerpt.chopped) excerptHistory.set(sourceId, [...history, excerpt].slice(-window.playback.videoSegmentCount(duration)));
  return excerpt;
}

function status(error) { const item = state?.items[index]; api.outputStatus({ index, itemId: item?.sourceId || item?.id || null, paused, blackout, error }); }
function expanded(data) { return { ...data, items: window.playback.expandVideoItems(data.items) }; }
function randomized(data) { const result = expanded(data); return { ...result, items: window.playback.shuffleItems(result.items) }; }
function refreshed(data) {
  const next = expanded(data), byId = new Map(next.items.map(item => [item.id, item])), ordered = [];
  for (const item of state?.items || []) if (byId.has(item.id)) { ordered.push(byId.get(item.id)); byId.delete(item.id); }
  for (const item of window.playback.shuffleItems([...byId.values()])) ordered.splice(Math.floor(Math.random() * (ordered.length + 1)), 0, item);
  return { ...next, items: ordered };
}
function stopped() { return paused || blackout; }
function stopElement(element) { if (element?.tagName === 'VIDEO') { element.pause(); element.removeAttribute('src'); element.load(); } }
function beginObservation(unit, item, layout, tile, extra = {}) {
  if (!unit || !item) return;
  const playbackId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  unit.observation = { playbackId, kind: item.kind };
  api.playbackObservation({ event: 'shown', playbackId, layout, tile, itemId: item.id, sourceId: sourceOf(item), name: item.name, kind: item.kind, index: unit.index, excerptOrdinal: item.excerptOrdinal, excerptCount: item.excerptCount, ...extra }).catch(() => {});
}
function finishObservation(unit, reason) {
  const observation = unit?.observation; if (!observation) return;
  if (observation.kind === 'video') api.playbackObservation({ event: 'video-finished', playbackId: observation.playbackId, actualEnd: unit.element?.currentTime, reason }).catch(() => {});
  unit.observation = null;
}
function clearUnit(unit, reason = 'replaced') { if (!unit) return; finishObservation(unit, reason); clearTimeout(unit.timer); clearInterval(unit.watchdog); stopElement(unit.element); }
function cleanup() { generation++; clearTimeout(layoutTimer); layoutTimer = null; clearUnit(single); single = null; for (const slot of slots) { slot.generation++; clearUnit(slot); } slots = []; currentLayout = null; nextGridChangeAt = 0; gridDeck = []; gridRecent = []; stage.replaceChildren(); }
function photoTiming(item, slot = null) {
  const id = sourceOf(item), featured = !!id && boothFirstShowing.delete(id);
  const base = slot === null ? state.settings.seconds * 1000 : window.playback.photoDuration(state.settings.seconds) * GRID_RHYTHM[slot % GRID_RHYTHM.length];
  return { duration: window.playback.featuredPhotoDuration(base, featured), featured };
}
function applyGridFit(slot) {
  const element = slot?.element;
  if (!element) return;
  const sourceWidth = element.tagName === 'IMG' ? element.naturalWidth : element.videoWidth;
  const sourceHeight = element.tagName === 'IMG' ? element.naturalHeight : element.videoHeight;
  const fit = window.playback.mediaFit(state.settings.fit, sourceWidth, sourceHeight, slot.root.clientWidth, slot.root.clientHeight);
  element.style.objectFit = fit;
  element.dataset.effectiveFit = fit;
  slot.root.dataset.softFill = String(state.settings.fit === 'cover' && fit === 'contain');
}

function setBackdrop(root, source) { root.style.setProperty('--backdrop', `url(${JSON.stringify(source)})`); }
function captureVideoBackdrop(slot, element) {
  try {
    if (!element.videoWidth || !element.videoHeight) return;
    const canvas = document.createElement('canvas'), width = 360;
    canvas.width = width; canvas.height = Math.max(1, Math.round(width * element.videoHeight / element.videoWidth));
    canvas.getContext('2d').drawImage(element, 0, 0, canvas.width, canvas.height);
    setBackdrop(slot.root, canvas.toDataURL('image/jpeg', .68));
  } catch {}
}
function sourceOf(item) { return item?.sourceId || item?.id; }
function isBooth(item) { return item?.source === 'booth' || String(sourceOf(item) || '').startsWith('booth-'); }
function queueBoothPriority(items) {
  for (const item of items) {
    const id = sourceOf(item);
    if (isBooth(item) && id && !boothPriority.includes(id)) boothPriority.push(id);
  }
}
function takeBoothPriority(occupied = new Set(), current = null) {
  for (let position = 0; position < boothPriority.length; position++) {
    const id = boothPriority[position], itemIndex = state.items.findIndex(item => sourceOf(item) === id);
    if (itemIndex < 0) { boothPriority.splice(position--, 1); continue; }
    const identity = contentOf(state.items[itemIndex]);
    if (identity === current || occupied.has(identity)) continue;
    boothPriority.splice(position, 1);
    boothFirstShowing.add(id);
    const deckPosition = gridDeck.indexOf(itemIndex); if (deckPosition >= 0) gridDeck.splice(deckPosition, 1);
    gridRecent.push(identity); if (gridRecent.length > 80) gridRecent.shift();
    return itemIndex;
  }
  return null;
}
function contentOf(item) {
  if (item?.kind !== 'video' || !Number.isFinite(item.duration)) return sourceOf(item);
  const name = String(item.name || '').toLowerCase().replace(/\.[^.]+$/, '').replace(/\s+/g, ' ').trim();
  return `video:${name}:${Math.round(item.duration)}`;
}
function rememberDimensions(item, width, height) {
  if (!width || !height) return;
  const source = sourceOf(item);
  for (const candidate of state.items) if (sourceOf(candidate) === source) { candidate.width = width; candidate.height = height; }
}
function matchingGridIndex(slot, candidates) {
  const target = slot.targetRatio || 1, known = candidates.map(index => {
    const item = state.items[index], ratio = item?.width > 0 && item?.height > 0 ? item.width / item.height : null;
    return { index, score: ratio ? Math.abs(Math.log(ratio / target)) : Infinity };
  });
  const finite = known.filter(candidate => Number.isFinite(candidate.score));
  if (!finite.length) return candidates[Math.floor(Math.random() * candidates.length)];
  const best = Math.min(...finite.map(candidate => candidate.score));
  const close = finite.filter(candidate => candidate.score <= best + .2);
  return close[Math.floor(Math.random() * close.length)].index;
}
function resetGridDeck(excludeIds = new Set()) {
  const entries = state.items.map((item, itemIndex) => ({ id: item.id, sourceId: item.sourceId, itemIndex })).filter(entry => !excludeIds.has(entry.id));
  gridDeck = window.playback.shuffleItems(entries).map(entry => entry.itemIndex);
}
function takeGridIndex(slot, occupiedOverride) {
  const occupied = occupiedOverride || new Set(slots.filter(other => other !== slot && other.active && other.element).map(other => contentOf(state.items[other.index])));
  const current = slot.element ? contentOf(state.items[slot.index]) : null;
  const booth = takeBoothPriority(occupied, current); if (booth !== null) return booth;
  const choose = allowRecent => {
    const candidates = [];
    for (const itemIndex of gridDeck) {
      const identity = contentOf(state.items[itemIndex]);
      if (identity !== current && !occupied.has(identity) && (allowRecent || !gridRecent.includes(identity))) candidates.push(itemIndex);
      if (candidates.length >= 48) break;
    }
    if (!candidates.length) return null;
    const selected = matchingGridIndex(slot, candidates), position = gridDeck.indexOf(selected); gridDeck.splice(position, 1);
    const identity = contentOf(state.items[selected]); gridRecent.push(identity); if (gridRecent.length > 80) gridRecent.shift();
    return selected;
  };
  if (!gridDeck.length) resetGridDeck();
  let selected = choose(false) ?? choose(true);
  if (selected === null) { resetGridDeck(); selected = choose(false) ?? choose(true); }
  return selected ?? slot.index;
}

function scheduleSingle() {
  clearTimeout(single.timer);
  if (!stopped() && !single.loading && single.element) {
    single.started = performance.now(); single.timer = setTimeout(() => { finishObservation(single, 'timer'); showSingle(single.index + 1); }, single.remaining);
  }
}

function showSingle(next) {
  if (!state?.items.length) { cleanup(); readout.hidden = true; status('The playlist is empty. Close the output and add media.'); return; }
  const booth = takeBoothPriority(new Set(), single?.element ? contentOf(state.items[single.index]) : null); if (booth !== null) next = booth;
  if (next >= state.items.length) {
    const previous = state.items[single?.index], previousSource = previous?.sourceId || previous?.id;
    state = { ...state, items: window.playback.shuffleItems(state.items) }; next = 0;
    if (state.items.length > 1 && (state.items[0]?.sourceId || state.items[0]?.id) === previousSource) [state.items[0], state.items[1]] = [state.items[1], state.items[0]];
  } else if (next < 0) next = state.items.length - 1;
  const failures = single?.failed || 0; clearUnit(single); const mine = ++generation;
  index = (next + state.items.length) % state.items.length;
  const item = state.items[index], element = document.createElement(item.kind === 'image' ? 'img' : 'video');
  single = { element, index, loading: true, timer: null, watchdog: null, remaining: state.settings.seconds * 1000, started: 0, lastProgress: performance.now(), lastTime: -1, failed: failures, excerptEnd: null, observation: null };
  const previousNodes = [...stage.children];
  readout.hidden = true; stage.className = 'single'; stage.dataset.layout = 'single'; element.style.objectFit = state.settings.fit;
  if (previousNodes.some(node => node.classList?.contains('visible'))) stage.append(element); else stage.replaceChildren(element);
  const reveal = () => { requestAnimationFrame(() => element.classList.add('visible')); setTimeout(() => previousNodes.forEach(node => { if (node !== element) node.remove(); }), 900); };
  const fail = () => {
    if (mine !== generation) return; const nextFailures = single.failed + 1; clearUnit(single);
    if (nextFailures >= state.items.length) { paused = true; single.loading = false; status('No playable media. Close the output and use Check playback.'); return; }
    single.failed = nextFailures; status(`Skipping ${item.name}: unable to play.`); single.timer = setTimeout(() => showSingle(index + 1), 1000);
  };
  element.onerror = fail;
  single.watchdog = setInterval(() => {
    if (mine !== generation) return;
    if (single.loading && performance.now() - single.lastProgress > 15000) return fail();
    if (element.tagName === 'VIDEO' && !stopped() && !single.loading) {
      if (element.currentTime !== single.lastTime) { single.lastTime = element.currentTime; single.lastProgress = performance.now(); }
      else if (performance.now() - single.lastProgress > 15000) fail();
    } else if (!single.loading) single.lastProgress = performance.now();
  }, 1000);
  if (item.kind === 'image') {
    element.onload = () => { if (mine !== generation) return; single.loading = false; single.failed = 0; clearInterval(single.watchdog); window.readout.render(readout, item, { ...state.settings, camera: false }); reveal(); const timing = photoTiming(item); beginObservation(single, item, 'single', 0, timing.featured ? { featured: 1 } : {}); single.remaining = timing.duration; scheduleSingle(); };
  } else {
    element.muted = !state.settings.sound; element.playsInline = true; element.preload = 'auto';
    let launched = false, requestedStart = 0, requestedEnd = null, videoDuration = null;
    const launch = () => {
      if (mine !== generation || launched || element.seeking) return;
      if (requestedStart > .05 && Math.abs(element.currentTime - requestedStart) > .5) { element.currentTime = requestedStart; return; }
      launched = true; single.loading = false; single.failed = 0; single.lastProgress = performance.now();
      reveal(); scheduleSingle(); if (!stopped()) element.play().then(() => { if (mine === generation) beginObservation(single, item, 'single', 0, { duration: videoDuration, requestedStart, requestedEnd, actualStart: element.currentTime }); }).catch(fail);
    };
    element.onloadedmetadata = () => {
      if (mine !== generation) return;
      const duration = Number.isFinite(element.duration) ? element.duration : item.duration; videoDuration = duration;
      const excerpt = chooseVideoExcerpt(item, duration); requestedStart = excerpt.start; requestedEnd = excerpt.end;
      single.excerptEnd = excerpt.chopped ? excerpt.end : null;
      single.remaining = window.playback.videoPlaybackSeconds(duration, excerpt) * 1000;
      if (excerpt.chopped && excerpt.start > 0.05) element.currentTime = excerpt.start;
    };
    element.onseeked = launch; element.oncanplay = launch;
    element.ontimeupdate = () => { if (mine === generation && single.excerptEnd !== null && element.currentTime >= single.excerptEnd - 0.08) { finishObservation(single, 'excerpt-end'); showSingle(index + 1); } };
    element.onended = () => { if (mine === generation) { finishObservation(single, 'video-ended'); showSingle(index + 1); } };
  }
  element.src = item.url; status();
}

function nextGridIndex(slot, direction = 1) {
  if (direction > 0) return takeGridIndex(slot);
  const total = state.items.length, occupied = new Set(slots.filter(other => other !== slot && other.active).map(other => contentOf(state.items[other.index]))), current = contentOf(state.items[slot.index]);
  for (let step = 1; step <= total; step++) { const candidate = (slot.index - step + total) % total, identity = contentOf(state.items[candidate]); if (identity !== current && !occupied.has(identity)) return candidate; }
  return slot.index;
}

function scheduleGrid(slot) {
  clearTimeout(slot.timer);
  if (slot.active && !stopped() && !slot.loading && slot.element) {
    slot.started = performance.now(); slot.timer = setTimeout(() => queueGridAdvance(slot, slot.element.tagName === 'VIDEO', 'timer'), slot.remaining);
  }
}

function queueGridAdvance(slot, urgent = false, reason = 'timer') {
  if (!slot.active || slot.advanceQueued) return;
  clearTimeout(slot.timer); slot.advanceQueued = true;
  const now = performance.now(), changeAt = urgent ? now : Math.max(now, nextGridChangeAt);
  nextGridChangeAt = changeAt + 850;
  const change = () => { slot.advanceQueued = false; finishObservation(slot, reason); if (slot.active) showGrid(slot, nextGridIndex(slot)); };
  if (changeAt - now > 20) slot.timer = setTimeout(change, changeAt - now); else change();
}

function showGrid(slot, next) {
  if (!slot.active) return;
  const previousNodes = [...slot.root.children]; clearUnit(slot); slot.advanceQueued = false; const mine = ++slot.generation;
  slot.index = (next + state.items.length) % state.items.length; const item = state.items[slot.index];
  const element = document.createElement(item.kind === 'image' ? 'img' : 'video'), caption = document.createElement('div'); slot.element = element; slot.loading = true; slot.lastProgress = performance.now(); slot.lastTime = -1; slot.excerptEnd = null;
  caption.className = 'metadata-readout grid-readout'; caption.hidden = true;
  element.crossOrigin = 'anonymous';
  slot.root.style.removeProperty('--backdrop'); slot.root.dataset.softFill = 'false';
  if (item.kind === 'image') setBackdrop(slot.root, item.url);
  element.style.objectFit = state.settings.fit; element.playsInline = true; element.preload = 'auto'; element.muted = true;
  if (previousNodes.some(node => node.classList?.contains('visible'))) slot.root.append(element, caption); else slot.root.replaceChildren(element, caption);
  if (slot.id === 0) { index = slot.index; status(); }
  const fail = () => {
    if (mine !== slot.generation) return; slot.failed++;
    if (slot.failed >= state.items.length) { clearUnit(slot); slot.root.replaceChildren(); slot.root.classList.add('unavailable'); status('A grid tile could not find playable media. Use Check playback.'); return; }
    status(`Skipping ${item.name}: unable to play.`); slot.timer = setTimeout(() => showGrid(slot, nextGridIndex(slot)), 600);
  };
  element.onerror = fail;
  slot.watchdog = setInterval(() => {
    if (mine !== slot.generation) return;
    if (slot.loading && performance.now() - slot.lastProgress > 15000) return fail();
    if (element.tagName === 'VIDEO' && !stopped() && !slot.loading) {
      if (element.currentTime !== slot.lastTime) { slot.lastTime = element.currentTime; slot.lastProgress = performance.now(); }
      else if (performance.now() - slot.lastProgress > 15000) fail();
    } else if (!slot.loading) slot.lastProgress = performance.now();
  }, 1000);
  const ready = () => { if (mine !== slot.generation) return; slot.loading = false; slot.failed = 0; slot.root.classList.remove('unavailable'); requestAnimationFrame(() => element.classList.add('visible')); setTimeout(() => previousNodes.forEach(node => { if (node !== element && node !== caption) node.remove(); }), 900); };
  if (item.kind === 'image') {
    element.onload = () => { rememberDimensions(item, element.naturalWidth, element.naturalHeight); applyGridFit(slot); window.readout.render(caption, item, { ...state.settings, camera: false }); ready(); if (mine !== slot.generation) return; const timing = photoTiming(item, slot.id); beginObservation(slot, item, 'grid', slot.id, timing.featured ? { featured: 1 } : {}); clearInterval(slot.watchdog); slot.remaining = timing.duration; scheduleGrid(slot); };
  } else {
    let launched = false, requestedStart = 0, requestedEnd = null, videoDuration = null;
    const launch = () => {
      if (mine !== slot.generation || launched || element.seeking) return;
      if (requestedStart > .05 && Math.abs(element.currentTime - requestedStart) > .5) { element.currentTime = requestedStart; return; }
      launched = true; captureVideoBackdrop(slot, element); ready(); slot.lastProgress = performance.now(); scheduleGrid(slot);
      if (!stopped()) element.play().then(() => { if (mine === slot.generation) beginObservation(slot, item, 'grid', slot.id, { duration: videoDuration, requestedStart, requestedEnd, actualStart: element.currentTime }); }).catch(fail);
    };
    element.onloadedmetadata = () => {
      if (mine !== slot.generation) return;
      rememberDimensions(item, element.videoWidth, element.videoHeight);
      applyGridFit(slot);
      const duration = Number.isFinite(element.duration) ? element.duration : item.duration; videoDuration = duration;
      const excerpt = chooseVideoExcerpt(item, duration); requestedStart = excerpt.start; requestedEnd = excerpt.end;
      element.dataset.excerptStart = String(excerpt.start);
      element.dataset.excerptEnd = String(excerpt.end);
      element.dataset.excerpted = String(excerpt.chopped);
      slot.excerptEnd = excerpt.chopped ? excerpt.end : null;
      slot.remaining = window.playback.videoPlaybackSeconds(duration, excerpt) * 1000;
      if (excerpt.chopped && excerpt.start > 0.05) element.currentTime = excerpt.start;
    };
    element.onseeked = launch;
    element.oncanplay = launch;
    element.ontimeupdate = () => {
      if (mine === slot.generation && slot.excerptEnd !== null && element.currentTime >= slot.excerptEnd - 0.08) queueGridAdvance(slot, true, 'excerpt-end');
    };
    element.onended = () => { if (mine === slot.generation) queueGridAdvance(slot, true, 'video-ended'); };
  }
  element.src = item.url;
}

function smallLayout(count) { return { name: `small-${count}`, rects: Array.from({ length: count }, (_, i) => [i / count, 0, 1 / count, 1]) }; }
function layoutsFor(count) { const layouts = GRID_LAYOUTS.filter(layout => layout.rects.length <= count); return layouts.length ? layouts : [smallLayout(count)]; }
function rectRatio(rect) { return (stage.clientWidth / stage.clientHeight) * rect[2] / rect[3]; }
function place(slot, rect) {
  const [x,y,w,h] = rect; slot.targetRatio = rectRatio(rect);
  slot.root.style.left = `calc(${x * 100}% + var(--gap))`; slot.root.style.top = `calc(${y * 100}% + var(--gap))`;
  slot.root.style.width = `calc(${w * 100}% - var(--gap))`; slot.root.style.height = `calc(${h * 100}% - var(--gap))`;
}
function slotScore(slot, ratio) {
  const item = slot.element && state.items[slot.index], itemRatio = item?.width > 0 && item?.height > 0 ? item.width / item.height : null;
  return itemRatio ? Math.abs(Math.log(itemRatio / ratio)) : 10;
}
function applyGridLayout(layout, initial = false) {
  currentLayout = layout; stage.dataset.count = String(layout.rects.length);
  const remaining = [...slots], assignments = [];
  const orderedRects = layout.rects.map((rect, position) => ({ rect, position, ratio: rectRatio(rect) })).sort((a,b) => Math.abs(Math.log(b.ratio)) - Math.abs(Math.log(a.ratio)));
  for (const target of orderedRects) {
    remaining.sort((a,b) => slotScore(a, target.ratio) - slotScore(b, target.ratio));
    assignments.push({ slot: remaining.shift(), ...target });
  }
  const chosen = new Set(assignments.map(assignment => assignment.slot));
  for (const slot of slots) if (!chosen.has(slot)) {
    slot.active = false; slot.advanceQueued = false; slot.root.dataset.active = 'false'; clearTimeout(slot.timer); clearInterval(slot.watchdog); if (slot.element?.tagName === 'VIDEO') slot.element.pause();
    setTimeout(() => { if (!slot.active) { clearUnit(slot); slot.element = null; slot.root.replaceChildren(); } }, 700);
  }
  const occupied = new Set(assignments.filter(({ slot }) => slot.element).map(({ slot }) => contentOf(state.items[slot.index])));
  for (const { slot, rect } of assignments.sort((a,b) => a.position - b.position)) {
    const wasActive = slot.active; slot.active = true; place(slot, rect); slot.root.dataset.active = 'true';
    if (!slot.element) {
      slot.index = takeGridIndex(slot, occupied); occupied.add(contentOf(state.items[slot.index])); showGrid(slot, slot.index);
    } else {
      applyGridFit(slot);
      if (!wasActive) { slot.advanceQueued = false; scheduleGrid(slot); if (slot.element.tagName === 'VIDEO' && !stopped()) slot.element.play().catch(() => {}); }
    }
  }
  if (!initial) status();
}
function scheduleLayoutChange() {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(() => {
    if (stopped()) { scheduleLayoutChange(); return; }
    const options = layoutsFor(slots.length).filter(layout => layout.name !== currentLayout?.name), next = options[Math.floor(Math.random() * options.length)];
    if (next) applyGridLayout(next);
    scheduleLayoutChange();
  }, 70000 + Math.random() * 50000);
}
function startGrid() {
  cleanup(); readout.hidden = true; stage.className = 'grid'; stage.dataset.layout = 'grid';
  const count = Math.min(6, new Set(state.items.map(sourceOf)).size);
  for (let id = 0; id < count; id++) {
    const root = document.createElement('div'); root.className = 'grid-tile'; root.dataset.active = 'false'; stage.append(root);
    slots.push({ id, root, index: 0, targetRatio: 1, active: false, element: null, timer: null, watchdog: null, remaining: state.settings.seconds * 1000, started: 0, loading: true, failed: 0, generation: 0, advanceQueued: false, observation: null });
  }
  resetGridDeck();
  const options = layoutsFor(count), fullest = options.filter(option => option.rects.length === count), choices = fullest.length ? fullest : options;
  const layout = choices[Math.floor(Math.random() * choices.length)]; applyGridLayout(layout, true); scheduleLayoutChange(); status();
}
if (new URLSearchParams(location.search).get('test') === '1') window.__testGridLayout = count => {
  const layout = GRID_LAYOUTS.find(candidate => candidate.rects.length === count);
  if (layout) applyGridLayout(layout);
};

function start(offset = 0) {
  if (!state?.items.length) { cleanup(); readout.hidden = true; status('The playlist is empty. Close the output and add media.'); return; }
  if (state.settings.layout === 'grid') startGrid(offset); else { cleanup(); showSingle(offset); }
}

function transport(action) {
  if (!state) return;
  if (action === 'next' || action === 'previous') {
    const direction = action === 'next' ? 1 : -1;
    if (state.settings.layout === 'grid') for (const slot of [...slots]) { slot.failed = 0; showGrid(slot, nextGridIndex(slot, direction)); }
    else { if (single) single.failed = 0; showSingle(index + direction); }
    return;
  }
  const wasStopped = stopped();
  if (action === 'pause') paused = !paused;
  if (action === 'blackout') blackout = !blackout;
  document.getElementById('curtain').hidden = !blackout;
  const units = state.settings.layout === 'grid' ? slots : single ? [single] : [];
  if (!wasStopped && stopped()) {
    for (const unit of units) {
      if (unit.element && !unit.loading) { unit.remaining = Math.max(1, unit.remaining - (performance.now() - unit.started)); clearTimeout(unit.timer); unit.advanceQueued = false; }
      if (unit.element?.tagName === 'VIDEO') unit.element.pause();
    }
  } else if (wasStopped && !stopped()) {
    for (const unit of units) { if (unit.element?.tagName === 'VIDEO' && !unit.loading) unit.element.play().catch(() => status('Could not resume video.')); if (state.settings.layout === 'grid') scheduleGrid(unit); else scheduleSingle(); }
  }
  status();
}

api.on('play', data => {
  state = randomized(data); paused = false; blackout = false; boothPriority = []; boothFirstShowing = new Set();
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  queueBoothPriority(state.items.filter(item => { const taken = Date.parse(item.createdAt || ''); return isBooth(item) && Number.isFinite(taken) && taken >= fiveMinutesAgo; }));
  document.getElementById('curtain').hidden = true; start(0);
});
api.on('playlist', data => {
  const previousLayout = state?.settings.layout;
  const units = previousLayout === 'grid' ? slots : single ? [single] : [];
  const currentIds = units.map(unit => state?.items[unit.index]?.id || null);
  const previousItems = state?.items || [], knownSources = new Set(previousItems.map(sourceOf)), knownIds = new Set(previousItems.map(item => item.id));
  const remainingDeckIds = previousLayout === 'grid' ? gridDeck.map(itemIndex => previousItems[itemIndex]?.id).filter(Boolean) : [];
  state = refreshed(data);
  queueBoothPriority(state.items.filter(item => isBooth(item) && !knownSources.has(sourceOf(item))));
  units.forEach((unit, position) => { const next = state.items.findIndex(item => item.id === currentIds[position]); if (next >= 0) unit.index = next; });
  if (previousLayout === 'grid') {
    const current = new Set(currentIds.filter(Boolean)), queued = new Set(remainingDeckIds);
    gridDeck = remainingDeckIds.map(id => state.items.findIndex(item => item.id === id)).filter(index => index >= 0);
    const added = window.playback.shuffleItems(state.items.filter(item => !knownIds.has(item.id) && !current.has(item.id) && !queued.has(item.id)));
    for (const item of added) gridDeck.splice(Math.floor(Math.random() * (gridDeck.length + 1)), 0, state.items.indexOf(item));
  }
  if (previousLayout === 'grid' && slots[0]) index = slots[0].index; else if (single) index = single.index;
  if (!stage.children.length || previousLayout !== state.settings.layout) { start(index); return; }
  for (const unit of units) { if (unit.element) { if (state.settings.layout === 'grid') applyGridFit(unit); else unit.element.style.objectFit = state.settings.fit; if (unit.element.tagName === 'VIDEO') unit.element.muted = state.settings.layout === 'grid' || !state.settings.sound; } }
  if (state.settings.layout === 'single' && single && !single.loading) window.readout.render(readout, state.items[single.index], { ...state.settings, camera: false });
  if (state.settings.layout === 'grid') for (const slot of slots.filter(slot => slot.active && slot.element?.tagName === 'IMG')) {
    const caption = slot.root.querySelector('.grid-readout'); if (caption) window.readout.render(caption, state.items[slot.index], { ...state.settings, camera: false });
  }
});
api.on('transport', transport);
window.addEventListener('keydown', event => { if (event.key === 'Escape') window.close(); if (event.code === 'Space') { event.preventDefault(); transport('pause'); } if (event.key === 'ArrowRight') transport('next'); if (event.key === 'ArrowLeft') transport('previous'); if (event.key.toLowerCase() === 'b') transport('blackout'); });
window.addEventListener('resize', () => { if (state?.settings.layout === 'grid') { if (currentLayout) applyGridLayout(currentLayout, true); for (const slot of slots.filter(slot => slot.active)) applyGridFit(slot); } });
