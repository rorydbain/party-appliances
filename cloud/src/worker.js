import { privacyBody } from './privacy.js';
const ALLOWED = new Set(['original.jpg', 'print.jpg', 'thumb.jpg', 'clip.webm', 'clip.mp4']);
const TYPES = { 'original.jpg': 'image/jpeg', 'print.jpg': 'image/jpeg', 'thumb.jpg': 'image/jpeg', 'clip.webm': 'video/webm', 'clip.mp4': 'video/mp4' };
const MAX_FILE_BYTES = 40 * 1024 * 1024;
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function zipFields(size) { const bytes = new Uint8Array(size), view = new DataView(bytes.buffer); return { bytes, u16(offset, value) { view.setUint16(offset, value, true); }, u32(offset, value) { view.setUint32(offset, value >>> 0, true); } }; }
function zipTime(value) { const date = new Date(value || Date.now()), year = Math.max(1980, date.getUTCFullYear()); return { time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1), date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate() }; }

function page(title, body, env, options = {}) {
  const eventName = env.EVENT_NAME || 'Your event';
  const venue = env.EVENT_VENUE || '';
  const back = options.backHref ? `<a class="back" href="${escape(options.backHref)}" aria-label="Back to all photographs">‹</a>` : '';
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f1f0e9;color:#252923;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif}main{width:min(1080px,calc(100% - 32px));margin:42px auto 80px}header{border-bottom:1px solid #d6d8ce;padding-bottom:20px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:baseline;gap:20px}.header-brand{display:flex;align-items:center;gap:11px;min-width:0}.brand{font-size:27px;font-weight:650;letter-spacing:-1px;white-space:nowrap}.back{display:grid;place-items:center;width:34px;height:34px;flex:0 0 auto;border:1px solid #d6d8ce;border-radius:50%;font:28px/1 ui-monospace,SFMono-Regular,monospace;text-decoration:none;padding-bottom:3px}.back:hover{background:#e8e6dc}.muted,.timestamp{color:#72786e;font:12px ui-monospace,SFMono-Regular,monospace;letter-spacing:.08em;text-transform:uppercase}h1{font-size:clamp(34px,6vw,66px);line-height:1;letter-spacing:-.045em;font-weight:520;margin:24px 0 28px}.hero{display:block;width:100%;max-height:72vh;object-fit:contain;background:#171e1b;border-radius:8px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0 56px}a.button{display:inline-block;color:#f1f0e9;background:#252923;padding:12px 17px;border-radius:7px;text-decoration:none}.developing{min-height:48vh;display:grid;place-content:center;text-align:center;border:1px solid #d6d8ce;border-radius:8px;background:#e8e6dc;margin-bottom:56px;padding:32px}.developing h1{margin:18px 0 7px}.developing p{margin:0;color:#72786e}.developing-sheet{width:126px;height:86px;margin:auto;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:5px;transform:rotate(-2deg)}.developing-sheet i{display:block;border:1px solid #84928a;background:#f1f0e9;animation:develop 2.4s ease-in-out infinite}.developing-sheet i:nth-child(2){animation-delay:.2s}.developing-sheet i:nth-child(3){animation-delay:.4s}.developing-sheet i:nth-child(4){animation-delay:.6s}.developing-sheet i:nth-child(5){animation-delay:.8s}.developing-sheet i:nth-child(6){animation-delay:1s}.gallery-tools{display:flex;justify-content:flex-end;margin:0 0 20px}.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:18px 12px}.gallery-item{min-width:0}.tile{display:block;aspect-ratio:3/2;background:#171e1b;border-radius:6px;overflow:hidden}.tile img,.tile video{width:100%;height:100%;object-fit:cover}.timestamp{display:block;margin-top:7px;font-size:10px;letter-spacing:.06em}a{color:inherit}.admin-login{width:min(420px,100%);margin:12vh auto 0}.admin-login label{display:block;margin-bottom:8px}.admin-login input{width:100%;padding:13px;border:1px solid #d6d8ce;border-radius:7px;background:#fff;font:inherit}.admin-login button,.delete{margin-top:12px;border:0;border-radius:7px;background:#252923;color:#fff;padding:12px 17px;font:inherit;cursor:pointer}.admin-error{color:#9b3d30}.admin-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:22px 14px}.admin-card{margin:0}.admin-card img,.admin-card video{display:block;width:100%;aspect-ratio:3/2;object-fit:cover;background:#171e1b;border-radius:6px}.admin-meta{display:flex;align-items:center;justify-content:space-between;gap:8px}.delete{margin-top:7px;padding:7px 10px;background:#8b352c;font-size:12px}.admin-heading{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:24px}.admin-heading h1{margin:0}.admin-heading form{margin:0}.admin-heading button{border:0;background:none;text-decoration:underline;cursor:pointer}@keyframes develop{0%,72%,100%{background:#f1f0e9}36%{background:#547788;transform:scale(.9)}}@media(prefers-reduced-motion:reduce){.developing-sheet i{animation:none;background:#d6d8ce}}@media(max-width:520px){main{margin-top:30px}header{flex-direction:column;align-items:flex-start;gap:8px}.header-brand{width:100%;gap:8px}.brand{font-size:23px}.back{width:31px;height:31px}.header-brand+.muted{margin-left:39px}.timestamp{font-size:9px}.admin-heading h1{font-size:38px}}</style><main><header><span class="header-brand">${back}<span class="brand">${escape(eventName)}</span></span><span class="muted">${escape(venue)}</span></header>${body}</main>${title === 'Photo administration' ? '' : `<footer style="margin:24px;text-align:center;font-size:14px"><a href="/privacy">Privacy</a></footer>`}</html>`;
}

