const fs = require('node:fs/promises');
const nodeFs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');

const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.m4v': 'video/x-m4v', '.mov': 'video/quicktime', '.webm': 'video/webm' };

function parseRange(value, size) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(value).trim());
  if (!match || (!match[1] && !match[2]) || size <= 0) return false;
  let start, end;
  if (!match[1]) { const suffix = Number(match[2]); if (!Number.isSafeInteger(suffix) || suffix <= 0) return false; start = Math.max(0, size - suffix); end = size - 1; }
  else { start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1; }
  if (![start, end].every(Number.isSafeInteger) || start < 0 || start >= size || end < start) return false;
  return { start, end: Math.min(end, size - 1) };
}

async function localMediaResponse(file, request) {
  const stat = await fs.stat(file), range = parseRange(request.headers.get('range'), stat.size), headers = new Headers({
    'Access-Control-Allow-Origin': '*', 'Accept-Ranges': 'bytes', 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Last-Modified': stat.mtime.toUTCString(), 'Cache-Control': 'private, max-age=3600'
  });
  if (range === false) { headers.set('Content-Range', `bytes */${stat.size}`); return new Response(null, { status: 416, headers }); }
  const start = range?.start ?? 0, end = range?.end ?? stat.size - 1;
  headers.set('Content-Length', String(Math.max(0, end - start + 1)));
  if (range) headers.set('Content-Range', `bytes ${start}-${end}/${stat.size}`);
  if (request.method === 'HEAD') return new Response(null, { status: range ? 206 : 200, headers });
  const body = Readable.toWeb(nodeFs.createReadStream(file, { start, end }));
  return new Response(body, { status: range ? 206 : 200, headers });
}

module.exports = { parseRange, localMediaResponse };
