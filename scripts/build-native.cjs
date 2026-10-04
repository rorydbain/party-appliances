const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const arch = process.env.PARTY_ARCH || process.arch;
if (process.platform !== 'darwin') throw new Error('The place lookup helper requires macOS.');
fs.mkdirSync(path.join(root, 'bin'), { recursive: true });
execFileSync('xcrun', ['swiftc', '-O', '-target', `${arch === 'x64' ? 'x86_64' : 'arm64'}-apple-macos13.0`, '-framework', 'CoreLocation', path.join(root, 'native', 'resolve-place.swift'), '-o', path.join(root, 'bin', 'resolve-place')], { stdio: 'inherit' });
