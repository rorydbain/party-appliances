# Implementation notes

Updated 12 September 2026: physical Canon EOS RP preview, medium-JPEG capture and automatic preview recovery verified.

## Structure

Two separately packaged Mac Electron apps share a small codebase. Each package carries an `appliance.json` selecting Loop or Frame. The development launcher also offers both modes. Electron 44.2.0, plain HTML/CSS/JavaScript, no UI framework and no remote application service.

- `src/main.cjs`: native windows, display selection, media permissions, app-local protocol, native file picker, IPC, persistence and sleep prevention.
- `src/core.cjs`: media import/library manifest, constrained settings, atomic writes and capture saving.
- `src/preload.cjs`: small allowlisted interface across the isolated renderer boundary.
- `src/renderer.js`: control desk, playlist preflight and capture state machine.
- `src/output.js`: independent output playback, pause, blackout, timed stills, video-end advance, errors/stall handling.
- `scripts/package.cjs`: builds separate ad-hoc-signed Mac app bundles. ARM64 by default on this build machine; `PARTY_ARCH=x64` selects Intel.

The renderer has no Node access and uses Electron sandboxing and context isolation. Navigation and new windows are blocked. HTTP(S) and WebSocket traffic from app windows is blocked. Local media is served through an allowlisted custom streaming protocol, not arbitrary filesystem URLs supplied by page content. The projection renderer cannot invoke controller-only operations. Native camera/microphone permission is requested only when connecting user-selected inputs, and microphone permission only when sound is opted into.

## Persistence and recovery

Imported projection media is copied into an owned library before it is added to the saved manifest. Playlist writes are serialized and use a temporary file plus rename. Importing the same source twice is allowed. Removing a playlist item does not delete the original or the imported media file. Orphaned media after a failed import/manifest write is harmless but not garbage-collected in the MVP.

Booth captures are written to a per-capture temporary directory. Each photo/video and metadata file is written and synced, then the completed directory is renamed into place. Successful saves get unique timestamp/UUID names. The app reports success only after completion. A save exception retains the renderer’s capture buffers for retry. Save buffers are memory-resident: power loss or forced termination before completion can lose the current capture. There is no battery-independent guarantee and no cloud backup. Old incomplete directories after power loss are not automatically recovered.

The library and booth use the current user’s Movies folder under Party Appliances. Preferences live in Electron’s app-specific user-data folder. The capture date folders use UTC. There is no multi-computer synchronization. Copy completed folders through Finder to back them up. A single-instance lock brings the existing appliance forward if it is opened again. Use one instance of each appliance per Mac.

## Media behaviour

Frame has two camera paths. `src/canon.cjs` uses an explicitly located Homebrew `gphoto2` binary to detect the EOS RP, disable idle Continuous AF, select medium JPEG-only capture to the memory card, request serialized JPEG live-view previews, trigger a native still exposure, download the JPEG, and keep the camera's SD-card copy. Unexpected RAW sidecars from a stale camera setting are discarded. Temporary transfer directories are removed after their bytes are in memory. Canon operations are serialized so preview and shutter commands cannot contend for USB ownership. The renderer retains the downloaded JPEG as `original.jpg` and produces `print.jpg`. If no RP is connected, stills can fall back to the selected video input.

RP live preview uses one long-running `gphoto2 --capture-movie --stdout` process and parses its concatenated JPEG stream, capped at 25 displayed frames per second. Live view and ten-second films use an ambient state of 1/50 s, f/2.8, ISO 1600 and AWB White; films record the canvas-fed RP stream through MediaRecorder and add the chosen Mac microphone when sound is enabled. For photographs, the stream stops when the countdown reaches one. The app samples the centre of recent preview frames and chooses a bounded ISO of 200, 400 or 800; shutter remains 1/160 s, aperture f/5.6 and white balance Flash. It then holds half-press autofocus and fires with a full manual release at zero, avoiding a second focus cycle. Canon E-TTL provides the fine flash exposure. The camera uses medium JPEG (4160 × 2768 in the physical test) to reduce USB and grading time. The preview fades before focus; an animated processing cue remains until the Portra result is ready, and a five-second review returns to live view. Preview startup and shutdown are serialized, with an idle watchdog that retries a disconnected or stale stream every three seconds, after a five-second stale threshold. Deliberate camera shutdown disables recovery. Microphone recording defaults on; the selected microphone is reacquired before films if needed. The actual photograph comes from the sensor capture. The legacy browser camera path remains only in the automated simulator; the production interface treats the RP as its sole picture source. EOS Utility or Photos must not own the camera at the same time. The current install relies on `/opt/homebrew/bin/gphoto2` or `/usr/local/bin/gphoto2`; another booth Mac needs its own Homebrew installation.

Loop decodes images and videos through Chromium. The file extension picker is not a codec compatibility guarantee. Check playback loads each selected file to its first decoded image/frame with a timeout; a complete rehearsal is still required. Unsupported or stalled output is skipped with a controller error, and an all-invalid playlist stops. Video codecs such as some HEVC variants may require conversion. HEIC and RAW imports are intentionally excluded.

