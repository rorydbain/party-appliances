# Loop & Photobooth

Two Mac apps for a party, built from scratch. Playback and capture work offline, with no account or connection between the Macs. Optional place-name preparation uses Apple’s online location service, then caches the results locally. Photobooth can also queue guest photos locally and upload them to an optional private Cloudflare Worker + R2 service for collection and receipt QR codes.

- **Loop** runs the photos and videos you choose on a projector, with a separate control window.
- **Photobooth** runs a photo booth with a full-screen guest interface.

## Open the apps

The ready-to-open Apple silicon builds are in `dist/Loop-darwin-arm64/Loop.app` and `dist/Photobooth-darwin-arm64/Photobooth.app`. Copy the appropriate app to each Mac’s Applications folder, then open it. They contain their own runtime; Node is not needed to run the packaged apps. These are local development builds, ad-hoc signed, not Apple-notarized distribution releases. If macOS blocks a copied build, use the app-specific **Open Anyway** option in Privacy & Security. Do not disable Gatekeeper.

This build targets Apple silicon Macs. For an Intel Mac, run `PARTY_ARCH=x64 npm run package` on the build machine. macOS 13 or later is the target for the recommended capture hardware; the two actual event Macs still need a rehearsal.

[See the RP box drawings and build notes](docs/RP-BOX.md) · [Read the previous shopping list](docs/SHOPPING-LIST.md) · [Read the revised portable booth proposal](docs/COMPACT-BOOTH.md) · [Read the original hardware and lighting plan](docs/BUILD-PLAN.md) · [Read the party-day runbook](docs/RUNBOOK.md) · [Read implementation and verification notes](docs/TECHNICAL.md)

## First run: Loop

1. Connect the projector and use **extended display**, rather than screen mirroring.
2. Add photos and videos. Loop copies them into `~/Movies/Party Appliances/Loop library/media`; originals can be moved without breaking the show.
3. Use the up/down controls to order the sequence. Removing an item removes it from the playlist, not from the original location or library folder.
4. Use **Check playback**. Convert any rejected files to JPEG/PNG or H.264 MP4 before the party. An extension alone does not guarantee a compatible codec.
5. Choose the projector in **Play on** and start projection. Photos default to eight seconds; films play to the end; the whole sequence loops. Videos default to muted.
6. The controller provides pause, next/previous and blackout. Blackout also suspends playback and audio. Closing output leaves the controller open.

The **Layout** control offers a single-item sequence or a grid of up to six independent tiles. The grid moves between four-, five- and six-tile mosaics every 70–120 seconds. Existing tiles glide into their new positions and surplus tiles fade away; all layouts cover the display and include a useful mix of portrait, landscape and feature shapes. Media is matched to a similarly proportioned tile both when a layout forms and when an individual tile changes. In grid mode, every photo appearance gets a slightly different duration, and a shared queue keeps visible changes at least 850 ms apart when independent timers converge. Videos up to 12 seconds play in full. Longer videos receive between two and twelve appearances per rotation, increasing by roughly one appearance for every 30 seconds of footage. Loop divides the full running time into sections of at most 12 seconds and shuffles through sections it has not recently shown. This continues across playlist rotations, so a long film gradually shows most of its running time without ever occupying a tile for more than 12 seconds at once. A separate wall-clock timer enforces that limit even when a file reports missing or invalid duration metadata. No temporary excerpt files are made. Grid videos remain muted to avoid overlapping sound, and separate tiles avoid showing the same source simultaneously. **Show the whole image** preserves every source without cropping. **Balanced fill** fills a tile when it only needs a small crop, then automatically shows the whole source over a soft edge fill when the aspect ratios are too different. Pause, blackout and manual next/previous apply to the whole grid. The control screen estimates one complete rotation using the selected photo timing, measured clip lengths, all excerpt appearances, concurrent grid tiles and cached booth photographs.

Playback never starts at the top of the editable list. Single mode shuffles the complete deck on launch and again after every rotation. Grid mode shares one shuffled deck across all tiles: each planned appearance is consumed before the deck resets, with a 48-item look-ahead used to find a suitable aspect ratio. A source cannot return within the most recent 80 grid changes unless the library is too small to satisfy that rule. Same-named videos with matching rounded durations are treated as the same footage, which prevents duplicate imports from appearing together or defeating the excerpt history.

Loop measures each imported item's width, height and video duration in small background batches and saves those measurements in `playlist.json`. Starting projection uses whatever has already been measured and never waits for a full-library scan. A large library therefore has a one-time background preparation cost, while later launches and projection starts reuse the cache.

**Optimise large videos** lists library copies of 750 MB or more. When run, it processes them one at a time with macOS AVFoundation, producing fast-start 1080p playback files. A replacement is used only when it is at least 10% smaller. The copied source inside the Loop library is then removed; the original file that was selected during import is never changed. Run this before the event rather than during projection.

