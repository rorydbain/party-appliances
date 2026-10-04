const { _electron: electron } = require('playwright');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const screenshots = path.join(root, 'docs', 'screenshots');
const media = path.join(screenshots, 'demo-media');

async function launch(mode, data) {
  const instance = await electron.launch({
    args: [root, `--mode=${mode}`],
    env: { ...process.env, PARTY_TEST: '1', PARTY_HEADLESS: '1', PARTY_DATA_DIR: data },
    timeout: 30_000
  });
  const page = await instance.firstWindow();
  await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 900));
  await page.waitForSelector('h1');
  return { instance, page };
}

async function booth(data) {
  const { instance, page } = await launch('booth', data);
  try {
    const dataUrl = `data:image/jpeg;base64,${await fs.readFile(path.join(media, 'group.jpg'), 'base64')}`;
    await page.evaluate(async source => {
      const image = document.querySelector('#rp-live');
      image.src = source;
      await image.decode();
      image.hidden = false;
      image.style.opacity = '1';
      document.querySelector('#rp-graded').style.display = 'none';
      document.querySelector('#camera-empty').hidden = true;
      document.querySelector('#live-label').hidden = false;
      document.querySelector('#live-text').textContent = 'LIVE PREVIEW / RP STILL SAVED';
      document.querySelector('#still-status').textContent = 'Canon EOS RP connected for tethered stills.';
      document.querySelector('#resolution').textContent = 'Canon RP live feed · medium JPEG stills.';
      document.querySelector('#apply-camera').textContent = 'Reconnect Canon RP';
      document.querySelector('#booth-message').textContent = 'Ready';
      document.querySelector('#capture').disabled = false;
      document.querySelector('#guest').disabled = false;
      document.querySelector('#disconnect').disabled = false;
    }, dataUrl);
    await page.screenshot({ path: path.join(screenshots, 'photobooth-host.jpg'), type: 'jpeg', quality: 88 });
    await page.evaluate(() => document.body.classList.add('guest'));
    await page.screenshot({ path: path.join(screenshots, 'photobooth-guest.jpg'), type: 'jpeg', quality: 88 });
  } finally {
    await instance.close();
  }
}

async function loop(data) {
  const { instance, page } = await launch('loop', data);
  try {
    const files = ['group.jpg', 'portrait.jpg', 'dance.jpg', 'table.jpg', 'couple.jpg', 'outside.jpg'].map(name => path.join(media, name));
    await instance.evaluate(async ({ ipcMain, BrowserWindow }, sources) => {
      const importFiles = ipcMain._invokeHandlers.get('test-import');
      await importFiles({ sender: BrowserWindow.getAllWindows()[0].webContents }, sources);
    }, files);
    await page.reload();
    await page.waitForSelector('#playlist li[data-id]');
    await page.locator('#playback-layout').selectOption('grid');
    await page.locator('#fit').selectOption('cover');
    const opened = instance.waitForEvent('window');
    await page.locator('#start').click();
    const output = await opened;
    await output.waitForFunction(() => document.querySelectorAll('.grid-tile[data-active="true"] img.visible').length === 6);
    await output.waitForTimeout(1600);
    await output.screenshot({ path: path.join(screenshots, 'loop-grid.jpg'), type: 'jpeg', quality: 88 });
  } finally {
    await instance.close();
  }
}

(async () => {
  await fs.mkdir(screenshots, { recursive: true });
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'party-docs-'));
  try {
    await booth(path.join(data, 'booth'));
    await loop(path.join(data, 'loop'));
  } finally {
    await fs.rm(data, { recursive: true, force: true });
  }
  console.log(`Updated screenshots in ${screenshots}`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
