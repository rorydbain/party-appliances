/* All media stays on this Mac. No remote services, fonts, or analytics. */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = window.party;
let toastTimer;
function toast(message, persistent = false) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); if (!persistent) toastTimer = setTimeout(() => $('#toast').hidden = true, 6000); }
function action(fn) { return async (...args) => { try { await fn(...args); } catch(e) { toast(e.message, true); } }; }
const brand = (name, caption) => `<header><div class="brand"><span class="wordmark">${name}<span style="color:#849772">.</span></span><span class="edition">${caption}<br>PARTY APPLIANCES / 001</span></div><span class="status"><i class="dot"></i> Local to this Mac</span></header>`;
const filters = { original: 'none', 'warm-film': 'url(#portra400)', 'soft-neutral': 'saturate(.96) contrast(.97) brightness(1.01)', mono: 'grayscale(1) contrast(1.08)' };
let boot;
(async () => {
  boot = await api.bootstrap();
  const mode = new URLSearchParams(location.search).get('mode');
  if (mode === 'loop') await renderLoop(); else if (mode === 'booth') await renderBooth(); else renderHome();
})().catch(e => { $('#app').innerHTML = `<main class="shell"><h1>Something needs attention.</h1><p>${esc(e.message)}</p></main>`; });
function renderHome() {
  $('#app').innerHTML = `<main class="shell">${brand('Party appliances', 'LOOP + PHOTOBOOTH')}<div class="topline"><div><h1>Choose an app</h1></div></div><div class="home-grid"><section class="home-card"><p class="eyebrow">01 / PROJECTION</p><h2>Loop</h2><p>Play an ordered sequence of photos and videos on a second display.</p><button class="primary" id="open-loop">Open Loop →</button></section><section class="home-card"><p class="eyebrow">02 / PHOTO BOOTH</p><h2>Photobooth</h2><p>Take and save treated photographs.</p><button class="primary" id="open-booth">Open Photobooth →</button></section></div></main>`;
  $('#open-loop').onclick = () => { history.replaceState(null, '', '?mode=loop'); renderLoop(); };
  $('#open-booth').onclick = () => { history.replaceState(null, '', '?mode=booth'); renderBooth(); };
}
async function renderLoop() {
  document.title = 'Loop — Projection player';
  let state = boot.state, active = false, paused = false, blackout = false, current = 0, checking = false, feedCount = boot.liveFeed?.count || 0, probingDurations = false, durationProbePromise = null, optimization = boot.optimization || { count: 0, bytes: 0 }, optimizing = false, duplicateScanning = false, duplicateGroups = [], duplicateIndex = 0, searchQuery = '';
  const durations = new Map(state.items.filter(item => Number.isFinite(item.duration)).map(item => [item.id, item.duration]));
  const dimensions = new Map(state.items.filter(item => item.width > 0 && item.height > 0).map(item => [item.id, { width: item.width, height: item.height }]));
  const problems = new Map();
  $('#app').innerHTML = `<main class="shell">${brand('Loop', 'PROJECTION')}<div class="topline"><div><p class="eyebrow">LOOP</p><h1>Projection</h1></div><button id="import" class="primary">＋ Add photos & videos</button></div><div class="layout"><section><div class="monitor" id="preview"><div class="empty"><div class="aperture">[ &nbsp; ]</div><h2>No media added</h2><p>Add photos and videos, then choose their order.</p><button class="lime" id="empty-import">Choose media →</button></div><span class="monitor-tag">OUTPUT PREVIEW · NOTHING PLAYING</span></div><div class="transport"><button class="small" id="previous" disabled aria-label="Previous item">←</button><button class="small" id="pause" disabled>Pause</button><button class="small" id="next" disabled aria-label="Next item">→</button><button class="small" id="blackout" disabled>Blackout</button><span class="now" id="now">Ready</span></div><div class="playlist-heading"><h2>Sequence <small id="count"></small></h2><button class="ghost small" id="check">Check playback</button></div><div class="sequence-search"><input id="sequence-search" type="search" placeholder="Search name, caption, place, date, type…" autocomplete="off" spellcheck="false"><span id="search-count"></span></div><p class="search-help">Try <code>place:glasgow</code>, <code>date:2014</code>, <code>type:video</code>, <code>caption:kitchen</code>, <code>has:place</code> or <code>missing:date</code>.</p><ol id="playlist" class="list"></ol><p id="check-result" class="help">Files are copied into a local library, so moving the originals won’t break the show.</p></section><aside><section class="panel"><p class="eyebrow">01 / DISPLAY</p><label for="display">Play on</label><select id="display"></select><p class="help">Use an extended display for the projector. Your controls stay on the Mac.</p><button id="start" class="primary wide" disabled>Start projection ↗</button><button id="stop" class="ghost wide" disabled>Close output</button></section><section class="panel"><p class="eyebrow">02 / PLAYBACK</p><label for="playback-layout">Layout</label><select id="playback-layout"><option value="single">Single item</option><option value="grid">Grid · up to 6 items</option></select><label for="seconds">Seconds per photo</label><input id="seconds" type="number" min="2" max="60" value="${state.settings.seconds}"><label for="fit">Image placement</label><select id="fit"><option value="contain">Show the whole image</option><option value="cover">Balanced fill · avoid heavy crops</option></select><div class="row"><label for="sound">Video sound</label><input id="sound" type="checkbox"></div><p class="help" id="playback-help">Videos play to the end. The sequence repeats automatically.</p><p class="notice" id="runtime">Estimated rotation · calculating…</p><p class="help" id="live-feed-status">${esc(boot.liveFeed?.message || 'Photo booth feed connects automatically when online.')}</p><button id="optimise-videos" class="wide">Optimise large videos</button><p id="optimise-status" class="help" role="status"></p></section><section class="panel"><p class="eyebrow">03 / DETAILS</p><div class="row"><label for="metadata">Show captions and dates</label><input id="metadata" type="checkbox"></div><label for="metadata-corner">Readout position</label><select id="metadata-corner"><option value="right">Bottom right</option><option value="left">Bottom left</option></select><div class="row"><label for="gps">Show location</label><input id="gps" type="checkbox"></div><button id="tag-media" class="primary wide">Review captions & dates</button><p class="help">Quickly review every photo and film. Your corrections override embedded metadata without changing the original files.</p><button id="find-duplicates" class="wide">Find duplicates</button><p id="duplicate-status" class="help" role="status">Checks file contents and the picture itself, so renamed and recompressed copies can still be found.</p><button id="lookup-places" class="wide">Find place names</button><button id="cancel-places" class="ghost wide" hidden>Stop lookup</button><p id="place-progress" class="help" role="status">Run once while online. Uses Apple’s location service; sends coordinates only, never your photos. Results are best effort.</p></section></aside></div><footer class="footer"><button id="reveal" class="ghost small">Open library folder ↗</button><span id="disk">${boot.freeGB} GB free on this Mac</span></footer></main><div id="tagger" class="tagger" hidden></div><div id="duplicate-review" class="duplicate-review" hidden></div>`;
  function showDisplays(list) { $('#display').innerHTML = list.map(d => `<option value="${d.id}">${esc(d.label)}</option>`).join(''); const external = list.find(d => !d.internal); if (external) $('#display').value = external.id; }
  showDisplays(boot.displays); api.on('displays-changed', showDisplays);
  $('#playback-layout').value = state.settings.layout; $('#fit').value = state.settings.fit; $('#sound').checked = state.settings.sound; $('#metadata').checked = state.settings.metadata; $('#gps').checked = state.settings.gps; $('#metadata-corner').value = state.settings.metadataCorner;
  function updateLayoutHelp() { const grid = $('#playback-layout').value === 'grid'; $('#sound').disabled = grid; $('#playback-help').textContent = grid ? 'Tiles change independently. Longer videos return later with another 8–12 second excerpt and remain muted.' : 'Longer videos return later with another 8–12 second excerpt.'; }
  updateLayoutHelp();
  const formatBytes = bytes => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
  $('#optimise-status').insertAdjacentHTML('afterend', '<button id="open-playback-log" class="ghost wide">Open playback history ↗</button>');
  $('#open-playback-log').onclick = action(() => api.reveal('playback'));
  function showOptimization(text) {
    $('#optimise-videos').disabled = active || optimizing || !optimization.count;
    $('#optimise-status').textContent = text || (optimization.count ? `${optimization.count} large ${optimization.count === 1 ? 'video' : 'videos'} · ${formatBytes(optimization.bytes)}. Creates smaller 1080p playback copies.` : 'No large videos need optimisation.');
  }
  showOptimization();
  function formatRuntime(value) {
    const seconds = Math.max(1, Math.round(value));
    if (seconds < 60) return `${seconds} sec`;
    const minutes = Math.floor(seconds / 60), remainder = seconds % 60;
    return remainder ? `${minutes} min ${remainder} sec` : `${minutes} min`;
  }
  function updateEstimate() {
    const photoCount = state.items.filter(item => item.kind === 'image').length + feedCount;
    const videos = state.items.filter(item => item.kind === 'video');
    const videoCount = videos.reduce((total, item) => total + window.playback.videoAppearances(durations.get(item.id)), 0), itemCount = photoCount + videoCount;
    let photoSeconds = photoCount * Number($('#seconds').value || state.settings.seconds);
    let videoSeconds = videos.reduce((total, item) => total + window.playback.estimatedVideoSeconds(durations.get(item.id)) * window.playback.videoAppearances(durations.get(item.id)), 0);
    if ($('#playback-layout').value === 'grid' && itemCount) {
      const concurrency = Math.min(6, photoCount + videos.length), rhythms = [0.82, 1.08, 1.31, 0.94, 1.19, 1.43].slice(0, concurrency);
      photoSeconds *= 1.03 * rhythms.reduce((total, value) => total + value, 0) / rhythms.length;
      videoSeconds /= concurrency; photoSeconds /= concurrency;
    }
    $('#runtime').textContent = itemCount ? `Estimated rotation · about ${formatRuntime(photoSeconds + videoSeconds)}` : 'Estimated rotation · add some media';
  }
  async function probeDurations() {
    if (durationProbePromise) return durationProbePromise;
    probingDurations = true;
    durationProbePromise = (async () => {
      while (true) {
        const pending = state.items.filter(item => !dimensions.has(item.id));
        if (!pending.length) break;
        const batch = pending.slice(0, 6), measured = await Promise.all(batch.map(async item => {
          const metric = await new Promise(resolve => {
          const element = document.createElement(item.kind === 'video' ? 'video' : 'img'); let finished = false;
          const done = value => { if (finished) return; finished = true; clearTimeout(timer); element.removeAttribute('src'); if (element.tagName === 'VIDEO') element.load(); resolve(value); };
          const timer = setTimeout(() => done(NaN), 8000);
          if (item.kind === 'video') { element.onloadedmetadata = () => done({ duration: element.duration, width: element.videoWidth, height: element.videoHeight }); element.preload = 'metadata'; }
          else element.onload = () => done({ width: element.naturalWidth, height: element.naturalHeight });
          element.onerror = () => done(null); element.src = item.url;
          });
          return { item, metric };
        }));
        const cache = [];
        for (const { item, metric } of measured) {
          if (metric?.width && metric?.height) { dimensions.set(item.id, { width: metric.width, height: metric.height }); item.width = metric.width; item.height = metric.height; cache.push({ id: item.id, ...metric }); }
          else dimensions.set(item.id, { width: 1, height: 1 });
          if (Number.isFinite(metric?.duration)) { durations.set(item.id, metric.duration); item.duration = metric.duration; }
        }
        if (cache.length) await api.cacheMediaMetrics(cache);
        updateEstimate();
      }
    })();
    try { await durationProbePromise; } finally { probingDurations = false; durationProbePromise = null; }
  }
  const settings = () => ({ seconds: Number($('#seconds').value), fit: $('#fit').value, layout: $('#playback-layout').value, sound: $('#sound').checked, metadata: $('#metadata').checked, gps: $('#gps').checked, metadataCorner: $('#metadata-corner').value });
  async function persist(items = state.items) { state = await api.playlist(items.map(i => i.id), settings()); drawList(); preview(current); }
  async function visualFingerprint(item) {
    return new Promise(resolve => {
      const image = new Image(), canvas = document.createElement('canvas'); canvas.width = 9; canvas.height = 8;
      let finished = false;
      const done = result => { if (finished) return; finished = true; clearTimeout(timer); image.onload = image.onerror = null; image.removeAttribute('src'); resolve(result); };
      const timer = setTimeout(() => done(null), 12000);
      image.onerror = () => done(null);
      image.onload = () => {
        try {
          const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0, 9, 8);
          const pixels = context.getImageData(0, 0, 9, 8).data; let hash = 0n, bit = 0n;
          const luma = index => pixels[index] * .299 + pixels[index + 1] * .587 + pixels[index + 2] * .114;
          for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { if (luma((y * 9 + x) * 4) > luma((y * 9 + x + 1) * 4)) hash |= 1n << bit; bit++; }
          done({ id: item.id, width: image.naturalWidth, height: image.naturalHeight, visualHash: hash.toString(16).padStart(16, '0') });
        } catch { done(null); }
      };
      image.src = item.url;
    });
  }
  function closeDuplicateReview() { const panel = $('#duplicate-review'); panel.querySelectorAll('video').forEach(video => video.pause()); panel.hidden = true; }
  function duplicateDescription(item) {
    const details = effectiveDetails(item), size = item.bytes ? formatBytes(item.bytes) : '';
    return [item.name, details.caption, details.place, details.date, item.width && item.height ? `${item.width} × ${item.height}` : '', size].filter(Boolean);
  }
  function renderDuplicateReview() {
    const panel = $('#duplicate-review');
    if (!duplicateGroups.length) { closeDuplicateReview(); $('#duplicate-status').textContent = 'No duplicates found.'; return; }
    duplicateIndex = Math.max(0, Math.min(duplicateIndex, duplicateGroups.length - 1));
    const group = duplicateGroups[duplicateIndex], exact = group.kind === 'exact';
    panel.innerHTML = `<div class="duplicate-head"><div><p class="eyebrow">DUPLICATE REVIEW</p><h2>${exact ? 'Exact copies' : 'Visually similar photos'}</h2><p>${exact ? 'These files have identical contents. The first copy is kept by default.' : 'These pictures look alike, but may be a burst or intentional variations. Nothing is selected automatically.'}</p></div><div><strong>${duplicateIndex + 1} / ${duplicateGroups.length}</strong><button id="duplicate-close" class="ghost">Done</button></div></div><div class="duplicate-grid">${group.items.map((item, index) => `<label class="duplicate-card"><span class="duplicate-picture">${item.kind === 'image' ? `<img src="${item.url}" alt="${esc(item.name)}">` : `<video src="${item.url}" controls muted preload="metadata"></video>`}</span><span class="duplicate-details">${duplicateDescription(item).map((value, detailIndex) => detailIndex ? `<small>${esc(value)}</small>` : `<strong>${esc(value)}</strong>`).join('')}</span><span class="duplicate-choice"><input type="checkbox" value="${item.id}" ${exact && index > 0 ? 'checked' : ''}> Delete this copy</span></label>`).join('')}</div><div class="duplicate-actions"><button id="duplicate-previous" ${duplicateIndex === 0 ? 'disabled' : ''}>← Previous</button><button id="duplicate-next">${duplicateIndex === duplicateGroups.length - 1 ? 'Finish' : 'Skip →'}</button><button id="duplicate-delete" class="danger">Delete selected</button></div>`;
    panel.hidden = false;
    const updateDelete = () => { const count = panel.querySelectorAll('input:checked').length; $('#duplicate-delete').disabled = !count; $('#duplicate-delete').textContent = count ? `Delete selected · ${count}` : 'Delete selected'; };
    panel.querySelectorAll('input').forEach(input => input.onchange = updateDelete); updateDelete();
    $('#duplicate-close').onclick = closeDuplicateReview;
    $('#duplicate-previous').onclick = () => { duplicateIndex--; renderDuplicateReview(); };
    $('#duplicate-next').onclick = () => { if (duplicateIndex >= duplicateGroups.length - 1) closeDuplicateReview(); else { duplicateIndex++; renderDuplicateReview(); } };
    $('#duplicate-delete').onclick = action(async () => {
      const ids = [...panel.querySelectorAll('input:checked')].map(input => input.value); if (!ids.length) return;
      if (!confirm(`Move ${ids.length} selected ${ids.length === 1 ? 'copy' : 'copies'} to the Trash?\n\nOnly Loop’s library copies are removed. Your original files are untouched.`)) return;
      state = await api.removeMediaMany(ids); duplicateGroups = window.duplicateTools.groupItems(state.items); duplicateIndex = Math.min(duplicateIndex, Math.max(0, duplicateGroups.length - 1));
      drawList(); preview(Math.min(current, state.items.length - 1)); renderDuplicateReview();
      $('#duplicate-status').textContent = duplicateGroups.length ? `${duplicateGroups.length} possible duplicate ${duplicateGroups.length === 1 ? 'group' : 'groups'} left.` : 'Duplicate review complete.';
    });
  }
  async function findDuplicates() {
    if (duplicateScanning || !state.items.length) return; duplicateScanning = true; drawList();
    try {
      $('#duplicate-status').textContent = 'Checking file contents…';
      const hashed = await api.scanContentHashes(); state = hashed.state;
      const pending = state.items.filter(item => item.kind === 'image' && !/^[a-f0-9]{16}$/.test(item.visualHash || ''));
      let completed = 0;
      for (let start = 0; start < pending.length; start += 4) {
        $('#duplicate-status').textContent = `Comparing pictures · ${completed.toLocaleString()} / ${pending.length.toLocaleString()}`;
        const metrics = (await Promise.all(pending.slice(start, start + 4).map(visualFingerprint))).filter(Boolean);
        metrics.forEach(metric => { const item = state.items.find(entry => entry.id === metric.id); if (item) Object.assign(item, metric); });
        if (metrics.length) await api.cacheMediaMetrics(metrics); completed += Math.min(4, pending.length - start);
      }
      duplicateGroups = window.duplicateTools.groupItems(state.items); duplicateIndex = 0;
      $('#duplicate-status').textContent = duplicateGroups.length ? `${duplicateGroups.length} possible duplicate ${duplicateGroups.length === 1 ? 'group' : 'groups'} found.` : 'No duplicates found.';
      if (duplicateGroups.length) renderDuplicateReview();
    } finally { duplicateScanning = false; drawList(); }
  }
  let tagFilter = 'unreviewed', tagIndex = 0, tagSaving = false;
  const automaticDetails = item => ({
    caption: '',
    date: item.metadata?.source === 'scan' ? '' : String(item.metadata?.capturedAt || '').slice(0, 10),
    place: String(item.metadata?.placeName || '')
  });
  const effectiveDetails = item => {
    const automatic = automaticDetails(item), manual = item.metadata?.manual || {}, has = key => Object.prototype.hasOwnProperty.call(manual, key);
    return { caption: has('caption') ? manual.caption : automatic.caption, date: has('date') ? manual.date : automatic.date, place: has('place') ? manual.place : automatic.place };
  };
  const previousDetails = key => {
    const values = new Map();
    state.items.forEach((item, index) => {
      const manual = item.metadata?.manual;
      if (!manual || !Object.prototype.hasOwnProperty.call(manual, key)) return;
      const value = String(manual[key] || '').trim(); if (!value) return;
      const id = value.toLocaleLowerCase(), existing = values.get(id) || { value, count: 0, last: 0 };
      existing.count++; existing.last = Math.max(existing.last, Date.parse(manual.reviewedAt || '') || index); values.set(id, existing);
    });
    return [...values.values()].sort((a, b) => b.count - a.count || b.last - a.last).map(entry => entry.value).slice(0, 20);
  };
  const suggestions = (key, buttons = false) => {
    const values = previousDetails(key);
    return `<datalist id="tag-${key}-options">${values.map(value => `<option value="${esc(value)}"></option>`).join('')}</datalist>${buttons && values.length ? `<div class="tag-suggestions"><span>Previously used</span>${values.slice(0, 3).map(value => `<button type="button" data-tag-suggestion="${key}" data-value="${esc(value)}">${esc(value)}</button>`).join('')}</div>` : ''}`;
  };
  const hasDisplayedDetails = item => Object.values(effectiveDetails(item)).some(value => String(value || '').trim());
  const tagItems = () => tagFilter === 'all' ? state.items : state.items.filter(item => !item.metadata?.manual?.reviewedAt && (tagFilter !== 'no-details' || !hasDisplayedDetails(item)));
  function closeTagger() { const video = $('#tagger video'); if (video) video.pause(); $('#tagger').hidden = true; }
  function renderTagger(focus = false) {
    const items = tagItems(), panel = $('#tagger');
    if (!items.length) {
      panel.innerHTML = `<div class="tagger-complete"><p class="eyebrow">DETAILS COMPLETE</p><h2>Nothing else in this view.</h2><p>You can continue through every unreviewed item or revisit the complete library.</p><div><button id="tag-unreviewed">Continue unreviewed</button><button id="tag-all">Review all items</button><button id="tag-close" class="primary">Done</button></div></div>`;
      panel.hidden = false; $('#tag-unreviewed').onclick = () => { tagFilter = 'unreviewed'; tagIndex = 0; renderTagger(); }; $('#tag-all').onclick = () => { tagFilter = 'all'; tagIndex = 0; renderTagger(); }; $('#tag-close').onclick = closeTagger; return;
    }
    tagIndex = Math.max(0, Math.min(tagIndex, items.length - 1));
    const item = items[tagIndex], details = effectiveDetails(item), automatic = automaticDetails(item), reviewed = state.items.filter(entry => entry.metadata?.manual?.reviewedAt).length;
    panel.innerHTML = `<div class="tagger-head"><div><p class="eyebrow">CAPTION + DATE REVIEW</p><strong>${tagIndex + 1} / ${items.length}</strong><span>${reviewed} of ${state.items.length} reviewed</span></div><div class="tagger-head-actions"><select id="tag-filter" aria-label="Items to review"><option value="no-details">No date, place or caption</option><option value="unreviewed">All unreviewed</option><option value="all">All items</option></select><button id="tag-close" class="ghost">Done</button></div></div><div class="tagger-body"><div class="tagger-media">${item.kind === 'image' ? `<img src="${item.url}" alt="${esc(item.name)}">` : `<video src="${item.url}" controls autoplay muted playsinline></video>`}<span>${esc(item.name)} · ${item.kind === 'image' ? 'PHOTO' : 'FILM'}</span></div><form id="tag-form" class="tagger-form"><div><label for="tag-caption">Caption <small>optional</small></label><input id="tag-caption" list="tag-caption-options" maxlength="180" value="${esc(details.caption)}" placeholder="A short caption">${suggestions('caption')}</div><div><label for="tag-date">Date</label><input id="tag-date" list="tag-date-options" value="${esc(details.date)}" placeholder="1998, 2004-06, or 2014-08-17" inputmode="numeric"><small>${automatic.date ? `Detected ${esc(automatic.date)}` : 'No trustworthy date detected'}</small>${suggestions('date', true)}</div><div><label for="tag-place">Place</label><input id="tag-place" list="tag-place-options" maxlength="120" value="${esc(details.place)}" placeholder="Glasgow, Scotland"><small>${automatic.place ? `Detected ${esc(automatic.place)}` : 'No place detected'}</small>${suggestions('place', true)}</div><p class="tagger-hint"><kbd>⌘</kbd><kbd>↵</kbd> saves and moves on</p><div class="tagger-actions"><button type="button" id="tag-previous" ${tagIndex === 0 ? 'disabled' : ''}>← Previous</button><button type="button" id="tag-reset" class="ghost">Use detected details</button><button type="button" id="tag-delete" class="danger">Delete</button><button type="submit" class="primary">Save + next →</button></div></form></div>`;
    panel.hidden = false; $('#tag-filter').value = tagFilter;
    $('#tag-filter').onchange = () => { tagFilter = $('#tag-filter').value; tagIndex = 0; renderTagger(); };
    $('#tag-close').onclick = closeTagger;
    $('#tag-previous').onclick = () => { tagIndex--; renderTagger(); };
    panel.querySelectorAll('[data-tag-suggestion]').forEach(button => button.onclick = () => { const input = $(`#tag-${button.dataset.tagSuggestion}`); input.value = button.dataset.value; input.focus(); });
    $('#tag-reset').onclick = action(async () => { state = await api.mediaDetails(item.id, null); drawList(); preview(current); renderTagger(); });
    $('#tag-delete').onclick = action(async () => {
      if (!confirm(`Delete “${item.name}” from Loop?\n\nThe library copy will move to the Trash. Your original file will not be touched.`)) return;
      state = await api.removeMedia(item.id); drawList(); preview(Math.min(current, state.items.length - 1)); renderTagger();
    });
    $('#tag-form').onsubmit = action(async event => {
      event.preventDefault(); if (tagSaving) return; tagSaving = true;
      try {
        const value = { caption: $('#tag-caption').value, date: $('#tag-date').value, place: $('#tag-place').value };
        state = await api.mediaDetails(item.id, value); drawList(); preview(current);
        if (tagFilter === 'all') tagIndex = Math.min(tagIndex + 1, state.items.length - 1);
        renderTagger(true);
      } finally { tagSaving = false; }
    });
    if (focus) $('#tag-caption').focus();
  }
  $('#tag-media').onclick = () => {
    if (active) { toast('Close the projection before reviewing details.'); return; }
    const blank = state.items.some(item => !item.metadata?.manual?.reviewedAt && !hasDisplayedDetails(item));
    tagFilter = blank ? 'no-details' : state.items.some(item => !item.metadata?.manual?.reviewedAt) ? 'unreviewed' : 'all'; tagIndex = 0; renderTagger(true);
  };
  window.addEventListener('keydown', event => {
    if ($('#tagger').hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); closeTagger(); return; }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); $('#tag-form')?.requestSubmit(); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    if (event.key === 'ArrowLeft' && tagIndex > 0) { event.preventDefault(); tagIndex--; renderTagger(); }
    if (event.key === 'ArrowRight') { event.preventDefault(); $('#tag-form')?.requestSubmit(); }
  });
  ['seconds', 'fit', 'sound', 'metadata', 'gps', 'metadata-corner', 'playback-layout'].forEach(id => $('#' + id).onchange = action(async () => { updateLayoutHelp(); await persist(); $('#seconds').value = state.settings.seconds; }));
  const searchFields = item => {
    const detail = effectiveDetails(item), metadata = item.metadata || {}, type = item.kind === 'image' ? 'image photo still' : 'video film clip';
    const date = detail.date || '', dateParts = /^\d{4}-(\d{2})/.exec(date), month = dateParts ? ['january','february','march','april','may','june','july','august','september','october','november','december'][Number(dateParts[1]) - 1] || '' : '';
    return {
      name: item.name || '', caption: detail.caption, place: detail.place, date: `${date} ${month}`,
      type, camera: metadata.camera || '', source: metadata.source || '',
      all: [item.name, detail.caption, detail.place, date, month, type, metadata.camera, metadata.source].filter(Boolean).join(' ')
    };
  };
  function matchesSearch(item) {
    const query = searchQuery.trim().toLocaleLowerCase(); if (!query) return true;
    const fields = searchFields(item), terms = query.match(/[a-z]+:"[^"]*"|"[^"]*"|\S+/g) || [];
    return terms.every(term => {
      const colon = term.indexOf(':'), key = colon > 0 ? term.slice(0, colon) : '', raw = colon > 0 ? term.slice(colon + 1) : term;
      const value = raw.replace(/^"|"$/g, '').trim();
      if ((key === 'has' || key === 'missing') && ['caption', 'place', 'date'].includes(value)) return key === 'has' ? !!fields[value] : !fields[value];
      if (['name', 'caption', 'place', 'date', 'type', 'camera', 'source'].includes(key)) return String(fields[key]).toLocaleLowerCase().includes(value);
      return fields.all.toLocaleLowerCase().includes((key ? `${key}:${value}` : value));
    });
  }
  const detailSummary = item => { const detail = effectiveDetails(item); return [detail.caption, detail.place, detail.date].filter(Boolean).join(' · '); };
  function drawList() {
    $('#count').textContent = ` / ${String(state.items.length).padStart(2, '0')}`;
    $('#start').disabled = (!state.items.length && !feedCount) || checking;
    const unreviewed = state.items.filter(item => !item.metadata?.manual?.reviewedAt).length;
    $('#tag-media').disabled = !state.items.length || active;
    $('#find-duplicates').disabled = !state.items.length || active || duplicateScanning;
    $('#find-duplicates').textContent = duplicateScanning ? 'Finding duplicates…' : 'Find duplicates';
    $('#tag-media').textContent = unreviewed ? `Review captions & dates · ${unreviewed} left` : 'Review captions & dates';
    updateEstimate();
    const visible = state.items.map((item, idx) => ({ item, idx })).filter(({ item }) => matchesSearch(item));
    $('#search-count').textContent = searchQuery.trim() ? `${visible.length} match${visible.length === 1 ? '' : 'es'}` : `${state.items.length.toLocaleString()} items`;
    $('#playlist').innerHTML = visible.length ? visible.map(({ item, idx }) => `<li data-id="${item.id}"><span class="index">${String(idx + 1).padStart(2, '0')}</span><button class="name-block" data-preview title="Preview ${esc(item.name)}"><span class="name">${esc(item.name)}</span>${detailSummary(item) ? `<small>${esc(detailSummary(item))}</small>` : ''}</button><span class="type">${problems.has(item.id) ? 'CHECK FILE' : item.kind === 'image' ? 'PHOTO' : 'FILM'}</span><div class="actions"><button data-move="-1" ${idx === 0 ? 'disabled' : ''} aria-label="Move ${esc(item.name)} up">↑</button><button data-move="1" ${idx === state.items.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(item.name)} down">↓</button><button data-remove aria-label="Delete ${esc(item.name)} from Loop">×</button></div></li>`).join('') : `<li class="list-empty">${state.items.length ? 'No matching items.' : 'No items.'}</li>`;
    $('#playlist').querySelectorAll('button').forEach(button => button.onclick = action(async () => {
      if (active) { toast('Close the output before changing the sequence.'); return; }
      const index = state.items.findIndex(i => i.id === button.closest('li').dataset.id), items = [...state.items];
      if (button.hasAttribute('data-preview')) { preview(index); return; }
      if (button.hasAttribute('data-remove')) {
        if (!confirm(`Delete “${state.items[index].name}” from Loop?\n\nThe library copy will move to the Trash. Your original file will not be touched.`)) return;
        state = await api.removeMedia(state.items[index].id); drawList(); preview(Math.min(current, state.items.length - 1)); return;
      }
      const next = index + Number(button.dataset.move); [items[index], items[next]] = [items[next], items[index]];
      await persist(items); preview(0);
    }));
  }
  $('#sequence-search').oninput = () => { searchQuery = $('#sequence-search').value; drawList(); };
  $('#find-duplicates').onclick = action(findDuplicates);
  api.on('duplicate-progress', info => { if (duplicateScanning && info.total) $('#duplicate-status').textContent = `Checking file contents · ${info.done.toLocaleString()} / ${info.total.toLocaleString()}`; });
  function preview(index) {
    current = index; const item = state.items[index]; if (!item) { $('#preview').innerHTML = '<div class="empty"><h2>No media added</h2><p>Add photos and videos to begin.</p></div>'; return; }
    $('#preview').innerHTML = `${item.kind === 'image' ? `<img src="${item.url}" alt="${esc(item.name)}">` : `<video src="${item.url}" muted preload="metadata"></video>`}<span class="monitor-tag">${state.settings.layout === 'grid' ? 'GRID' : active ? 'ON THE SCREEN' : 'SEQUENCE PREVIEW'} · ${index + 1} / ${state.items.length}</span>`;
    const caption = document.createElement('div'); caption.className = 'metadata-readout'; $('#preview').append(caption); window.readout.render(caption, item, { ...state.settings, camera: false });
    $('#preview').querySelector('img,video').style.objectFit = state.settings.fit;
    $('#now').textContent = item.name;
  }
  async function importFiles() { if (active) { toast('Close the output before adding files.'); return; } $('#import').disabled = true; try { const result = await api.importMedia(); if (result) { state = result.state; drawList(); probeDurations(); preview(0); if (result.errors.length) toast(result.errors.join('\n'), true); else toast('Copied into your local library.'); } } finally { $('#import').disabled = false; } }
  $('#import').onclick = action(importFiles); $('#empty-import').onclick = action(importFiles);
  async function checkPlayback() {
    if (checking || !state.items.length) return;
    checking = true; $('#check').disabled = true; drawList(); problems.clear();
    try {
      for (let idx = 0; idx < state.items.length; idx++) {
        const item = state.items[idx]; $('#check-result').textContent = `Checking ${idx + 1} of ${state.items.length}: ${item.name}`;
        await new Promise(resolve => {
          const element = document.createElement(item.kind === 'image' ? 'img' : 'video');
          const finish = error => { clearTimeout(timer); element.onload = element.onloadeddata = element.onerror = null; if (element.tagName === 'VIDEO') { element.pause(); element.removeAttribute('src'); element.load(); } if (error) problems.set(item.id, error); resolve(); };
          const timer = setTimeout(() => finish('Could not decode within 12 seconds'), 12000);
          element.onload = element.onloadeddata = () => finish(); element.onerror = () => finish('Cannot play this format'); element.preload = 'auto'; element.muted = true; element.src = item.url;
        });
      }
      $('#check-result').textContent = problems.size ? `Needs conversion or removal: ${state.items.filter(i => problems.has(i.id)).map(i => i.name).join(', ')}. Use JPEG/PNG or H.264 MP4. Unplayable files will be skipped.` : `All ${state.items.length} files decoded successfully. Rehearse the complete sequence on the projector before the party.`;
    } finally { checking = false; $('#check').disabled = false; drawList(); }
  }
  $('#check').onclick = action(checkPlayback);
  function updateLiveFeed(info = {}) {
    feedCount = Number(info.count) || 0;
    $('#live-feed-status').textContent = `Photo booth feed · ${info.message || `${feedCount} cached`}`;
    $('#start').disabled = (!state.items.length && !feedCount) || checking;
    updateEstimate();
  }
  if (boot.liveFeed) updateLiveFeed(boot.liveFeed);
  api.on('live-feed-status', updateLiveFeed);
  api.on('place-progress', info => { $('#place-progress').textContent = `Looking up places: ${info.done} / ${info.total} locations · ${info.resolved} saved`; });
  $('#lookup-places').onclick = action(async () => {
    $('#lookup-places').disabled = true; $('#cancel-places').hidden = false;
    try {
      const result = await api.lookupPlaces(); state = result.state; drawList(); preview(current);
      $('#place-progress').textContent = result.total === 0 ? 'No unresolved GPS locations. Existing place names are ready offline.' : `${result.cancelled ? 'Stopped. ' : ''}${result.resolved} locations saved. ${result.failed} could not be resolved.${result.stoppedEarly ? ' Lookup paused after repeated failures; try again while online.' : ''} Saved names are ready offline.`;
    } finally { $('#lookup-places').disabled = false; $('#cancel-places').hidden = true; }
  });
  $('#cancel-places').onclick = action(async () => { await api.cancelPlaces(); $('#place-progress').textContent = 'Stopping after the current lookup…'; });
  $('#start').onclick = action(async () => {
    await persist();
    const metrics = Object.fromEntries(state.items.map(item => [item.id, { ...(dimensions.get(item.id) || {}), ...(Number.isFinite(durations.get(item.id)) ? { duration: durations.get(item.id) } : {}) }]));
    await api.output(Number($('#display').value), metrics); active = true; paused = false; blackout = false;
    ['previous', 'next', 'pause', 'blackout', 'stop'].forEach(id => $('#' + id).disabled = false);
    $('#pause').textContent = 'Pause'; $('#blackout').textContent = 'Blackout'; $('#start').textContent = 'Restart projection ↗'; showOptimization(); preview(0);
  });
  $('#optimise-videos').onclick = action(async () => {
    optimizing = true; let finalMessage; showOptimization('Preparing large videos…');
    try {
      const result = await api.optimiseVideos(); state = result.state; optimization = result.summary;
      finalMessage = result.errors.length ? `${result.completed} checked · ${result.errors.length} could not be reduced.` : `Finished · saved ${formatBytes(result.savedBytes)}.`;
      drawList(); preview(current);
    } finally { optimizing = false; showOptimization(finalMessage); }
  });
  api.on('optimise-progress', info => { if (info.running) showOptimization(`Optimising ${Math.min(info.completed + 1, info.total)} of ${info.total} · ${info.name}`); });
  $('#stop').onclick = action(() => api.transport('close'));
  $('#previous').onclick = action(() => api.transport('previous')); $('#next').onclick = action(() => api.transport('next'));
  $('#pause').onclick = action(async () => { await api.transport('pause'); });
  $('#blackout').onclick = action(async () => { await api.transport('blackout'); });
  $('#reveal').onclick = action(() => api.reveal('library'));
  api.on('output-status', info => { const localIndex = info.itemId ? state.items.findIndex(item => item.id === info.itemId) : info.index; if (localIndex >= 0 && localIndex !== current) preview(localIndex); else if (info.itemId?.startsWith('booth-')) $('#now').textContent = 'Photo booth'; paused = info.paused; blackout = info.blackout; $('#pause').textContent = paused ? 'Resume' : 'Pause'; $('#blackout').textContent = blackout ? 'Restore picture' : 'Blackout'; if (info.error) toast(info.error, true); });
  api.on('output-closed', () => { active = false; ['previous', 'next', 'pause', 'blackout', 'stop'].forEach(id => $('#' + id).disabled = true); $('#start').textContent = 'Start projection ↗'; showOptimization(); preview(current); });
  drawList(); probeDurations(); if (state.items.length) preview(0);
}
async function renderBooth() {
  document.title = 'Photobooth';
  document.body.classList.add('frame');
  const COUNTDOWN_SECONDS = 2, REVIEW_MS = 3500, HOST_CAMERA_REST_MS = 30000, GUEST_CAMERA_REST_MS = 120000;
  let prefs = await api.preferences(), stream, stillCamera = { connected: false }, stillPreviewTimer, stillPreviewURL, stillPreviewRunning = false, lastStillFrameAt = 0, meteredLuma = 0.35, phase = 'off', token = 0, pending = null, reviewTimer, guest = false, reviewURL;
  let cameraWanted = false, recovering = false, previewStartedAt = 0, recoveryAttempt = 0, nextRecoveryAt = 0, lastActivityAt = Date.now(), lensCueTimer;
  const sharingEnabled = !!boot.delivery?.configured;
  const receiptsEnabled = sharingEnabled && !!boot.delivery?.printReceipts;
  $('#app').innerHTML = `<main class="shell">${brand('Photobooth', 'PHOTO BOOTH')}<div class="topline"><div><p class="eyebrow">PHOTO BOOTH</p><h1>Photobooth</h1></div><button id="guest" class="primary" disabled>Enter guest mode ↗</button></div><div class="booth-layout"><section><div class="booth-screen" id="viewfinder"><video id="live" autoplay playsinline muted hidden></video><img id="review-photo" alt="Saved photo" hidden><div id="camera-empty" class="empty"><div class="aperture">[ &nbsp; ]</div><h2>Camera disconnected</h2><p>Connect the Canon RP to begin.</p><button id="connect" class="lime">Connect camera</button></div><div id="camera-rest" class="empty camera-rest" hidden><div class="aperture">[ &nbsp; ]</div><h2>Camera resting</h2><p>Tap or move the pointer to wake it.</p></div><div class="corner" id="live-label" hidden><i class="dot"></i><span id="live-text">LIVE / AS SAVED</span></div><div id="lens-cue" class="lens-cue" aria-hidden="true" hidden><div class="lens-arrows"><span>↑</span><span>↑</span><span>↑</span></div><strong>LOOK AT THE LENS</strong></div><div id="countdown" class="countdown" aria-live="assertive" hidden></div></div><div class="booth-controls"><p id="booth-message" class="booth-message" role="status">Camera disconnected</p><button id="capture" class="primary capture" disabled>Take photo</button><div id="save-actions" class="save-actions" hidden><button id="retry" class="primary">Retry save</button></div></div><p id="capture-detail" class="help">Preview and saved files use the same orientation.</p></section><aside><section class="panel"><p class="eyebrow">01 / CANON RP</p><select id="camera" hidden><option value="">Default camera</option></select><button id="apply-camera" class="wide" style="margin-top:12px">Connect Canon RP</button><p class="help" id="resolution">The RP supplies the preview and full-resolution photos.</p><button id="disconnect" class="ghost small" disabled>Turn camera off</button></section><section class="panel"><p class="eyebrow">02 / COLOUR</p><label for="look">Photo treatment</label><select id="look"><option value="original">Camera colour</option><option value="warm-film">Warm film</option><option value="soft-neutral">Soft neutral</option><option value="mono">Black & white</option></select><p class="help">Two original film-style LUTs are included. The treatment appears in the preview and saved photo; an untouched local original is also kept.</p></section><section class="panel"><p class="eyebrow">03 / SESSION</p><p class="help">2-second countdown. Photos save automatically.</p><div class="notice" id="storage">Saved on this Mac.<br>${boot.freeGB} GB available.</div><div class="notice delivery" id="delivery-status" role="status"${sharingEnabled ? '' : ' hidden'}></div><details class="sync-activity"><summary>${sharingEnabled ? 'Sync activity' : 'Recent photos'} <span id="sync-summary"></span></summary><div id="sync-list" class="sync-list"></div></details><button class="wide" id="reprints"${receiptsEnabled ? '' : ' hidden'}>Reprint a receipt</button><button class="ghost wide" id="reveal">Open captures folder ↗</button></section></aside></div></main><button id="guest-exit" class="guest-exit">Exit guest mode</button><dialog id="reprint-dialog" class="reprint-dialog"><div class="reprint-head"><div><p class="eyebrow">RECEIPT ARCHIVE</p><h2>Choose a photograph</h2></div><button id="close-reprints" class="ghost" aria-label="Close">Close</button></div><div class="reprint-tools"><input id="reprint-search" type="search" placeholder="Search by date or time…" autocomplete="off"><span id="reprint-printer" class="help">Checking printer…</span></div><p id="reprint-message" class="notice" role="status">Choose one photograph to print another receipt.</p><div id="reprint-grid" class="reprint-grid"></div></dialog>`;
  const savedLook = prefs.look === 'portra' ? 'warm-film' : prefs.look;
  $('#look').value = savedLook in filters ? savedLook : 'warm-film';
  const photoLuts = new Map();
  try { for (const definition of await api.photoLuts()) photoLuts.set(definition.id, { ...definition, parsed: window.partyLut.parse(definition.data) }); }
  catch (e) { console.warn('Built-in LUTs unavailable; using lightweight preview colour.', e); }
  const live = $('#live'), counter = $('#countdown');
  live.insertAdjacentHTML('afterend', '<img id="rp-live" alt="Canon RP live preview" hidden>');
  const rpLive = $('#rp-live');
  const rpCanvas = document.createElement('canvas');
  const gradedPreview = document.createElement('canvas'); gradedPreview.id = 'rp-graded'; gradedPreview.hidden = true; gradedPreview.setAttribute('aria-label', 'Treated live preview'); rpLive.after(gradedPreview);
  let liveGrade = null;
  function rebuildLiveGrade() {
    liveGrade?.dispose(); liveGrade = null;
    const definition = photoLuts.get($('#look').value);
    try { if (definition) liveGrade = window.partyLut.createRenderer(definition.parsed, gradedPreview); } catch (e) { console.warn('Using lightweight preview colour.', e); }
  }
  function renderLiveGrade() {
    const definition = photoLuts.get($('#look').value), useGrade = liveGrade && definition;
    if (useGrade && rpCanvas.width && rpCanvas.height) {
      try { liveGrade.draw(rpCanvas, definition.grain); } catch (e) { liveGrade.dispose(); liveGrade = null; }
    }
    const active = !!(useGrade && liveGrade);
    gradedPreview.hidden = !active || rpLive.hidden;
    rpLive.style.opacity = active ? '0' : '';
  }
  rebuildLiveGrade();
  new MutationObserver(() => { gradedPreview.hidden = !liveGrade || !photoLuts.has($('#look').value) || rpLive.hidden; }).observe(rpLive, { attributes: true, attributeFilter: ['hidden'] });
  window.addEventListener('beforeunload', () => liveGrade?.dispose());
  $('#resolution').insertAdjacentHTML('afterend', `<div class="notice" style="margin-top:12px"><strong>Canon still camera</strong><br><span id="still-status">Checking for the RP…</span><br><button id="check-still" class="ghost small" style="margin-top:6px">Check connection</button></div>`);
  $('#resolution').insertAdjacentHTML('afterend', '<p id="battery-health" class="help" role="status">Battery level unavailable</p><details class="camera-diagnostics"><summary>Camera diagnostics</summary><p class="help">If recovery fails, check camera power and the USB data cable. Close EOS Utility, Photos or Image Capture if another app owns the camera.</p><pre id="camera-log"></pre></details>');
  $('#battery-health').insertAdjacentHTML('afterend', `<div class="notice consumables"><strong>Supplies</strong><br><span id="supply-camera">Camera battery unavailable</span>${receiptsEnabled ? '<br><span id="supply-paper">Checking receipt paper…</span>' : ''}<label for="alert-recipient" style="margin-top:10px">iMessage alert destination</label><input id="alert-recipient" type="text" autocomplete="off" spellcheck="false" placeholder="group:Family, +44… or Apple ID email" value="${esc(prefs.alertRecipient || '')}"><p class="help">For a named Messages conversation, enter group: followed by its exact title.</p><button id="test-alert" class="ghost small" style="margin-top:7px">Send test alert</button><small id="alert-status" class="help"></small></div>`);
  const diagnosticLines = [];
  let latestBattery = null, latestPaper = 'unknown', latestFlashProblem = false, checkingPrinter = false;
  async function hostAlert(kind, active) {
    const recipient = $('#alert-recipient').value.trim();
    if (!recipient && active) return { configured: false };
    const result = await api.hostAlert({ kind, active, recipient });
    if (result.error) $('#alert-status').textContent = `iMessage unavailable: ${result.error}`;
    return result;
  }
  function cameraLog(message) { diagnosticLines.push(`${new Date().toLocaleTimeString()} ${message}`); if (diagnosticLines.length > 30) diagnosticLines.shift(); $('#camera-log').textContent = diagnosticLines.join('\n'); }
  api.on('still-health', health => {
    const known = typeof health.battery === 'number';
    const time = new Date(health.checkedAt).toLocaleTimeString();
    latestBattery = known ? health.battery : null;
    $('#battery-health').textContent = known ? `Battery ${health.battery}% · checked ${time}${health.battery <= 20 ? ' — charge or replace soon' : ''}` : 'Battery level unavailable';
    $('#supply-camera').textContent = known ? `Canon battery · ${health.battery}%${health.battery <= 20 ? ' · LOW' : ''}` : 'Canon battery · unavailable';
    $('#battery-health').classList.toggle('battery-low', known && health.battery <= 20);
    hostAlert('camera-low', known && health.battery <= 20).catch(error => cameraLog(`Battery alert: ${error.message}`));
    cameraLog(known ? `Battery reported ${health.battery}%` : 'Camera did not report a battery level');
  });
  function setMessage(text) { $('#booth-message').textContent = text; }
  function hideLensCue() { clearTimeout(lensCueTimer); $('#lens-cue').hidden = true; }
  function showLensCue() { hideLensCue(); $('#lens-cue').hidden = false; lensCueTimer = setTimeout(hideLensCue, 1150); }
  function syncLabel(job) {
    if (job.status === 'deleting') {
      const seconds = Math.max(0, Math.ceil((job.nextAttemptAt - Date.now()) / 1000));
      return job.lastError ? (seconds > 0 ? `Delete retry in ${seconds < 60 ? `${seconds}s` : `${Math.ceil(seconds / 60)}m`}` : 'Delete ready to retry') : 'Deleting…';
    }
    if (job.status === 'local-only') return 'Saved on this Mac';
    if (job.status === 'uploaded') return 'Online';
    if (job.status === 'uploading') return 'Uploading…';
    if (job.status === 'waiting-config') return sharingEnabled ? 'Waiting for setup' : 'Saved on this Mac';
    if (job.attempts) {
      const seconds = Math.max(0, Math.ceil((job.nextAttemptAt - Date.now()) / 1000));
      return seconds > 0 ? `Retrying in ${seconds < 60 ? `${seconds}s` : `${Math.ceil(seconds / 60)}m`}` : 'Ready to retry';
    }
    return 'Waiting to upload';
  }
  function updateDelivery(info = {}) {
    $('#delivery-status').hidden = !info.configured;
    $('#delivery-status').innerHTML = `<strong>Cloud sharing</strong><br>${esc(info.message || 'Captures saved on this Mac.')}`;
    $('#delivery-status').classList.toggle('needs-attention', !!info.attention);
    const recent = info.recent || [];
    $('#sync-summary').textContent = !info.configured ? (recent.length ? `· ${recent.length}` : '') : info.deleting ? `· ${info.deleting} deleting` : info.pending ? `· ${info.pending} waiting` : info.attention ? `· ${info.attention} needs attention` : recent.length ? '· up to date' : '';
    $('#sync-list').innerHTML = recent.length ? recent.map(job => {
      const time = new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const problem = job.lastError || job.printError;
      const canRetry = !!problem || job.status === 'pending' && job.attempts > 0 || job.printStatus === 'attention';
      const receipt = info.printReceipts && job.kind === 'photo' && job.printStatus !== 'disabled' ? `<span>${job.printStatus === 'printed' ? 'Receipt printed' : job.printStatus === 'printing' ? 'Printing…' : job.printStatus === 'attention' ? 'Receipt needs attention' : 'Receipt waiting'}</span>` : '';
      return `<article class="sync-row${problem ? ' problem' : ''}"><div><strong>${job.kind === 'video' ? 'Film' : 'Photo'} · ${esc(time)}</strong><span>${esc(syncLabel(job))}</span>${receipt}${problem ? `<small>${esc(problem)}</small>` : ''}</div><div class="sync-actions">${job.status === 'uploaded' && job.shareUrl ? `<button class="ghost sync-open" data-url="${esc(job.shareUrl)}">Open</button>` : ''}${canRetry ? `<button class="sync-retry" data-id="${esc(job.id)}">Retry</button>` : ''}${job.status !== 'deleting' ? `<button class="ghost sync-delete" data-id="${esc(job.id)}">Delete</button>` : ''}</div></article>`;
    }).join('') : '<p class="help">New captures will appear here.</p>';
    document.querySelectorAll('.sync-open').forEach(button => { button.onclick = action(() => api.openShare(button.dataset.url)); });
    document.querySelectorAll('.sync-retry').forEach(button => { button.onclick = action(async () => updateDelivery(await api.deliveryRetry(button.dataset.id))); });
    document.querySelectorAll('.sync-delete').forEach(button => { button.onclick = action(async () => { if (!confirm(info.configured ? 'Delete this capture from the website and move its local files to Trash?' : 'Move this local capture to Trash?')) return; button.disabled = true; updateDelivery(await api.deliveryDelete(button.dataset.id)); }); });
  }
  updateDelivery(boot.delivery); api.on('delivery-status', updateDelivery);
  const reprintDialog = $('#reprint-dialog');
  let receiptHistory = [], receiptPrinting = false;
  function drawReceiptHistory() {
    const query = $('#reprint-search').value.trim().toLowerCase();
    const visible = receiptHistory.filter(item => !query || item.search.includes(query));
    $('#reprint-grid').innerHTML = visible.length ? visible.map(item => `<figure class="reprint-card"><img src="${esc(item.imageUrl)}" loading="lazy" decoding="async" alt="Photograph from ${esc(item.label)}"><figcaption><time datetime="${esc(item.createdAt)}">${esc(item.label)}</time><button class="reprint-one" data-id="${esc(item.id)}"${receiptPrinting ? ' disabled' : ''}>Print</button></figcaption></figure>`).join('') : '<p class="reprint-empty">No matching photographs.</p>';
    document.querySelectorAll('.reprint-one').forEach(button => {
      button.onclick = action(async () => {
        if (receiptPrinting) return;
        receiptPrinting = true; button.disabled = true; button.textContent = 'Printing…';
        document.querySelectorAll('.reprint-one').forEach(other => { other.disabled = true; });
        $('#reprint-message').textContent = 'Printing one receipt…';
        try {
          const result = await api.reprintReceipt(button.dataset.id);
          $('#reprint-message').textContent = result.message || 'Receipt printed.';
          button.textContent = 'Printed';
        } catch (error) {
          $('#reprint-message').textContent = error.message;
          button.textContent = 'Try again';
        } finally {
          receiptPrinting = false;
          document.querySelectorAll('.reprint-one').forEach(other => { other.disabled = false; });
        }
      });
    });
  }
  async function openReceiptHistory() {
    reprintDialog.showModal(); $('#reprint-grid').innerHTML = '<p class="reprint-empty">Loading photographs…</p>';
    $('#reprint-message').textContent = 'Choose one photograph to print another receipt.';
    const [printer, history] = await Promise.all([api.printerStatus(), api.receiptHistory()]);
    $('#reprint-printer').textContent = printer.message || (printer.ready ? 'Printer ready.' : 'Printer unavailable.');
    receiptHistory = history.map(item => {
      const date = new Date(item.createdAt), label = Number.isFinite(date.getTime()) ? date.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Saved photograph';
      return { ...item, label, search: `${label} ${item.id}`.toLowerCase() };
    });
    drawReceiptHistory();
  }
  $('#reprints').onclick = action(openReceiptHistory);
  $('#close-reprints').onclick = () => reprintDialog.close();
  $('#reprint-search').oninput = drawReceiptHistory;
  function busy() { return ['countdown', 'saving', 'failed'].includes(phase); }
  function lockInputs(locked) { ['camera', 'apply-camera', 'disconnect', 'look', 'guest'].forEach(id => $('#' + id).disabled = locked); }
  function setLook() { const filter = filters[$('#look').value]; live.style.filter = filter; rpLive.style.filter = filter; rebuildLiveGrade(); renderLiveGrade(); }
  async function savePrefs() { prefs = { camera: $('#camera').value, look: $('#look').value, alertRecipient: $('#alert-recipient').value.trim() }; await api.preferences(prefs); }
  async function refreshPrinterStatus() {
    if (!receiptsEnabled) return;
    if (checkingPrinter) return;
    checkingPrinter = true;
    try {
      const info = await api.printerStatus(); latestPaper = info.paper || 'unknown';
      $('#supply-paper').textContent = info.present ? `Receipt paper · ${latestPaper === 'adequate' ? 'ready' : latestPaper === 'near-end' ? 'LOW' : latestPaper === 'out' ? 'OUT' : 'level unavailable'}` : 'Receipt printer · disconnected';
      await hostAlert('paper-low', latestPaper === 'near-end');
      await hostAlert('paper-out', latestPaper === 'out');
    } catch (error) { $('#supply-paper').textContent = 'Receipt printer · status unavailable'; cameraLog(`Printer status: ${error.message}`); }
    finally { checkingPrinter = false; }
  }
  $('#alert-recipient').onchange = action(async () => { await savePrefs(); $('#alert-status').textContent = $('#alert-recipient').value.trim() ? 'Alerts configured. Send a test before the party.' : 'Alerts off.'; await hostAlert('camera-low', latestBattery !== null && latestBattery <= 20); await hostAlert('paper-low', latestPaper === 'near-end'); await hostAlert('paper-out', latestPaper === 'out'); await hostAlert('flash-problem', latestFlashProblem); });
  $('#test-alert').onclick = action(async () => { const recipient = $('#alert-recipient').value.trim(); if (!recipient) { $('#alert-status').textContent = 'Enter a phone number or Apple ID email first.'; return; } await savePrefs(); $('#test-alert').disabled = true; $('#alert-status').textContent = 'Sending test…'; try { await api.hostAlert({ kind: 'test', active: false, recipient }); const result = await api.hostAlert({ kind: 'test', active: true, recipient }); $('#alert-status').textContent = result.sent ? 'Test sent.' : result.error ? `Could not send: ${result.error}` : 'Test already sent.'; } finally { $('#test-alert').disabled = false; } });
  const printerStatusTimer = receiptsEnabled ? setInterval(refreshPrinterStatus, 60000) : null;
  if (receiptsEnabled) refreshPrinterStatus();
  async function listDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    for (const [id, kind, label] of [['camera', 'videoinput', 'camera']]) {
      const selected = $('#' + id).value || prefs[id] || '';
      $('#' + id).innerHTML = `<option value="">Default ${label}</option>` + devices.filter(d => d.kind === kind).map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || `${label} ${i + 1}`)}</option>`).join('');
      if ([...$('#' + id).options].some(o => o.value === selected)) $('#' + id).value = selected;
    }
  }
  async function refreshStill() { $('#check-still').disabled = true; $('#still-status').textContent = 'Checking for the RP…'; try { stillCamera = await api.stillCameraStatus(); $('#still-status').textContent = stillCamera.message; cameraLog(stillCamera.connected ? `${stillCamera.model} detected` : `${stillCamera.reason || 'not-detected'}: ${stillCamera.message}`); } catch (e) { stillCamera = { connected: false }; $('#still-status').textContent = e.message; cameraLog(e.message); } finally { $('#check-still').disabled = false; } if (stream || stillPreviewRunning) $('#live-text').textContent = stillCamera.connected ? 'LIVE PREVIEW / RP STILL SAVED' : 'LIVE / VIDEO FRAME SAVED'; }
  $('#check-still').textContent = 'Retry connection'; $('#check-still').onclick = action(connect);
  navigator.mediaDevices.addEventListener('devicechange', () => { if (!busy()) listDevices().catch(e => cameraLog(e.message)); });
  await listDevices();
  await refreshStill();
  function meterFrame(canvas) {
    const ctx = canvas.getContext('2d'), x0 = Math.floor(canvas.width * .22), y0 = Math.floor(canvas.height * .16), w = Math.floor(canvas.width * .56), h = Math.floor(canvas.height * .68);
    const data = ctx.getImageData(x0, y0, w, h).data; let light = 0, samples = 0;
    for (let y = 0; y < h; y += 18) for (let x = 0; x < w; x += 18) { const i = (y * w + x) * 4; light += (data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722) / 255; samples++; }
    if (samples) meteredLuma = meteredLuma * .8 + (light / samples) * .2;
  }
  // E-TTL meters the flash from its preflash. A fixed ISO keeps the look consistent.
  function stillExposure() { return { iso: 400 }; }
  function showStillFrame(data) { if (!stillPreviewRunning || phase === 'off') return; const next = URL.createObjectURL(new Blob([data], { type: 'image/jpeg' })); rpLive.onload = () => { lastStillFrameAt = Date.now(); if (phase === 'ready' && !recovering) $('#capture').disabled = false; if (rpLive.naturalWidth) { rpCanvas.width = rpLive.naturalWidth; rpCanvas.height = rpLive.naturalHeight; const ctx = rpCanvas.getContext('2d'); ctx.drawImage(rpLive, 0, 0); meterFrame(rpCanvas); renderLiveGrade(); } if (stillPreviewURL) URL.revokeObjectURL(stillPreviewURL); stillPreviewURL = next; }; rpLive.src = next; rpLive.hidden = !['ready', 'countdown'].includes(phase); live.hidden = true; }
  api.on('still-preview-frame', showStillFrame);
  api.on('still-preview-error', message => { cameraLog(message); if (stillPreviewRunning) { lastStillFrameAt = 0; previewStartedAt = 0; $('#capture').disabled = true; $('#still-status').textContent = message; } });
  async function stopStillPreview() { stillPreviewRunning = false; clearTimeout(stillPreviewTimer); await api.stopStillPreview(); rpLive.hidden = true; if (stillPreviewURL) { URL.revokeObjectURL(stillPreviewURL); stillPreviewURL = null; } }
  async function startStillPreview() {
    await stopStillPreview(); if (!stillCamera.connected) return; stillPreviewRunning = true; lastStillFrameAt = 0; previewStartedAt = Date.now(); try { await api.startStillPreview(); } catch (e) { stillPreviewRunning = false; $('#still-status').textContent = e.message; throw e; }
  }
  function markActivity() { lastActivityAt = Date.now(); }
  async function restCamera() {
    if (boot.test || !cameraWanted || !stillCamera.connected || !stillPreviewRunning || phase !== 'ready') return;
    phase = 'resting'; $('#capture').disabled = false; $('#capture').textContent = 'Wake camera';
    $('#live-label').hidden = true; $('#camera-rest').hidden = false; rpLive.hidden = true; gradedPreview.hidden = true;
    setMessage('Tap to wake the camera');
    await api.restStillCamera(); stillPreviewRunning = false; lastStillFrameAt = 0; previewStartedAt = 0;
    cameraLog('Live view resting after 30 seconds idle');
  }
  async function wakeCamera() {
    phase = 'waking'; markActivity(); $('#capture').disabled = true; setMessage('Waking the camera…');
    await startStillPreview();
    const deadline = Date.now() + 10000;
    while (!lastStillFrameAt && Date.now() < deadline) await delay(100);
    if (!lastStillFrameAt) throw new Error('The camera did not wake. Check its power and USB cable.');
    $('#camera-rest').hidden = true; $('#live-label').hidden = false; rpLive.hidden = false; phase = 'ready';
  }
  let lastPointerActivity = 0;
  $('#viewfinder').addEventListener('mousemove', () => {
    const now = Date.now(); if (now - lastPointerActivity < 500) return; lastPointerActivity = now; markActivity();
    if (phase === 'resting') wakeCamera().then(ready).catch(e => { phase = 'resting'; $('#capture').disabled = false; setMessage('Tap below or move here to try again'); cameraLog(e.message); });
  });
  const cameraRestTimer = setInterval(() => {
    const idleLimit = guest ? GUEST_CAMERA_REST_MS : HOST_CAMERA_REST_MS;
    if (Date.now() - lastActivityAt >= idleLimit) restCamera().catch(e => { cameraLog(e.message); phase = 'ready'; });
  }, 1000);
  const recoveryTimer = setInterval(async () => {
    if (Date.now() < nextRecoveryAt || boot.test || !cameraWanted || recovering || !['ready', 'off'].includes(phase)) return;
    if (stillPreviewRunning && Date.now() - Math.max(lastStillFrameAt, previewStartedAt) < 5000) return;
    recovering = true; recoveryAttempt++; nextRecoveryAt = Date.now() + Math.min(15000, recoveryAttempt * 3000); cameraLog(`Recovery attempt ${recoveryAttempt}`); $('#capture').disabled = true; rpLive.hidden = true;
    setMessage('Reconnecting camera…');
    try {
      await api.stopStillPreview();
      await refreshStill();
      if (!cameraWanted) return;
      if (!stillCamera.connected) { setMessage(stillCamera.reason === 'usb-missing' ? 'The Mac cannot see the Canon. Reconnect its USB data cable.' : 'Reconnect the Canon USB cable. We’ll pick it up automatically.'); return; }
      await api.prepareStillCamera();
      if (!cameraWanted) return;
      await startStillPreview();
      if (cameraWanted) { recoveryAttempt = 0; phase = 'ready'; $('#camera-empty').hidden = true; $('#live-label').hidden = false; await ready(); $('#guest').disabled = false; $('#disconnect').disabled = false; $('#toast').hidden = true; }
    } catch (e) { cameraLog(e.message); $('#still-status').textContent = e.message; setMessage('Camera unavailable. Retrying automatically…'); }
    finally { recovering = false; }
  }, 3000);
  window.addEventListener('beforeunload', () => { clearInterval(recoveryTimer); clearInterval(cameraRestTimer); clearInterval(printerStatusTimer); });
  function resetReview() { hideLensCue(); clearTimeout(reviewTimer); $('#review-photo').hidden = true; if (reviewURL) { URL.revokeObjectURL(reviewURL); reviewURL = null; } }
  async function stopCamera() {
    cameraWanted = false;
    if (busy()) return; resetReview(); token++; phase = 'off';
    await stopStillPreview();
    if (stream) { stream.getTracks().forEach(t => { t.onended = null; t.stop(); }); stream = null; }
    live.srcObject = null; live.hidden = true; $('#camera-rest').hidden = true; $('#camera-empty').hidden = false; $('#live-label').hidden = true; $('#capture').disabled = true; $('#guest').disabled = true; $('#disconnect').disabled = true; setMessage('Camera paused.');
    await api.boothActive(false);
  }
  async function connect() {
    if (busy() || phase === 'connecting') return;
    await stopCamera(); cameraWanted = true; recoveryAttempt = 0; nextRecoveryAt = 0; cameraLog('Connecting to Canon RP'); phase = 'connecting'; $('#connect').disabled = true; lockInputs(true); setMessage('Connecting camera…');
    try {
      await refreshStill();
      if (stillCamera.connected && !boot.test) {
        await api.prepareStillCamera();

        await startStillPreview(); await listDevices(); await savePrefs(); $('#toast').hidden = true; $('#camera-empty').hidden = true; $('#camera-rest').hidden = true; $('#live-label').hidden = false; $('#live-text').textContent = 'LIVE PREVIEW / RP STILL SAVED'; $('#resolution').textContent = 'Canon RP live feed · medium JPEG stills.'; phase = 'ready'; markActivity(); $('#capture').disabled = !lastStillFrameAt; $('#guest').disabled = false; $('#disconnect').disabled = false; setLook(); setMessage('Ready'); await api.boothActive(false); return;
      }
      if (!boot.test) throw new Error(stillCamera.message || 'Canon EOS RP not connected. Switch it on and reconnect its USB data cable, then choose Check connection.');
      if (!await api.mediaPermission('camera')) throw new Error('Allow Photobooth to use the camera in System Settings → Privacy & Security → Camera, then restart Photobooth.');
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: 25, max: 30 }, ...($('#camera').value ? { deviceId: { exact: $('#camera').value } } : {}) }, audio: false });
      live.srcObject = stream; await live.play();
      await listDevices(); await savePrefs();
      const s = stream.getVideoTracks()[0].getSettings();
      $('#resolution').textContent = `${s.width} × ${s.height} · ${Math.round(s.frameRate || 0)} fps · ${((s.width * s.height) / 1e6).toFixed(1)} MP frames${s.width < 1920 ? '. Low resolution: check the camera / connection.' : ''}`;
      stream.getTracks().forEach(t => t.onended = () => {
        if (['saving', 'failed'].includes(phase)) { stream.getTracks().forEach(track => { track.onended = null; track.stop(); }); stream = null; }
        else { cancelCapture(); phase = 'ready'; stopCamera(); }
        toast('Camera disconnected. Check the cable, then reconnect. Any pending save can still be retried.', true);
      });
      await refreshStill(); live.hidden = false; $('#live-text').textContent = stillCamera.connected ? 'LIVE PREVIEW / RP STILL SAVED' : 'LIVE / VIDEO FRAME SAVED'; $('#toast').hidden = true; $('#camera-empty').hidden = true; $('#camera-rest').hidden = true; $('#live-label').hidden = false; phase = 'ready'; markActivity(); $('#capture').disabled = false; setLook(); setMessage('Ready');
      await api.boothActive(false);
    } catch(e) {
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      phase = 'off'; cameraLog(e.message); setMessage('Waiting for camera. Connect USB and switch the RP on; I’ll retry automatically.'); toast(e.name === 'NotReadableError' ? 'Camera is busy. Close other camera apps, then reconnect.' : e.message, true);
    } finally { lockInputs(false); $('#connect').disabled = false; $('#guest').disabled = !(stream || stillPreviewRunning); $('#disconnect').disabled = !(stream || stillPreviewRunning); }
  }
  $('#connect').onclick = $('#apply-camera').onclick = action(connect); $('#disconnect').onclick = action(stopCamera);
  $('#look').onchange = action(async () => { setLook(); await savePrefs(); });
  async function setGuest(value) {
    if (busy()) return; guest = value; $('#toast').hidden = true; document.activeElement?.blur(); document.body.classList.toggle('guest', guest); await api.fullscreen();
    $('#viewfinder').setAttribute('aria-label', guest ? 'Tap to capture' : 'Camera preview');
    $('#viewfinder').setAttribute('role', guest ? 'button' : 'img');
    // Keep the guest appliance awake while it waits for the next person.
    await api.boothActive(false, guest);
  }
  $('#guest').onclick = action(() => setGuest(true));
  $('#guest-exit').onclick = action(() => setGuest(false));
  $('#reveal').onclick = action(() => api.reveal('captures'));
  api.on('close-blocked', toast);
  const delay = ms => new Promise(r => setTimeout(r, ms));
  function blobFromCanvas(canvas) { return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not encode the photo.')), 'image/jpeg', 0.98)); }
  function thumbnailFromCanvas(source) {
    const scale = Math.min(1, 720 / source.width, 540 / source.height);
    const thumbnail = document.createElement('canvas');
    thumbnail.width = Math.max(1, Math.round(source.width * scale)); thumbnail.height = Math.max(1, Math.round(source.height * scale));
    thumbnail.getContext('2d').drawImage(source, 0, 0, thumbnail.width, thumbnail.height);
    return new Promise((resolve, reject) => thumbnail.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not make the gallery thumbnail.')), 'image/jpeg', 0.82));
  }
  async function analysePhoto(blob) {
    const image = await createImageBitmap(blob), scale = Math.min(1, 640 / image.width, 480 / image.height);
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); image.close();
    return window.partyExposure.analyseFlashCanvas(canvas);
  }
  async function finishPhoto(original, files, source, model = '') {
    const image = await createImageBitmap(original), canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; canvas.getContext('2d').drawImage(image, 0, 0); image.close();
    const exposureCheck = window.partyExposure.analyseFlashCanvas(canvas);
    let display = original, finished = canvas; const look = $('#look').value;
    if (look !== 'original') { const graded = document.createElement('canvas'); graded.width = canvas.width; graded.height = canvas.height; const g = graded.getContext('2d'); const definition = photoLuts.get(look); g.filter = definition ? 'none' : filters[look]; g.drawImage(canvas, 0, 0); finished = definition ? window.partyLut.apply(graded, definition.parsed, definition.grain) : graded; display = await blobFromCanvas(finished); files.push({ name: 'print.jpg', data: await display.arrayBuffer() }); }
    const thumbnail = await thumbnailFromCanvas(finished);
    files.push({ name: 'thumb.jpg', data: await thumbnail.arrayBuffer() });
    return { capture: { kind: 'photo', files, metadata: { width: canvas.width, height: canvas.height, look, source, model, mirrored: false, exposureCheck } }, display, exposureCheck };
  }
  async function photograph(restartPreview = true) {
    if (stillCamera.connected) {
      phase = 'saving'; counter.hidden = false; counter.classList.add('developing'); counter.textContent = 'Processing'; setMessage('Processing');
      let shot = await api.captureStill();
      const initialFlashFired = shot.flashFired;
      let ambientFallback = false, ambientFallbackIso = null;
      if (!boot.test && initialFlashFired === false) {
        try {
          const missedJpeg = shot.files.find(file => /\.jpe?g$/i.test(file.name));
          const missedExposure = missedJpeg ? await analysePhoto(new Blob([missedJpeg.data], { type: 'image/jpeg' })) : { mean: .08 };
          ambientFallbackIso = window.partyExposure.ambientFallbackISO(missedExposure.mean);
          shot = await api.captureStill({ ambientFallback: true, iso: ambientFallbackIso });
          ambientFallback = true;
          cameraLog(`Flash missed; captured one immediate ambient fallback at 1/60 s, f/2.8, ISO ${ambientFallbackIso} (meter ${missedExposure.mean.toFixed(2)})`);
        } catch (error) {
          cameraLog(`Ambient fallback failed; keeping first photo: ${error.message}`);
        }
      }
      if (restartPreview && cameraWanted && !boot.test) startStillPreview().catch(e => { $('#still-status').textContent = e.message; });
      const jpeg = shot.files.find(file => /\.jpe?g$/i.test(file.name));
      if (!jpeg) throw new Error('The RP capture did not contain a JPEG.');
      const files = shot.files.map(file => ({ name: file.name, data: file.data }));
      const original = new Blob([jpeg.data], { type: 'image/jpeg' });
      setMessage('Processing');
      const result = await finishPhoto(original, files, 'canon-rp-tether', shot.model);
      result.flashFired = initialFlashFired;
      result.ambientFallback = ambientFallback;
      result.capture.metadata.flashFired = shot.flashFired;
      result.capture.metadata.flash = shot.flash;
      result.capture.metadata.initialFlashFired = initialFlashFired;
      result.capture.metadata.ambientFallback = ambientFallback;
      result.capture.metadata.ambientFallbackIso = ambientFallbackIso;
      return result;
    }
    const canvas = document.createElement('canvas'); canvas.width = live.videoWidth; canvas.height = live.videoHeight;
    if (!canvas.width || !canvas.height) throw new Error('Camera is not delivering frames. Reconnect and try again.');
    const ctx = canvas.getContext('2d'); ctx.drawImage(live, 0, 0);
    const original = await blobFromCanvas(canvas), files = [{ name: 'original.jpg', data: await original.arrayBuffer() }];
    return finishPhoto(original, files, 'video-frame');
  }
  async function savePending() {
    if (!pending) return;
    const flashProblem = pending.flashProblem === true;
    hideLensCue(); phase = 'saving'; $('#capture').disabled = true; $('#save-actions').hidden = true; setMessage('Saving to this Mac…');
    try {
      const saved = await api.saveCapture(pending.capture);
      updateDelivery(saved.delivery);
      resetReview(); reviewURL = URL.createObjectURL(pending.display);
      live.hidden = true; rpLive.hidden = true; $('#live-text').textContent = 'SAVED / ON THIS MAC';
      $('#review-photo').src = reviewURL; $('#review-photo').hidden = false;
      pending = null; $('#toast').hidden = true; phase = 'review'; $('#viewfinder').classList.remove('shutter-prep'); counter.classList.remove('developing'); counter.hidden = true; lockInputs(false); $('#capture').disabled = false; $('#capture').textContent = 'Take another'; setMessage(flashProblem ? 'If the flash isn’t working, we may need to change its batteries.' : 'Saved');
      $('#capture-detail').textContent = `Saved as ${saved.id}.`;
      await api.boothActive(false);
      reviewTimer = setTimeout(() => ready().catch(e => toast(e.message, true)), REVIEW_MS);
    } catch(e) {
      phase = 'failed'; counter.hidden = true; $('#save-actions').hidden = false; $('#capture').disabled = true; setMessage('Not saved. Please ask the host.'); toast(`${e.message} Your capture is still held here; free some disk space, then retry.`, true);
    }
  }
  async function ready() { $('#viewfinder').classList.remove('shutter-prep'); hideLensCue(); counter.classList.remove('developing'); if (!stream && !stillPreviewRunning) return; resetReview(); phase = 'ready'; markActivity(); $('#camera-rest').hidden = true; if (stillPreviewRunning) { if (Date.now() - Math.max(lastStillFrameAt, previewStartedAt) > 5000) await startStillPreview(); rpLive.hidden = false; live.hidden = true; } else live.hidden = false; $('#live-label').hidden = false; $('#live-text').textContent = stillCamera.connected ? 'LIVE PREVIEW / RP STILL SAVED' : 'LIVE / VIDEO FRAME SAVED'; $('#capture').textContent = 'Take photo'; $('#capture').disabled = !boot.test && (!lastStillFrameAt || Date.now() - lastStillFrameAt > 5000); setMessage('Ready'); }
  function cancelCapture() {
    if (phase !== 'countdown') return;
    token++; hideLensCue(); counter.hidden = true; lockInputs(false); ready().catch(e => toast(e.message, true)); api.boothActive(false); setMessage('Cancelled');
  }
  async function capture() {
    if (recovering) return;
    markActivity();
    if (phase === 'resting') {
      try { await wakeCamera(); await ready(); return; }
      catch (e) { phase = 'resting'; $('#capture').disabled = false; setMessage('Tap to try waking the camera again'); toast(e.message, true); return; }
    }
    if (phase === 'countdown') { cancelCapture(); return; }
    if (phase === 'review') { await ready(); return; }
    if (phase !== 'ready' || (!boot.test && (!stillPreviewRunning || Date.now() - lastStillFrameAt > 5000))) return;
    const myToken = ++token; phase = 'countdown'; lockInputs(true); $('#capture').disabled = false; $('#capture').textContent = 'Cancel'; hideLensCue(); counter.classList.remove('recording'); counter.hidden = false;
    await api.boothActive(true);
    try {
      for (let n = COUNTDOWN_SECONDS; n > 0; n--) {
        if (myToken !== token) return;
        if (n === 1) hideLensCue();
        counter.textContent = n; setMessage(n === 1 && stillCamera.connected ? 'Hold still. Focusing…' : 'Look at the lens.');
        if (n === 2 && stillCamera.connected) {
          const exposure = stillExposure();
          $('#viewfinder').classList.add('shutter-prep');
          showLensCue();
          await delay(250);
          if (myToken !== token) return;
          await Promise.all([delay(750), api.focusStill(exposure)]);
        }
        else await delay(1000);
      }
      if (myToken !== token) return;
      hideLensCue(); $('#capture').disabled = true; counter.hidden = true;
      const result = await photograph(true);
      latestFlashProblem = stillCamera.connected && !boot.test && (result.flashFired === false || result.exposureCheck?.clearlyUnderlit === true);
      result.flashProblem = latestFlashProblem;
      hostAlert('flash-problem', latestFlashProblem).catch(error => cameraLog(`Flash alert: ${error.message}`));
      if (latestFlashProblem) cameraLog(`Possible missed flash: EXIF ${String(result.flashFired)}, mean ${result.exposureCheck.mean.toFixed(2)}, p85 ${result.exposureCheck.p85.toFixed(2)}; photo kept`);
      if (cameraWanted && !boot.test && !stillPreviewRunning) startStillPreview().catch(e => { $('#still-status').textContent = e.message; });
      if (myToken !== token || !result) return;
      pending = result; await savePending();
    } catch(e) { if (myToken !== token) return; hideLensCue(); counter.hidden = true; lockInputs(false); await ready(); await api.boothActive(false); toast(e.message, true); }
  }
  $('#capture').onclick = action(capture); $('#retry').onclick = action(savePending);
  $('#viewfinder').onclick = action(async () => {
    if (!guest || !['ready', 'resting', 'review'].includes(phase)) return;
    await capture();
  });
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (!guest && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement?.tagName) && e.key !== 'Escape') return;
    if (e.code === 'Space') { e.preventDefault(); capture().catch(e => toast(e.message, true)); }
    if (e.key === 'Escape') { e.preventDefault(); if (phase === 'countdown') cancelCapture(); else if (guest && !busy()) setGuest(false); }
  });
  if (!boot.test) {
    $('#connect').hidden = true; $('#apply-camera').textContent = 'Reconnect camera'; $('#disconnect').textContent = 'Pause camera';
    $('#camera-empty h2').textContent = 'Finding your camera.';
    $('#camera-empty p').textContent = 'Switch on the Canon RP and connect its USB cable. The live picture will appear automatically.';
    connect().catch(e => { cameraLog(e.message); setMessage('Waiting for camera. Retrying automatically…'); });
  }

}