Pause preserves a still’s remaining duration. Blackout covers the output and suspends progression/audio while preserving the prior pause state. A display removal closes the output; the host must reconnect and restart it. The clean output uses a separate full-screen native window. No remote-control network service or inter-Mac link is needed.

## Metadata and place preparation

`exifr` 7.1.3 reads embedded photo EXIF on import and once for old library entries. Camera model plus a valid DateTimeOriginal permits a camera-clock date readout; filesystem timestamps and export/create timestamps are never substitutes. Dates remain wall-clock strings to avoid inventing a timezone. Unsupported/malformed metadata does not reject playable files. Video metadata is currently omitted.

`native/resolve-place.swift` is a small macOS CoreLocation helper compiled for the package architecture and shipped outside ASAR in Resources/bin. It reverse-geocodes the supplied photo coordinate through Apple; it never requests the Mac's location. Lookup is invoked only by the host's Find place names button. The isolated renderers still cannot fetch remote content.

`src/places.cjs` deduplicates GPS positions to three decimal places, serializes requests with at least 1.5 seconds between starts, and stops after three consecutive failures. Each subprocess has a 21-second timeout. Stop completes the current lookup and retains successful results. Only successful town/area-and-country names are cached; failures remain retryable. The playlist stores each resolved name, and places.json permits reuse for newly imported photos. Each update merges into current serialized library state so it cannot revert an intervening reorder or setting change. Cache writes are atomic. Playback reads only saved names and hides missing locations; there is no coordinate fallback or projection-time request.

`src/readout.js` is shared between preview and output; metadata is inserted as text, never HTML. Bottom corner and location visibility persist with playlist settings. Blackout covers both image and readout. Photo load failures and metadata-free videos clear the caption.

## Verification

`npm test` covers durable import independent of originals, serialized imports, persisted playlist ordering, malformed state protection, invalid source handling, capture file grouping, unique naming and rejection of invalid capture paths/buffers.

`npm run test:app` drives real Electron windows using Playwright and Chromium’s synthetic camera/microphone. It exercises photo saving with an original and treatment, a full ten-second film, cancellation, a simulated write failure and retry, an audio-enabled short film, guest mode/Space capture, file decoding, projection, pause, blackout, next and ordering across restart. It writes results and screenshots to `artifacts`. The test library is an isolated temporary directory; no real camera or user media is used.

The final Apple silicon app bundles also passed a separate launch check: correct appliance mode, isolated empty storage and working renderer with the camera left off. Both app signatures passed macOS codesign verification. These checks do not amount to Apple notarization.

The physical EOS RP path was verified over USB: detection, 960 × 640 composition preview, shutter release with the attached flash, SD-card retention, 4160 × 2768 JPEG download, untouched-original preservation, LUT export, metadata, unmirrored review and automatic return to live view all passed. The tested JPEG was 3.16 MB. The camera had to use **Memory card** as its capture target. A second logged-in macOS user had an Image Capture process holding the USB device; logging that user out released it. Microphone, external screen/projector, continuous power, heat, final diffusion and full-night behaviour still need testing on the final rig. Apple notarization, automatic startup after a crash, printing, phone sharing and Pi support remain outside this MVP.

Additional tests cover real EXIF parsing, GPS hemisphere signs, invalid dates, legacy-library migration, place deduplication, concurrent edits during lookup, cached offline reuse, retry/cancellation, readout visibility/position and consistent preview/review orientation. A native service check using a public Edinburgh coordinate returned “Edinburgh, United Kingdom”. This was not a user photograph.

## September 6 appearance revision

Metadata schema v2 suppresses recognised scanner devices/software before trusting camera/date/GPS. Startup migration rereads imported originals, preserving cached place names only when valid coordinates are unchanged. This is heuristic: untagged scans and camera photographs of prints cannot reliably be identified. Captions now use place + month/year and a subordinate camera line, without a rectangular background.

Frame uses the `portra400` SVG filter in index.html for its lightweight live-view approximation. Full-resolution JPEG export uses the local 32³ Portra LUT and a deterministic grain pass. The original Canon JPEG is always retained. This profile is an artistic starting point; it does not recover clipped highlights or reproduce flash lighting in ambient live view.

## September 10 Portra reference

Photobooth ships two original 17³ LUTs under the repository licence: Warm film and Soft neutral. A WebGL2 3D texture applies the selected LUT with trilinear interpolation at camera resolution; a CPU fallback remains for machines without WebGL2. Each look defines its own restrained deterministic grain level. The same LUT renderer is reused for live preview and full-resolution output.

September 2026 reliability update: production Frame connects automatically on opening. An idle watchdog backs off failed retries to at most once every 15 seconds, hides stale previews and only enables capture after decoded frames arrive. Battery telemetry is read from Canon summary at preview startup/restart, labelled with its timestamp, and warns at <=20%; it is not continuous telemetry. A host diagnostics panel records recent connection errors without exposing photo contents.

Portra preview now uses a reusable WebGL2 renderer and the actual local LUT at the RP preview resolution. The shader and LUT texture remain allocated across frames; the raw canvas supplies exposure metering; films record the graded picture with microphone audio. Fixed sampler3D precision and upload orientation state in the GPU export path, and aligned LUT texel coordinates with the CPU trilinear lookup. Preview gracefully falls back to the CSS approximation if GPU rendering fails.