function formatTimestamp(value, env) {
  const date = new Date(value); if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: env.EVENT_TIMEZONE || 'UTC' }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value || '';
  return `${get('day')} ${get('month')} ${get('year')} · ${get('hour')}:${get('minute')}`;
}

function base64url(bytes) { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function signSession(secret, value) { const encoder = new TextEncoder(), key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))); }
function sameText(a, b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let result = 0; for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i); return result === 0; }
async function adminSession(request, env) {
  if (!env.ADMIN_SECRET) return false;
  const match = (request.headers.get('cookie') || '').match(/(?:^|;\s*)frame_admin=([^;]+)/); if (!match) return false;
  const [version, expires, signature] = decodeURIComponent(match[1]).split('.');
  if (version !== 'v1' || !/^\d+$/.test(expires) || Number(expires) < Date.now()) return false;
  return sameText(signature, await signSession(env.ADMIN_SECRET, `${version}.${expires}`));
}
function redirect(location, headers = {}) { return new Response(null, { status: 303, headers: { location, ...headers } }); }
function requestFromPublicSite(request, env) { const expected = String(env.PUBLIC_GALLERY_ORIGIN || '').replace(/\/+$/, ''); return !!expected && request.headers.get('origin') === expected; }

async function listAll(bucket, options) {
  const objects = [];
  let cursor;
  do {
    const listed = await bucket.list({ ...options, limit: 1000, ...(cursor ? { cursor } : {}) });
    objects.push(...listed.objects);
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return objects;
}

async function removeCapture(env, event, token) {
  if (!/^[a-z0-9-]{3,50}$/.test(event) || !/^[a-f0-9]{32}$/.test(token)) return false;
  const keys = (await listAll(env.FRAME_BUCKET, { prefix: `${event}/${token}/` })).map(object => object.key);
  if (keys.length) await env.FRAME_BUCKET.delete(keys);
  return true;
}

async function adminPage(request, env, error = '') {
  if (!await adminSession(request, env)) {
    const body = `<form class="admin-login" method="post" action="/api/admin/login"><p class="muted">Photo administration</p><h1>Sign in</h1>${error ? `<p class="admin-error">${escape(error)}</p>` : ''}<label for="passcode">Passcode</label><input id="passcode" name="passcode" type="password" autocomplete="current-password" required><button type="submit">Continue</button></form>`;
    return new Response(page('Photo administration', body, env), { status: error ? 401 : 200, headers: { 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'no-store' } });
  }
  const event = env.DEFAULT_EVENT, objects = await listAll(env.FRAME_BUCKET, { prefix: `${event}/`, include: ['customMetadata'] });
  const items = objects.filter(object => object.customMetadata?.capture === 'ready').sort((a, b) => String(b.customMetadata.createdAt).localeCompare(String(a.customMetadata.createdAt)));
  const origin = new URL(request.url).origin;
  const cards = items.map(item => { const metadata = item.customMetadata, token = item.key.split('/')[1], name = metadata.thumbnailName || metadata.previewName, src = mediaUrl(origin, event, token, name), timestamp = formatTimestamp(metadata.createdAt, env); return `<form class="admin-card" method="post" action="/api/admin/delete" onsubmit="return confirm('Delete this capture from the website?')"><input type="hidden" name="event" value="${escape(event)}"><input type="hidden" name="token" value="${token}">${metadata.kind === 'video' && name !== 'thumb.jpg' ? `<video src="${src}" muted playsinline preload="metadata"></video>` : `<img src="${src}" loading="lazy" alt="">`}<div class="admin-meta"><time class="timestamp" datetime="${escape(metadata.createdAt)}">${escape(timestamp)}</time><button class="delete" type="submit">Delete</button></div></form>`; }).join('');
  const body = `<div class="admin-heading"><h1>Photos</h1><form method="post" action="/api/admin/logout"><button type="submit">Sign out</button></form></div><div class="admin-grid">${cards || '<p>No captures.</p>'}</div>`;
  return new Response(page('Photo administration', body, env, { backHref: `/e/${encodeURIComponent(event)}` }), { headers: { 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'no-store' } });
}

async function adminLogin(request, env) {
  const form = await request.formData(), passcode = String(form.get('passcode') || '');
  if (!env.ADMIN_PASSWORD || !sameText(passcode, env.ADMIN_PASSWORD)) return adminPage(request, env, 'Incorrect passcode.');
  const expires = Date.now() + 24 * 60 * 60 * 1000, value = `v1.${expires}`, signature = await signSession(env.ADMIN_SECRET, value);
  return redirect('/admin', { 'set-cookie': `frame_admin=${value}.${signature}; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Strict` });
}

async function adminDelete(request, env) {
  if (!await adminSession(request, env)) return new Response('Unauthorized', { status: 401 });
  if (!requestFromPublicSite(request, env)) return new Response('Forbidden', { status: 403 });
  const form = await request.formData(), event = String(form.get('event') || ''), token = String(form.get('token') || '');
  if (event !== env.DEFAULT_EVENT || !await removeCapture(env, event, token)) return new Response('Invalid capture', { status: 400 });
  return redirect('/admin');
}

async function appDelete(request, env, token) {
  if (!env.UPLOAD_TOKEN || request.headers.get('authorization') !== `Bearer ${env.UPLOAD_TOKEN}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const event = new URL(request.url).searchParams.get('event') || '';
  if (!await removeCapture(env, event, token)) return Response.json({ error: 'Invalid capture' }, { status: 400 });
  return Response.json({ deleted: true });
}

function mediaUrl(origin, event, token, name, download = false) { return `${origin}/media/${encodeURIComponent(event)}/${token}/${name}${download ? '?download=1' : ''}`; }

async function upload(request, env) {
  if (!env.UPLOAD_TOKEN || request.headers.get('authorization') !== `Bearer ${env.UPLOAD_TOKEN}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  let form; try { form = await request.formData(); } catch { return Response.json({ error: 'Expected multipart form data' }, { status: 400 }); }
  let metadata; try { metadata = JSON.parse(String(form.get('metadata') || '')); } catch { return Response.json({ error: 'Invalid metadata' }, { status: 400 }); }
  if (!metadata || !/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(metadata.event) || !/^[a-f0-9]{32}$/.test(metadata.token) || !['photo', 'video'].includes(metadata.kind)) return Response.json({ error: 'Invalid capture identity' }, { status: 400 });
  const files = form.getAll('files').filter(value => typeof value !== 'string');
  if (!files.length || files.length > 3 || new Set(files.map(file => file.name)).size !== files.length || files.some(file => !ALLOWED.has(file.name) || file.size < 1 || file.size > MAX_FILE_BYTES)) return Response.json({ error: 'Invalid capture files' }, { status: 400 });
  if (metadata.kind === 'photo' && !files.some(file => ['print.jpg', 'original.jpg'].includes(file.name))) return Response.json({ error: 'Missing photograph' }, { status: 400 });
  const prefix = `${metadata.event}/${metadata.token}`;
  const previewName = files.some(file => file.name === 'print.jpg') ? 'print.jpg' : files.some(file => file.name === 'original.jpg') ? 'original.jpg' : files[0].name;
  const thumbnailName = files.some(file => file.name === 'thumb.jpg') ? 'thumb.jpg' : previewName;
  const downloadName = metadata.kind === 'photo' ? previewName : files.find(file => file.name.startsWith('clip.'))?.name || previewName;
  const fileInfo = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer()), checksum = crc32(bytes);
    await env.FRAME_BUCKET.put(`${prefix}/${file.name}`, bytes, { httpMetadata: { contentType: TYPES[file.name] } });
    fileInfo.push({ name: file.name, size: bytes.byteLength, crc32: checksum });
  }
  const downloadable = fileInfo.find(file => file.name === downloadName);
  await env.FRAME_BUCKET.put(`${prefix}/capture.json`, JSON.stringify({ id: metadata.id, token: metadata.token, event: metadata.event, kind: metadata.kind, createdAt: metadata.createdAt, files: files.map(file => file.name), fileInfo }), { httpMetadata: { contentType: 'application/json' }, customMetadata: { capture: 'ready', previewName, thumbnailName, downloadName, downloadBytes: String(downloadable.size), downloadCrc32: String(downloadable.crc32), kind: metadata.kind, createdAt: String(metadata.createdAt || ''), id: String(metadata.id || '') } });
  const origin = new URL(request.url).origin;
  const publicOrigin = String(env.PUBLIC_GALLERY_ORIGIN || origin).replace(/\/+$/, '');
  const galleryUrl = metadata.event === env.DEFAULT_EVENT ? publicOrigin : `${publicOrigin}/e/${metadata.event}`;
  return Response.json({ shareUrl: `${galleryUrl}/?photo=${metadata.token}`.replace('//?', '/?'), galleryUrl });
}

