const fs = require('node:fs/promises');

const DEFAULT_EVENT = Object.freeze({
  eventName: 'Your event',
  venue: '',
  eventSlug: '',
  publicUrl: '',
  liveFeedUrl: '',
  receiptTitle: 'YOUR EVENT',
  receiptVenue: ''
});

function shortText(value, fallback = '', max = 120) {
  const text = String(value ?? '').replace(/[\r\n\0]/g, ' ').trim();
  return text ? text.slice(0, max) : fallback;
}

function httpUrl(value) {
  const text = shortText(value, '', 500).replace(/\/+$/, '');
  try {
    const url = new URL(text);
    if (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return url.toString().replace(/\/+$/, '');
  } catch {}
  return '';
}

function cleanEventProfile(value = {}) {
  const eventName = shortText(value.eventName, DEFAULT_EVENT.eventName);
  const venue = shortText(value.venue);
  const eventSlug = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(String(value.eventSlug || '').toLowerCase()) ? String(value.eventSlug).toLowerCase() : '';
  const publicUrl = httpUrl(value.publicUrl);
  let liveFeedUrl = httpUrl(value.liveFeedUrl);
  if (!liveFeedUrl && publicUrl && eventSlug) liveFeedUrl = `${publicUrl}/api/events/${eventSlug}/photos`;
  return {
    eventName,
    venue,
    eventSlug,
    publicUrl,
    liveFeedUrl,
    receiptTitle: shortText(value.receiptTitle, eventName.toUpperCase(), 48),
    receiptVenue: shortText(value.receiptVenue, venue.toUpperCase(), 64)
  };
}

async function loadEventProfile(file) {
  try { return cleanEventProfile(JSON.parse(await fs.readFile(file, 'utf8'))); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error(`Could not read event profile: ${error.message}`); }
  return cleanEventProfile();
}

module.exports = { DEFAULT_EVENT, cleanEventProfile, loadEventProfile };
