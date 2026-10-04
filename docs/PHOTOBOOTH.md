# Photobooth

Photobooth is a local-first tethered still-photo application for the Canon EOS
RP. The production interface intentionally supports photographs only.

## Start with local capture

The core app needs only the camera and `gphoto2`. Run:

```sh
./scripts/setup-macos.sh --booth-only
```

No event profile or delivery file is required. In this mode every photograph
is saved locally, the host can review and delete recent captures, and cloud,
printer and receipt controls remain hidden. This is the intended starting
point, rather than a degraded version of the full setup.

## Capture flow

Install `gphoto2`, connect a powered RP containing an SD card, and close EOS
Utility, Photos and Image Capture. Photobooth connects automatically, configures
medium JPEG capture and begins live view. If another logged-in macOS user owns
the camera service, log that user out completely.

Guests tap the live image or capture button. A two-second countdown begins,
focus is acquired before the shutter, and the preview progressively blurs as
live view stops. The flashed still is downloaded, treated, committed to disk and
shown briefly. A tap while the camera is resting only wakes it; it does not also
take a photograph.

Every capture keeps `original.jpg`, a treated `print.jpg`, a lightweight
`thumb.jpg` and `capture.json`. Capture folders live under
`~/Movies/Party Appliances/Booth captures/`. The SD-card JPEG is retained too.

The host can choose Camera colour, Warm film, Soft neutral or Black and white.
Warm film and Soft neutral use the original LUTs shipped in `src/luts/`. Existing
preferences named `portra` migrate to Warm film.

## Reliability

The camera rests after inactivity to save power and reconnects after USB
interruptions. The host screen reports recent connection diagnostics and Canon
battery state. The Speedlite does not expose AA charge through the camera, so
keep a charged spare set and watch its pilot light.

If EXIF explicitly reports that the flash did not fire, Photobooth immediately
makes one ambient-light fallback without another countdown or focus pass. The
next guest returns to the normal flash-first settings.

Captures are written locally before printing or upload. A save failure retains
the in-memory photograph and offers **Retry save**. Do not force-quit during
that state.

## Optional services

Each service can be left out. Cloud sharing and Loop are independent: enabling
one does not require the other. QR receipts currently use the permanent gallery
URL, so receipt printing is enabled as part of a configured gallery setup.

The delivery queue retries cloud uploads with backoff and gives each photo a
stable QR URL before upload begins. Printing uses the local treated photograph
and therefore does not wait for the network. **Reprint a receipt** browses all
locally available queued photographs.

The host may configure an iMessage destination for camera-battery, paper and
possible missed-flash warnings. Test macOS Messages automation permission before
the event.

See [Hardware](HARDWARE.md), [Cloud](CLOUD.md), [Printer](PRINTER.md) and the
[event checklist](EVENT-CHECKLIST.md).
