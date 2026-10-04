const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { atomicWrite } = require('./core.cjs');
const keyFor = point => point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180 ? `${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}` : null;
const cleanName = text => typeof text === 'string' ? text.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 180) : '';
function appleLookup(executable, point) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [], { stdio: ['pipe', 'pipe', 'ignore'], timeout: 21000 });
    let output = '';
    child.stdout.on('data', data => { output += data; if (output.length > 16000) child.kill(); });
    child.on('error', () => reject(new Error('Place lookup is unavailable.')));
    child.stdin.on('error', () => {});
    child.on('close', code => {
      if (code !== 0) return reject(new Error('Apple could not resolve this location.'));
      try { const name = cleanName(JSON.parse(output).placeName); if (!name) throw new Error(); resolve(name); }
      catch { reject(new Error('No place name returned.')); }
    });
    child.stdin.end(JSON.stringify(point) + '\n');
  });
}
async function resolvePlaces(library, lookup, progress = () => {}, cancelled = () => false, delayMs = 1500) {
  const cacheFile = path.join(library.root, 'places.json');
  let cache = {};
  try { const data = JSON.parse(await fs.readFile(cacheFile, 'utf8')); if (data && typeof data === 'object' && !Array.isArray(data)) cache = data; } catch {}
  const targets = new Map();
  for (const item of library.state.items) {
    const key = keyFor(item.metadata?.location);
    if (key && !item.metadata.placeName) targets.set(key, item.metadata.location);
  }
  const stats = { total: targets.size, done: 0, resolved: 0, failed: 0, cancelled: false };
  progress({ ...stats });
  let lastLookup = 0, consecutiveFailures = 0;
  for (const [key, point] of targets) {
    if (cancelled()) { stats.cancelled = true; break; }
    let name = cleanName(cache[key]?.placeName);
    if (!name) {
      const wait = Math.max(0, lastLookup + delayMs - Date.now());
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      if (cancelled()) { stats.cancelled = true; break; }
      lastLookup = Date.now();
      try { name = cleanName(await lookup(point)); } catch {}
      if (name) {
        cache[key] = { placeName: name, provider: 'Apple', resolvedAt: new Date().toISOString() };
        await atomicWrite(cacheFile, JSON.stringify(cache, null, 2));
      }
    }
    if (name) {
      // Use current state so lookup cannot undo edits/imports made during it.
      await library.serial(() => library.persist({ ...library.state, items: library.state.items.map(item => keyFor(item.metadata?.location) === key ? { ...item, metadata: { ...item.metadata, placeName: name, placeSource: 'Apple reverse geocoding' } } : item) }));
      stats.resolved++; consecutiveFailures = 0;
    } else { stats.failed++; consecutiveFailures++; }
    stats.done++; progress({ ...stats });
    if (consecutiveFailures >= 3) { stats.stoppedEarly = true; break; }
  }
  stats.cancelled ||= cancelled();
  return stats;
}
module.exports = { keyFor, appleLookup, resolvePlaces };