async function capturePage(request, env, event, token) {
  if (!/^[a-z0-9-]{3,50}$/.test(event) || !/^[a-f0-9]{32}$/.test(token)) return new Response('Not found', { status: 404 });
  const object = await env.FRAME_BUCKET.get(`${event}/${token}/capture.json`);
  if (!object) return new Response('Not found', { status: 404 });
  const item = await object.json(), origin = new URL(request.url).origin;
  const previewName = item.files.includes('print.jpg') ? 'print.jpg' : item.files.includes('original.jpg') ? 'original.jpg' : item.files[0];
  const media = item.kind === 'video' ? `<video class="hero" src="${mediaUrl(origin,event,token,previewName)}" controls playsinline></video>` : `<img class="hero" src="${mediaUrl(origin,event,token,previewName)}" alt="Your photograph">`;
  const downloadName = item.kind === 'photo' && item.files.includes('print.jpg') ? 'print.jpg' : item.kind === 'photo' && item.files.includes('original.jpg') ? 'original.jpg' : previewName;
  const label = item.kind === 'video' ? 'Download film' : 'Download photo';
  return new Response(page('Your photograph', `${media}<div class="actions"><a class="button" href="${mediaUrl(origin,event,token,downloadName,true)}">${label}</a></div>`, env, { backHref: `/e/${encodeURIComponent(event)}` }), { headers: { 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'public,max-age=60' } });
}

