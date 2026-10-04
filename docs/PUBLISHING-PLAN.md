# Publishing Loop and Photobooth

## Recommendation

Publish **one repository** named `party-appliances`, containing both Loop and
Photobooth. They share the Electron shell, media handling, visual language,
packaging scripts and optional photo feed. Keeping them together makes fixes
and releases substantially easier, while the packaging command can continue to
produce two separate Mac applications.

The first public release should describe the software honestly:

- Loop is a general-purpose Mac slideshow for mixed photos and videos.
- Photobooth is a tested appliance for one specific hardware profile: a Canon
  EOS RP connected by USB, with an optional Epson TM-T20III receipt printer.
- Capture and playback work locally. Cloud delivery, QR receipts, iMessage
  alerts and the live Loop feed are optional additions.
- macOS is the supported platform. Raspberry Pi, Windows, other cameras and
  other receipt printers are not supported in version 0.1.

The project can retain its character and the details of the original build.
People can modify the interface and behaviour themselves. Configuration should
cover event identity and service addresses so a fork does not silently point at
the original live event.

## Before making the repository public

### 1. Preserve the event build

- Copy the currently installed applications and working configuration into a
  private event archive.
- Record the exact app version, Canon settings, printer USB identity and cloud
  deployment used at the event.
- Keep the existing application data directories compatible. In particular,
  Photobooth currently uses the legacy `Frame` preferences directory; migrate
  it only with a tested one-time compatibility path.

This prevents public cleanup from destabilising the setup that already works.

### 2. Remove private and event-specific defaults

Move these values into a checked-in example event profile and a local ignored
profile:

- event name and venue;
- event slug;
- gallery public URL and Worker upload URL;
- Loop's live photo-feed URL;
- receipt headings;
- Messages alert recipient;
- privacy contact and optional statistics service.

The application should start with cloud sharing, receipts and alerts disabled.
The checked-in example should use values such as `Alex + Sam`,
`Example venue`, `our-party` and `https://photos.example.com`.

Remove the hard-coded `photos.example.com` validation in the desktop app. Validate
photo links against the configured public origin instead. Make the Vercel proxy
and statistics integration optional; neither should be required for a local
booth or a basic Cloudflare deployment.

Before the first push, run a secret scan over the complete prospective Git
contents. Do not include `.vercel`, local delivery configuration, built apps,
capture folders, delivery queues, logs, `.packaging`, or test photographs.

### 3. Resolve redistributable assets

- Do not commit or package the Presetpro Portra LUT unless its licence clearly
  permits redistribution. Replace the personal iCloud lookup with a user-selected
  `.cube` file and keep the built-in, original warm-film treatment as the default.
- The bundled Shorelines Display font identifies itself as “All Rights Reserved”.
  Confirm the licence or replace it with a redistributable font before publishing.
- Keep Inter only with its licence text in the repository.
- Include attribution and licence files for every bundled font and third-party
  component.

The interface can still call the user-supplied look “Portra 400” locally. The
public build should avoid implying that it ships an official Kodak profile.

### 4. Make first run understandable

Add a first-run setup screen rather than requiring edits inside Application
Support. It should show four independent sections:

1. **Local booth:** verify `gphoto2`, detect the Canon, show a fresh live frame,
   read battery state, make a test exposure and confirm the capture folder.
2. **Receipt printer:** offer disabled / Epson TM-T20III, install or verify the
   local Python printer helper, show paper status and print a test receipt.
3. **Photo delivery:** accept the Worker URL, public gallery URL, event slug and
   upload token; verify them with a harmless connection test.
4. **Alerts:** accept an optional Messages recipient and send a test warning.

All optional features should fail independently. A missing printer must not
disable photographs; missing internet must not delay capture or printing; a
missing cloud profile must not make Loop contact the original gallery.

For Loop, the first-run text only needs to explain extended displays, the local
library copy, playback checking and the optional booth-feed address.

### 5. Document the tested hardware

Create a short `HARDWARE.md` led by the setup that actually worked:

- Apple-silicon Mac running a supported macOS release;
- Canon EOS RP and RF 28mm F2.8 STM;
- SD card and USB-C data cable;
- one Canon 430EX II on the camera hot shoe, four low-self-discharge NiMH AAs
  and at least one charged spare set;
- optional DR-E18 DC coupler plus AC-E6N-compatible supply for long sessions;
- standard iPad using Sidecar as the guest display;
- Epson TM-T20III over USB, its original power supply and 80 mm thermal rolls;
- a second Mac and projector or large display for Loop.

