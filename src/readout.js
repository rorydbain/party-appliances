/* Shared by the control preview and the projector. All text is rendered as text. */
(() => {
  function lines(item, settings) {
    if (!settings.metadata || !item) return [];
    const data = item.metadata;
    if (!data) return [];
    const manual = data.manual || {}, has = key => Object.prototype.hasOwnProperty.call(manual, key);
    const caption = has('caption') ? manual.caption : '';
    const place = has('place') ? manual.place : data.placeName;
    const automaticDate = data.source === 'scan' ? '' : String(data.capturedAt || '').slice(0, 10);
    const date = has('date') ? manual.date : automaticDate;
    const formatDate = value => {
      const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/.exec(value || '');
      if (!match) return '';
      if (!match[2]) return match[1];
      const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(match[2]) - 1];
      return match[3] ? `${Number(match[3])} ${month} ${match[1]}` : `${month} ${match[1]}`;
    };
    const result = [];
    if (caption) result.push(caption);
    const facts = [settings.gps && place ? String(place).trim() : '', formatDate(date)].filter(Boolean);
    if (facts.length) result.push(facts.join(' · '));
    if (data.camera && settings.camera !== false) result.push(data.camera);
    return result;
  }
  function render(container, item, settings) {
    const content = lines(item, settings);
    container.replaceChildren(...content.map(text => { const row = document.createElement('div'); row.textContent = text; return row; }));
    container.hidden = !content.length;
    container.dataset.corner = settings.metadataCorner === 'left' ? 'left' : 'right';
  }
  window.readout = { lines, render };
})();