Loop also checks the public Photobooth gallery every 12 seconds. Newly uploaded booth photographs are validated, cached locally and put at the front of the playback scheduler once, so an online, actively playing show normally displays each new booth photo well within five minutes. That first appearance lasts twice as long as the tile's usual photo timing, without pausing or rescheduling the other tiles. Afterward it returns to the fair shuffled rotation with the rest of the library at the normal duration. Loop downloads no more than four new photographs per check and retains the most recent 120. Loss of internet never stops playback; cached booth photographs remain available and the control screen reports the feed as offline. Photo changes use an 0.8-second crossfade while the outgoing photo remains visible.

Loop keeps a rotating diagnostic log at `~/Movies/Party Appliances/Diagnostics/Loop.log`. It records run boundaries, playback heartbeats, five-minute memory snapshots, skipped media, renderer hangs and crashes. Once the log reaches 5 MB, the previous run history is retained as `Loop.log.previous`. This makes a long-run failure inspectable after Loop is reopened or force-quit.

Supported import extensions: JPG/JPEG, PNG, WebP, AVIF, MP4, MOV, M4V, WebM. HEIC, Live Photo pairs and RAW files need exporting/converting first. The playback check verifies that a file can begin decoding, not that every frame is intact. Rehearse the actual full sequence. Output skips media that fails or stalls; an entirely unplayable playlist stops with an error on the controller.

## Photo metadata and places in Loop

The optional caption shows place and capture month/year in single-item and grid playback. Camera metadata is used privately to decide whether a capture date is trustworthy but the camera name is not displayed. Recognised scanner hardware (including Fuji SP500) and scanning software suppress all automatic captions; scan dates are not capture dates. Detection is heuristic, and cannot identify untagged scans or photographs of prints. The date is used only when a camera model is also present; it remains the camera's recorded clock value, not a verified historical date. File creation, modification and export timestamps are never substituted. Missing fields disappear. Metadata parsing is best effort for photos, especially JPEG EXIF; movie metadata is not currently extracted.

Choose **Find place names** while online. Loop uses the Mac's native Apple geocoder to turn embedded GPS into a town/area and country, saves each successful result and reuses it offline. Only the photo coordinates go to the service; neither the image nor the Mac's current location is sent by the app. Locations within the same three-decimal coordinate cell share a cached result (roughly 100m north/south), so names are approximate. Unknown places remain blank, with no coordinate fallback. The service may be unavailable or rate-limited; progress and Stop are available, completed results remain saved, and unresolved items can be retried. No lookup runs automatically during projection.

Choose the lower-left or lower-right corner, turn the readout off, or hide locations separately. Existing library photos are scanned for metadata once on startup. Place names live in the playlist and `places.json` in the Loop library, so they survive restart and copying the whole library. Clearing imported media from the sequence does not erase the cache.

## First run: Photobooth

1. For the Canon RP, install `gphoto2` (`brew install gphoto2`), connect the camera directly by a USB-C data cable, insert an SD card, switch it on, and close EOS Utility and Photos. Photobooth detects the RP and uses its own live-view previews.
   Photobooth automatically closes Photos, Image Capture, EOS Utility and macOS camera-transfer services when they belong to the current user, then retries the Canon connection. macOS does not allow Photobooth to terminate another logged-in user's processes. If fast user switching has left another session active, Photobooth identifies that user and asks for a complete logout; merely switching back leaves their camera service running.
2. Select **Check connection**, then **Connect Canon RP**. Photobooth uses the RP's real shutter and a medium 4160 × 2768 JPEG. This remains large enough for prints while transferring and grading much faster.
3. Choose Warm film, Soft neutral, camera colour or black and white.
4. Set the lighting and framing. Enter guest mode. Guests tap the live picture or the large capture button; the button becomes **Cancel** during the countdown.
5. After a two-second countdown, Photobooth makes one photo. It saves automatically and appears for three and a half seconds before the booth returns to live view. **Take another** returns immediately. There is no gallery of previous guests on the guest screen. In guest mode the RP remains awake for two minutes between groups; outside guest mode it rests after 30 seconds.
6. Use **Open captures folder** to find `~/Movies/Party Appliances/Booth captures/YYYY-MM-DD/`. Back it up to another drive after the event.

When a Canon RP is connected, photos use its real still shutter and flash synchronization. Photobooth selects Canon's medium JPEG, leaves the camera copy on its SD card, keeps it as `original.jpg`, and writes the treatment as `print.jpg`. Live view uses aperture priority at f/4 with Auto ISO, giving people more depth of field while following ambient light without inheriting the flash exposure. Stills use ISO 400, 1/80 s and f/5.6 while E-TTL handles flash output. The slower shutter admits one more stop of ambient light than the earlier 1/160 s setting, lifting the room behind the flash-lit subject without increasing flash brightness. The full source aspect ratio is preserved and all views remain unmirrored.