Document the tested still settings: medium JPEG, memory-card capture target,
flash-first exposure, f/5.6, ISO 400 and 1/80 s, plus the separate live-view
settings. Include the real subject-distance and diffuser arrangement after one
final measurement. Keep the cardboard drawings as a case study rather than a
required enclosure.

Older planning documents currently contradict the finished build: they mention
an M50, two flashes, video capture and unfinished native shutter support. Move
these to `docs/history/` with a clear archival label, or rewrite them around the
final tested setup.

### 6. Restructure the documentation

Keep the root README short:

1. screenshots of Loop and Photobooth;
2. what each app does;
3. supported Mac and hardware;
4. quickest local install;
5. links to hardware, cloud and development guides;
6. current limitations.

Suggested documentation:

- `docs/LOOP.md` — importing, layouts, video excerpts, metadata and projector use;
- `docs/PHOTOBOOTH.md` — Canon setup, guest mode, captures and recovery;
- `docs/HARDWARE.md` — exact tested shopping list and physical setup;
- `docs/CLOUD.md` — optional Cloudflare R2/Worker and Vercel custom-domain proxy;
- `docs/PRINTER.md` — Epson install, test, paper and reprinting;
- `docs/EVENT-CHECKLIST.md` — rehearsal, start-up, spares and shutdown;
- `docs/DEVELOPMENT.md` — architecture, commands, tests and packaging.

Avoid presenting old proposals as current instructions. Retain the Blender files
and box drawings under an “original build” section.

### 7. Make installation repeatable

For a source-based 0.1 release, provide one setup script that checks or installs:

- Node and npm dependencies;
- Homebrew `gphoto2` for Photobooth;
- the printer virtual environment and pinned Python dependencies when printing
  is selected;
- the native place-name helper;
- both packaged applications in `/Applications`.

The script should print what it will change and support Loop-only installation.
Pin the Python requirements exactly and add a clean uninstall/data-location
guide.

For releases that non-developers can download, produce separate Loop and
Photobooth ZIP files for Apple silicon. Intel can be source-build-only initially.
Unsigned applications require the existing macOS “Open Anyway” flow. A polished
release eventually needs an Apple Developer certificate, hardened runtime and
notarisation. Do not tell users to disable Gatekeeper.

### 8. Repository basics

- Add a licence after choosing the intended reuse terms. MIT is the simplest if
  broad reuse is desired; it does not grant rights to separately licensed assets.
- Add `CONTRIBUTING.md`, `SECURITY.md`, a code of conduct only if wanted, and an
  issue template requesting macOS, Mac model, camera, printer and diagnostic log.
- Extend `.gitignore` for `.vercel`, local Wrangler state, `.env*`, event profiles,
  generated native binaries, capture data and diagnostic logs.
- Add a changelog and change the package from private event version `0.1.0` to a
  deliberate public prerelease such as `0.1.0-beta.1`.
- Run unit tests and cloud tests in GitHub Actions. Keep UI tests isolated so they
  do not open applications during normal local test runs.
- Add Dependabot or Renovate after the first release. Current production
  dependency audits report no known vulnerabilities.

## Sensible release sequence

### Public source preview

Complete the asset, secret and configuration cleanup; add the new README,
hardware guide, setup checker and licence; initialise Git; then publish the
source as a preview. Users build locally. This is the smallest responsible
release and is enough for friends who are comfortable modifying it.

### Downloadable beta

Add repeatable release packaging, sample event profiles, a setup assistant and
GitHub release ZIPs. Test on a second clean Apple-silicon Mac with no existing
Party Appliances data, Homebrew packages or Cloudflare credentials.

### Friendly release

Add signing/notarisation, in-app event configuration export/import, clearer
camera/printer diagnostics and an update mechanism. Consider more camera models
only when each one has an explicit configuration profile and a complete physical
capture test.

## Version 0.1 release test

The public preview is ready when a clean Mac can:

- build and open Loop, import a mixed library and project for two hours;
- build and open Photobooth, connect an RP, recover from one unplug/replug and
  take 20 consecutive flashed photographs;
- save every capture locally with cloud completely unconfigured;
- print and reprint with the Epson when enabled;
- lose network access during an upload, continue taking photographs and finish
  the queue after reconnecting;
- deploy a fresh example Worker/bucket without references to personal accounts;
- package without the commercial font or third-party LUT;
- pass unit, cloud, secret-scan and package smoke checks.