async function captureStatus(request, env, token) {
  const event = new URL(request.url).searchParams.get('event') || '';
  if (!/^[a-z0-9-]{3,50}$/.test(event) || !/^[a-f0-9]{32}$/.test(token)) return Response.json({ ready: false }, { status: 400, headers: { 'cache-control': 'no-store' } });
  const object = await env.FRAME_BUCKET.head(`${event}/${token}/capture.json`);
  return Response.json({ ready: !!object }, { headers: { 'cache-control': 'no-store', 'retry-after': '2' } });
}

async function photoFeed(request, env, event) {
  if (!/^[a-z0-9-]{3,50}$/.test(event)) return Response.json({ photos: [] }, { status: 400 });
  const objects = await listAll(env.FRAME_BUCKET, { prefix: `${event}/`, include: ['customMetadata'] });
  const origin = String(env.PUBLIC_GALLERY_ORIGIN || new URL(request.url).origin).replace(/\/+$/, '');
  const photos = objects.filter(object => object.customMetadata?.capture === 'ready' && object.customMetadata.kind === 'photo')
    .sort((a, b) => String(b.customMetadata.createdAt).localeCompare(String(a.customMetadata.createdAt))).slice(0, 120)
    .map(object => { const token = object.key.split('/')[1], metadata = object.customMetadata, name = metadata.previewName || metadata.downloadName; return { token, createdAt: metadata.createdAt || '', url: mediaUrl(origin, event, token, name) }; });
  return Response.json({ event, photos }, { headers: { 'cache-control': 'no-store' } });
}

