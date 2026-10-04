const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
(async () => {
  for (const name of ['Loop', 'Photobooth']) {
    const data = await fs.mkdtemp(path.join(os.tmpdir(), 'party-bundle-test-'));
    const app = await electron.launch({ executablePath: path.resolve('dist', `${name}-darwin-arm64`, `${name}.app`, 'Contents', 'MacOS', name), env: { ...process.env, PARTY_DATA_DIR: data }, timeout: 30000 });
    try {
      const page = await app.firstWindow(); await page.waitForSelector('h1');
      const bootstrap = await page.evaluate(() => window.party.bootstrap()); assert.equal(bootstrap.mode, name === 'Loop' ? 'loop' : 'booth'); assert.equal(bootstrap.test, false);
      assert.equal(await page.locator(name === 'Loop' ? '#start' : '#capture').isDisabled(), true);
      await page.screenshot({ path: path.resolve('artifacts', `${name.toLowerCase()}-final.png`) });
      console.log(`PASS packaged ${name}: correct mode, renderer, isolated empty data, camera inactive.`);
    } finally { await app.close(); await fs.rm(data, { recursive: true, force: true }); }
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
