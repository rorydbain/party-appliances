const exifr = require('exifr');

const VERSION = 2;
const clean = v => typeof v === 'string' ? v.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 100) : '';
function recordedDate(value) {
  // Preserve the camera's wall-clock date. An absent timezone is not UTC.
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:$|[.+Z-])/.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1).map(Number);
  if (year < 1900 || year > new Date().getFullYear() + 1 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return null;
  if (day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
}
function isScan(tags) {
  const device = `${clean(tags.Make)} ${clean(tags.Model)}`;
  const software = clean(tags.Software);
  return /scanner|\bscanjet\b|\bcoolscan\b|\bnoritsu\b|\bfrontier\b|\bimacon\b|\bflextight\b|\bpakon\b|\bplustek\b|\breflecta\b|\bperfection\b|\bSP[- ]?(?:500|1500|2000|2500|3000)(?![A-Za-z0-9])|\bLS[- ]?(?:40|50|2000|4000|5000|8000|9000)\b/i.test(device)
    || /vuescan|silverfast|epson\s*scan|nikon\s*scan/i.test(software);
}
function normalizeMetadata(tags = {}) {
  tags ||= {};
  if (isScan(tags)) return { version: VERSION, source: 'scan', camera: '', capturedAt: null, dateSource: null, location: null };

  const make = clean(tags.Make), model = clean(tags.Model);
  const camera = model ? (make && !model.toLowerCase().startsWith(make.toLowerCase()) ? `${make} ${model}` : model) : '';
  const capturedAt = camera ? recordedDate(tags.DateTimeOriginal) : null;
  const latitude = tags.latitude, longitude = tags.longitude;
  const location = typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
  return { version: VERSION, camera, capturedAt, dateSource: capturedAt ? 'EXIF DateTimeOriginal (camera clock)' : null, location };
}
async function readMetadata(file, kind) {
  if (kind !== 'image') return normalizeMetadata();
  try {
    const tags = await exifr.parse(file, { tiff: true, exif: true, gps: true, xmp: false, iptc: false, icc: false, ifd1: false, reviveValues: false, pick: ['Make', 'Model', 'Software', 'DateTimeOriginal', 'GPSLatitude', 'GPSLatitudeRef', 'GPSLongitude', 'GPSLongitudeRef'] });
    return normalizeMetadata(tags);
  } catch { return normalizeMetadata(); } // Missing or damaged EXIF must not reject playable media.
}
module.exports = { VERSION, recordedDate, normalizeMetadata, readMetadata };