async function gallery(request, env, event) {
  if (!/^[a-z0-9-]{3,50}$/.test(event)) return new Response('Not found', { status: 404 });
  const objects = await listAll(env.FRAME_BUCKET, { prefix: `${event}/`, include: ['customMetadata'] });
  const items = objects.filter(o => o.customMetadata?.capture === 'ready').sort((a,b) => String(b.customMetadata.createdAt).localeCompare(String(a.customMetadata.createdAt)));
  const origin = new URL(request.url).origin;
  const selectedToken = new URL(request.url).searchParams.get('photo');
  const validSelection = selectedToken && /^[a-f0-9]{32}$/.test(selectedToken) ? selectedToken : null;
  const selectedPreview = validSelection ? items.find(item => item.key.split('/')[1] === validSelection) : null;
  let selected = '';
  if (validSelection && !selectedPreview) {
    const statusUrl = `/api/captures/${validSelection}/status?event=${encodeURIComponent(event)}`;
    selected = `<section class="developing" aria-live="polite"><div><div class="developing-sheet" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div><h1>Uploading</h1><p>Your photo will appear here automatically.</p></div></section><script>(()=>{let delay=1200;async function poll(){try{const response=await fetch('${statusUrl}',{cache:'no-store'});const state=await response.json();if(state.ready){location.reload();return}}catch{}delay=Math.min(4000,delay*1.25);setTimeout(poll,delay)}setTimeout(poll,700)})()</script>`;
  } else if (selectedPreview) {
    const [,token] = selectedPreview.key.split('/'), name = selectedPreview.customMetadata.previewName;
    const object = await env.FRAME_BUCKET.get(`${event}/${token}/capture.json`);
    const item = object ? await object.json() : { files: [name], kind: selectedPreview.customMetadata.kind };
    const preview = item.kind === 'video' ? `<video class="hero" src="${mediaUrl(origin,event,token,name)}" controls playsinline></video>` : `<img class="hero" src="${mediaUrl(origin,event,token,name)}" alt="Your photograph">`;
    const downloadName = item.kind === 'photo' && item.files.includes('print.jpg') ? 'print.jpg' : item.kind === 'photo' && item.files.includes('original.jpg') ? 'original.jpg' : name;
    selected = `<section>${preview}<div class="actions"><a class="button" href="${mediaUrl(origin,event,token,downloadName,true)}">${item.kind === 'video' ? 'Download film' : 'Download photo'}</a></div></section>`;
  }
  const tiles = items.map(item => { const [,token] = item.key.split('/'), name = item.customMetadata.thumbnailName || item.customMetadata.previewName; const src = mediaUrl(origin,event,token,name); const content = item.customMetadata.kind === 'video' && name !== 'thumb.jpg' ? `<video src="${src}" muted playsinline preload="metadata"></video>` : `<img loading="lazy" decoding="async" src="${src}" alt="Party photograph">`; const timestamp = formatTimestamp(item.customMetadata.createdAt, env); return `<article class="gallery-item"><a class="tile" href="/e/${encodeURIComponent(event)}/p/${token}">${content}</a>${timestamp ? `<time class="timestamp" datetime="${escape(item.customMetadata.createdAt)}">${escape(timestamp)}</time>` : ''}</article>`; }).join('');
  const bulk = items.some(item => item.customMetadata.downloadName) ? `<a class="button" href="/e/${encodeURIComponent(event)}/download">Download all</a>` : '';
  const body = validSelection ? selected : `${bulk ? `<div class="gallery-tools">${bulk}</div>` : ''}<div class="gallery">${tiles || '<p>Photographs will appear here as they are made.</p>'}</div>`;
  return new Response(page(env.EVENT_NAME || 'Your event', body, env, validSelection ? { backHref: `/e/${encodeURIComponent(event)}` } : {}), { headers: { 'content-type': 'text/html;charset=UTF-8', 'cache-control': validSelection && !selectedPreview ? 'no-store' : 'public,max-age=10' } });
}

