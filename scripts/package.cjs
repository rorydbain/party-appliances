const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
(async () => {
  const { packager } = await import('@electron/packager');
  const arch = process.env.PARTY_ARCH || process.arch;
  const packageMetadata = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const requested = new Set(String(process.env.PARTY_APPS || 'loop,booth').split(',').map(value => value.trim()).filter(Boolean));
  execFileSync(process.execPath, [path.join(__dirname, 'build-native.cjs')], { stdio: 'inherit' });
  for (const [mode, name] of [['loop', 'Loop'], ['booth', 'Photobooth']]) {
    if (!requested.has(mode)) continue;
    const stage = path.join(root, '.packaging', name);
    await fs.rm(stage, { recursive: true, force: true });
    await fs.mkdir(stage, { recursive: true });
    await fs.cp(path.join(root, 'src'), path.join(stage, 'src'), { recursive: true });
    await fs.cp(path.join(root, 'node_modules', 'exifr'), path.join(stage, 'node_modules', 'exifr'), { recursive: true });
    await fs.writeFile(path.join(stage, 'package.json'), JSON.stringify({ name: name.toLowerCase() + '-party', productName: name, version: packageMetadata.version, description: mode === 'loop' ? 'Offline photo and video projection' : 'Local-first tethered photo booth', main: 'src/main.cjs' }));
    await fs.writeFile(path.join(stage, 'appliance.json'), JSON.stringify({ mode }));
    const bundleId = mode === 'booth' ? 'local.partyappliances.frame' : `local.partyappliances.${name.toLowerCase()}`;
    const paths = await packager({ dir: stage, name, extraResource: [path.join(root, 'bin'), path.join(root, 'scripts', 'print-receipt.py')], icon: path.join(root, 'assets', name + '.icns'), platform: 'darwin', arch, electronVersion: '44.2.0', out: path.join(root, 'dist'), overwrite: true, asar: true, prune: false, appBundleId: bundleId, appCategoryType: 'public.app-category.photography', extendInfo: mode === 'booth' ? { NSCameraUsageDescription: 'Photobooth uses your selected camera to make photos, saved first on this Mac.' } : {} });
    const bundle = path.join(paths[0], name + '.app');
    if (process.platform === 'darwin' && mode === 'booth') {
      try { execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Delete :NSMicrophoneUsageDescription', path.join(bundle, 'Contents', 'Info.plist')]); } catch {}
    }
    if (process.platform === 'darwin') execFileSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', bundle], { stdio: 'inherit' });
    console.log(`Built ${bundle}`);
    if (process.platform === 'darwin') {
      const installed = path.join('/Applications', `${name}.app`);
      try {
        await fs.rm(installed, { recursive: true, force: true });
        execFileSync('/usr/bin/ditto', [bundle, installed], { stdio: 'inherit' });
        if (mode === 'booth') await fs.rm(path.join('/Applications', 'Frame.app'), { recursive: true, force: true });
        console.log(`Installed ${installed}`);
      } catch (error) {
        console.warn(`Could not update ${installed}: ${error.message}`);
      }
    }
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
