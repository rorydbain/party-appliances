# Party Appliances

Two local-first Mac applications for parties:

- **Loop** plays a changing grid of photos and short excerpts from videos on a
  projector or second display.
- **Photobooth** controls a Canon EOS RP, applies a built-in colour treatment,
  saves every photograph locally, and can optionally print QR receipts and
  upload finished photographs to a guest gallery.

The applications are deliberately plain party tools rather than wedding-theme
templates. They were developed for one real event and retain that opinionated
shape. Forks can change the interface, colour and hardware profiles.

## Current support

- Apple-silicon Mac running macOS 13 or later
- Canon EOS RP with USB tethering for Photobooth
- Epson TM-T20III over USB for optional receipts
- Projector, television or second display for Loop
- Optional iPad using Sidecar for the Photobooth guest screen

Loop runs without the camera, printer or an internet connection. Photobooth
saves locally without the printer or cloud service. Other Canon cameras may
work through `gphoto2`, but only the EOS RP workflow is currently supported and
tested.

## Quick start from source

Install Node.js 20 or later. Photobooth also needs Homebrew `gphoto2`:

```sh
brew install gphoto2
npm ci
npm run build:native
npm run package
```

The packaging command creates and installs separate `Loop.app` and
`Photobooth.app` applications. These development builds are ad-hoc signed and
are not notarised. If macOS blocks a copied build, use the app-specific **Open
Anyway** control in Privacy & Security; do not disable Gatekeeper.

For development:

```sh
npm run loop
npm run booth
npm test
```

The normal unit tests do not open application windows or use the real camera.
`npm run test:app` is an explicit interactive smoke test.

## Configure an event

Both apps read one shared event profile from:

```text
~/Library/Application Support/Party Appliances/event.json
```

Copy [`config/event.example.json`](config/event.example.json) there and edit the
names, venue and URLs. With no profile, the apps use generic local-only defaults
and Loop does not contact a live photo feed.

Photobooth's upload token and print switch remain in its private delivery file:

```text
~/Library/Application Support/Frame/delivery.json
```

Copy [`config/delivery.example.json`](config/delivery.example.json) to that
location only when cloud delivery or receipts are wanted. The legacy `Frame`
directory is retained so existing Photobooth installations keep their queues,
preferences and printer environment.

Photobooth includes two original, redistributable LUTs: **Warm film** and
**Soft neutral**. Camera colour and black and white are also available. The
commercial preset used while developing the original event build is not part of
this repository.

## Hardware

The exact tested build is documented in [Hardware](docs/HARDWARE.md). It uses a
Canon RP, RF 28mm F2.8 STM, one Canon 430EX II on the hot shoe, an iPad over
Sidecar and an optional Epson TM-T20III. The cardboard enclosure drawings are
included as a case study; the software does not require that enclosure.

## Optional sharing and receipts

- [Cloud gallery setup](docs/CLOUD.md)
- [Receipt printer setup](docs/PRINTER.md)
- [Party-day checklist](docs/EVENT-CHECKLIST.md)
- [Loop guide](docs/LOOP.md)
- [Photobooth guide](docs/PHOTOBOOTH.md)
- [Development and architecture](docs/DEVELOPMENT.md)

The gallery uses a Cloudflare Worker and R2 bucket. A small optional Vercel proxy
can attach a friendly custom domain. No gallery or Vercel account is needed for
local capture and playback.

## Data locations

Photographs, the Loop library and diagnostics stay under:

```text
~/Movies/Party Appliances/
```

Back up `Booth captures` after an event. Uploading never removes the local
camera original.

## Status

This is an early public-source beta. Before relying on it at an event, rehearse
the complete setup on the actual Macs, camera, flash, display, printer and
network. See [the publishing and release checklist](docs/PUBLISHING-PLAN.md).

Party Appliances is available under the [MIT licence](LICENSE). Bundled asset
notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
