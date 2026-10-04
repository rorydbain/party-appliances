# Development and architecture

Loop and Photobooth are separately packaged Electron applications sharing one
plain JavaScript codebase. `appliance.json` selects the packaged mode. Renderer
processes use sandboxing and context isolation, cannot access Node directly,
cannot navigate to remote pages and communicate through the allowlisted preload
bridge.

## Main components

- `src/main.cjs`: windows, display output, IPC, native file access, Canon and
  delivery orchestration.
- `src/core.cjs`: Loop library persistence and durable capture writes.
- `src/canon.cjs`: serialized `gphoto2` setup, preview, focus, shutter and health.
- `src/delivery.cjs`: persistent idempotent upload/print/delete queue.
- `src/playback.js` and `src/output.js`: shuffle, layouts, excerpts and projection.
- `cloud/src/worker.js`: authenticated uploads, R2 media, public gallery and admin.
- `gallery/api/proxy.js`: optional custom-domain proxy.

## Commands

```sh
npm ci
npm test
npm run loop
npm run booth
npm run package:loop
npm run package:booth
npm run package
```

`npm test` uses synthetic data and does not open application windows. The
explicit `npm run test:app` Playwright smoke test does open Electron windows and
writes temporary screenshots, so run it only when interactive UI verification
is intended.

Cloud tests run separately:

```sh
cd cloud
npm ci
npm test
```

## Persistence

Loop copies imported media before recording it in an atomically written
manifest. Photobooth writes each capture into a temporary directory, syncs its
files, and renames the complete directory into place. Delivery queue state is
persisted before network or printer work. Interrupted uploads reuse the same
public token, while ambiguous interrupted prints stop for host attention.

The Photobooth user-data directory remains named `Frame` for compatibility with
existing installations. Do not rename it without a tested migration for queue,
preferences and printer environment.

## Releases

Development bundles are ad-hoc signed. Public downloadable releases should add
an Apple Developer identity, hardened runtime and notarisation. The current
package command builds for the host architecture; set `PARTY_ARCH=x64` for an
Intel build.