function localZipHeader(name, size, checksum, stamp) {
  const header = zipFields(30 + name.length);
  header.u32(0, 0x04034b50); header.u16(4, 20); header.u16(6, 0x0800); header.u16(8, 0);
  header.u16(10, stamp.time); header.u16(12, stamp.date); header.u32(14, checksum); header.u32(18, size); header.u32(22, size);
  header.u16(26, name.length); header.u16(28, 0); header.bytes.set(name, 30); return header.bytes;
}

function centralZipHeader(name, size, checksum, stamp, offset) {
  const header = zipFields(46 + name.length);
  header.u32(0, 0x02014b50); header.u16(4, 20); header.u16(6, 20); header.u16(8, 0x0800); header.u16(10, 0);
  header.u16(12, stamp.time); header.u16(14, stamp.date); header.u32(16, checksum); header.u32(20, size); header.u32(24, size);
  header.u16(28, name.length); header.u16(30, 0); header.u16(32, 0); header.u16(34, 0); header.u16(36, 0);
  header.u32(38, 0); header.u32(42, offset); header.bytes.set(name, 46); return header.bytes;
}

async function downloadAll(_request, env, event) {
  if (!/^[a-z0-9-]{3,50}$/.test(event)) return new Response('Not found', { status: 404 });
  const objects = await listAll(env.FRAME_BUCKET, { prefix: `${event}/`, include: ['customMetadata'] });
  const ready = objects.filter(object => object.customMetadata?.capture === 'ready' && ALLOWED.has(object.customMetadata.downloadName || ''))
    .sort((a, b) => String(a.customMetadata.createdAt).localeCompare(String(b.customMetadata.createdAt)));
  const encoder = new TextEncoder();
  const entries = ready.map((object, index) => {
    const metadata = object.customMetadata, token = object.key.split('/')[1], size = Number(metadata.downloadBytes), checksum = Number(metadata.downloadCrc32);
    const source = metadata.downloadName, extension = source.split('.').pop(), kind = metadata.kind === 'video' ? 'film' : 'photo';
    return { key: `${event}/${token}/${source}`, name: encoder.encode(`${kind}-${String(index + 1).padStart(4, '0')}.${extension}`), size, checksum, stamp: zipTime(metadata.createdAt) };
  }).filter(entry => Number.isSafeInteger(entry.size) && entry.size > 0 && entry.size <= MAX_FILE_BYTES && Number.isInteger(entry.checksum) && entry.checksum >= 0 && entry.checksum <= 0xffffffff);
  if (!entries.length) return new Response('No photographs are ready to download.', { status: 404 });
  const estimatedSize = entries.reduce((total, entry) => total + entry.size + 76 + entry.name.length * 2, 22);
  if (estimatedSize >= 0xffffffff) return new Response('The party archive is too large for one download.', { status: 413 });
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let offset = 0; const central = [];
        for (const entry of entries) {
          const object = await env.FRAME_BUCKET.get(entry.key);
          if (!object) throw new Error('A photograph disappeared while the archive was being prepared.');
          const local = localZipHeader(entry.name, entry.size, entry.checksum, entry.stamp);
          controller.enqueue(local); central.push(centralZipHeader(entry.name, entry.size, entry.checksum, entry.stamp, offset)); offset += local.length + entry.size;
          const reader = new Response(object.body).body.getReader();
          while (true) { const { done, value } = await reader.read(); if (done) break; controller.enqueue(value); }
        }
        const centralOffset = offset;
        for (const header of central) { controller.enqueue(header); offset += header.length; }
        const end = zipFields(22); end.u32(0, 0x06054b50); end.u16(4, 0); end.u16(6, 0); end.u16(8, entries.length); end.u16(10, entries.length); end.u32(12, offset - centralOffset); end.u32(16, centralOffset); end.u16(20, 0);
        controller.enqueue(end.bytes); controller.close();
      } catch (error) { controller.error(error); }
    }
  });
  return new Response(stream, { headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${event}.zip"`, 'cache-control': 'no-store' } });
}

async function media(request, env, event, token, name) {
  if (!/^[a-z0-9-]{3,50}$/.test(event) || !/^[a-f0-9]{32}$/.test(token) || !ALLOWED.has(name)) return new Response('Not found', { status: 404 });
  const object = await env.FRAME_BUCKET.get(`${event}/${token}/${name}`);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers(); object.writeHttpMetadata(headers); headers.set('etag', object.httpEtag); headers.set('cache-control', 'public,max-age=31536000,immutable');
  if (new URL(request.url).searchParams.get('download') === '1') headers.set('content-disposition', `attachment; filename="frame-${token.slice(0,8)}-${name}"`);
  return new Response(object.body, { headers });
}

export default { async fetch(request, env) {
  const url = new URL(request.url), parts = url.pathname.split('/').filter(Boolean);
  if (request.method === 'GET' && url.pathname === '/privacy') return new Response(page('Privacy', privacyBody(env), env), { headers: { 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'no-store' } });
  if (request.method === 'GET' && url.pathname === '/admin') return adminPage(request, env);
  if (request.method === 'POST' && url.pathname === '/api/admin/login') return adminLogin(request, env);
  if (request.method === 'POST' && url.pathname === '/api/admin/delete') return adminDelete(request, env);
  if (request.method === 'POST' && url.pathname === '/api/admin/logout') return redirect('/admin', { 'set-cookie': 'frame_admin=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict' });
  if (request.method === 'DELETE' && parts[0] === 'api' && parts[1] === 'captures' && parts.length === 3) return appDelete(request, env, parts[2]);
  if (request.method === 'POST' && url.pathname === '/api/captures') return upload(request, env);
  if (request.method === 'GET' && parts[0] === 'api' && parts[1] === 'captures' && parts[3] === 'status' && parts.length === 4) return captureStatus(request, env, parts[2]);
  if (request.method === 'GET' && parts[0] === 'api' && parts[1] === 'events' && parts[3] === 'photos' && parts.length === 4) return photoFeed(request, env, parts[2]);
  if (request.method === 'GET' && url.pathname === '/' && env.DEFAULT_EVENT) return gallery(request, env, env.DEFAULT_EVENT);
  if (request.method === 'GET' && parts[0] === 'e' && parts.length === 2) return gallery(request, env, parts[1]);
  if (request.method === 'GET' && parts[0] === 'e' && parts[2] === 'download' && parts.length === 3) return downloadAll(request, env, parts[1]);
  if (request.method === 'GET' && parts[0] === 'e' && parts[2] === 'p' && parts.length === 4) return capturePage(request, env, parts[1], parts[3]);
  if (request.method === 'GET' && parts[0] === 'media' && parts.length === 4) return media(request, env, parts[1], parts[2], parts[3]);
  return new Response('Not found', { status: 404 });
} };
