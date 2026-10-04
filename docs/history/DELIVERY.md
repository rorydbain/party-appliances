# Photo delivery and receipt printing

Photobooth has the complete local side of photo delivery and a small Cloudflare Worker for the public side. It remains local-first: the photograph and its treatment are committed to disk before an upload or print is attempted.

## Guest experience

1. Frame takes and saves the photograph locally.
2. Photobooth assigns a 128-bit random token and permanent `photos.example.com/?photo=…` address before starting any network work.
3. The Epson can print the treated photograph and QR while the upload queue sends the Portra-treated `print.jpg` and a small `thumb.jpg` to Cloudflare R2. The untouched camera file stays on the Mac.
4. Opening the QR during upload shows an **Uploading** panel which refreshes automatically.
5. Once ready, the same page places that capture first and offers one **Download photo** action. The gallery grid uses thumbnails and offers a streamed **Download all** ZIP.

## Failure behaviour

- Loss of Wi-Fi never blocks another guest. Jobs remain in `Delivery queue/.delivery-queue.json` beside the capture directory and retry with increasing delays.
- Uploads use the same random capture token on every attempt, so retrying replaces the same remote objects instead of making duplicates.
- The R2 `capture.json` marker is written last. The gallery only lists that marker, so a connection loss between the two JPEG uploads cannot expose a half-finished capture.
- Photobooth's host view lists the ten most recent captures with **Waiting**, **Uploading**, **Online**, receipt and error states. Failed work has a manual **Retry** control; the permanent guest URL never changes.
- Queue history pruning removes completed history first and never discards unfinished uploads or receipts, even when more than 500 jobs exist.
- The printer is checked before a print is attempted. An absent printer leaves the receipt pending.
- A print that starts and then errors is marked **needs attention** and is not retried automatically. This follows the useful rule in Leonore's `receipt` app: automatic retries after a paper jam can create duplicate or half-duplicate slips.
- Photobooth persists **Printing** before sending bytes to the Epson. If the Mac or app stops during that interval, restart marks the receipt **needs attention** so the host can check the paper before choosing Retry; it will not risk an automatic duplicate.
- Local captures are never removed after upload.

## Cloudflare R2 setup

The service is in `cloud/`. It uses one R2 bucket and a Worker; guests never see bucket credentials or raw bucket URLs.

1. Create an R2 bucket, initially named `party-photos`.
2. Copy `cloud/wrangler.toml.example` to `cloud/wrangler.toml` and change the bucket name if required.
3. From `cloud/`, install dependencies and authenticate Wrangler.
4. Create a long random upload token and store it as the Worker secret `UPLOAD_TOKEN`.
5. Deploy the Worker and note its generated `workers.dev` origin.
6. Deploy `gallery/` to Vercel with `FRAME_GALLERY_BACKEND` set to that Worker origin, then attach the desired custom domain.
7. Copy `config/delivery.example.json` to `~/Library/Application Support/Frame/delivery.json`. Put the Worker origin in `endpoint`, the public Vercel address in `publicUrl`, and use the same token and event slug.
8. Restart Photobooth. Existing locally queued captures upload as well as new ones.

The event defaults are prepared as `Alex + Sam`, `Example venue / London`, with the URL slug `alex-sam-party`. Photobooth captures JPEG only. The camera JPEG and any older RAW files remain local; only the finished Portra JPEG and its thumbnail are shared.

The upload endpoint accepts only the known booth filenames, caps each object at 40 MB, and requires the secret bearer token. Public capture URLs use 128-bit random tokens. The event gallery is intentionally public to anyone with its URL; individual QR links do not make the gallery private.

## Epson setup

The printer path follows the working implementation in `leonore/receipt`:

- USB vendor `04b8`, product `0e28`
- `python-escpos` over the wired USB connection
- 512-dot printable width
- Atkinson dithering for photographs
- Check USB before taking a job
- Close the USB handle after every slip

Install the printer environment on the booth Mac:

```sh
python3 -m venv "$HOME/Library/Application Support/Frame/printer-venv"
"$HOME/Library/Application Support/Frame/printer-venv/bin/pip" install -r requirements-printer.txt
```

The connected TM-T20III has been detected over USB and has completed a photograph, native QR and cut test. These remain rehearsal items:

- Test Atkinson against Floyd-Steinberg on real paper and tune face contrast.
- Confirm cutting, cover-open, paper-out, macOS USB ownership and recovery after reconnect.
- Print 20 sequential test receipts and measure time, heat and paper use.

## Receipt design

The receipt deliberately avoids decorative wedding language. It contains the treated portrait, a restrained `ALEX + SAM` and `EXAMPLE VENUE / LONDON` title, then the QR code. The QR is printed with the Epson's native QR command for sharp edges; the preview script renders the same content to a PNG when no printer is attached.
# Removing captures

The host can remove a capture from Frame's sync list. Frame records the deletion before attempting it, deletes the cloud objects with the capture's existing private identity, and only then moves the local capture folder to the Mac Trash. Interrupted cloud deletions remain queued and can be retried safely. Captures can also be removed from the password-protected `/admin` page; public gallery visitors never see delete controls.