The host screen reports the Canon battery percentage whenever live view starts or restarts. It also queries the Epson TM-T20III roll-paper sensor once a minute and distinguishes adequate paper, near-end and paper-out. The printer's adjustable near-end sensor is reliable only when the printer is horizontal. An optional iMessage destination can be entered on the host screen as an individual phone number, Apple ID email or `group:` followed by an exact Messages conversation title. Named groups must match exactly and uniquely. Photobooth sends one warning per low-battery, paper-low, paper-out or possible missed-flash episode and clears the warning after the supply recovers. Use **Send test alert** during setup so macOS can request Messages automation permission before guests arrive. When Canon's EXIF explicitly reports that the flash did not fire, Photobooth measures that first JPEG and immediately makes one background fallback exposure at 1/60 s and f/2.8, choosing ISO 100–6400 for the available light. It adds no second countdown, wait or autofocus pass. It saves and shows the fallback, warns the host, then returns to the normal flash-first setup for the next guest. If the fallback itself fails, the first photo is kept. The Speedlite does not expose its AA level through the RP, so spare charged AA sets remain necessary.

If a save fails, the app keeps that capture in memory and shows **Retry save**. It does not show “Saved” until the files are written successfully. Keep the app open, free disk space and retry. A forced quit or power loss can lose a recording or a capture that has not yet finished saving.

## Optional photo collection and receipt QR codes

The local queue, authenticated uploader, R2-backed guest page, whole-party gallery, one guest-facing photo download, bulk ZIP download, QR receipt artwork and retry behaviour are implemented. An optional Vercel proxy can supply a friendly custom address while the Worker serves the pages and R2 stores the media.

When cloud sharing is configured, the public gallery might use an address such as `https://photos.example.com`. Photobooth uploads treated photographs and thumbnails in the background, keeps originals locally, and retries interrupted work. The host sync list can delete a capture: Photobooth removes its cloud copy first, then moves its local folder to the Mac Trash. Website administration is available at `https://photos.example.com/admin` using the locally stored passcode.

1. In `cloud/`, copy `wrangler.toml.example` to `wrangler.toml`, run `npx wrangler login`, then create the `party-photos` R2 bucket.
2. Set a long random `UPLOAD_TOKEN` with `npx wrangler secret put UPLOAD_TOKEN`, then run `npm run deploy`.
3. Deploy `gallery/` to Vercel, set `FRAME_GALLERY_BACKEND` to the Worker origin and attach the desired custom domain.
4. Create `~/Library/Application Support/Frame/delivery.json` with the Worker URL as `endpoint`, `https://photos.example.com` as `publicUrl`, the same token, event slug `alex-sam-party`, and `printReceipts: false` until the printer is physically tested.
5. Make a test capture and open its phone page over mobile data. Then connect the Epson, confirm its USB product ID and paper width, print the preview, test reconnect/out-of-paper behaviour, and finally enable receipts.

Every capture is written to the Mac before it enters the persistent delivery queue. Network failures retry with backoff and never block the booth. A permanent random URL is assigned immediately, so the receipt can print while upload continues. Until the capture arrives, that URL shows an **Uploading** panel that updates automatically. Photos upload the finished Portra JPEG plus a 720-pixel thumbnail; the camera original and unexpected RAW files stay local. Guests see one **Download photo** action, and the gallery can stream every finished photograph as a ZIP without loading the full files into the page. The event gallery is public to anyone who has its event URL.

## Development

```sh
npm ci
npm run build:native
npm run loop
npm run booth
npm test
npm run test:app
npm run package
```

The app tests use a synthetic camera and a separate temporary library. They do not photograph you or modify your real playlist/captures. Package output is in `dist`; source is in `src`. No code from previous projects was used.

### Photobooth colour

Warm film is the new-session default and is one of two original 17×17 `.cube` LUTs shipped with Photobooth. The saved JPEG uses a GPU path with a CPU fallback, while live view reuses the same LUT at preview resolution. Warm film adds restrained monochrome grain; Soft neutral uses less grain and a gentler neutral curve. No face reshaping, skin blur or fake damage is applied. Camera originals remain untouched; Loop never grades existing pictures.

Photobooth automatically connects to the RP on startup and retries after disconnection. Reconnect camera and Pause camera remain host controls. Capture is disabled until fresh preview frames arrive. If a waking camera temporarily reports that its configuration tree is unavailable, live-view setup retries quietly over roughly five seconds before the normal reconnect loop takes over. These recoveries are recorded in diagnostics instead of exposing gPhoto's raw error to guests. The Camera diagnostics panel keeps the latest 30 connection events. Battery readings show their check time, warn at 20% or below, and refresh at preview startup/restart; unavailable readings are explicitly labelled.
