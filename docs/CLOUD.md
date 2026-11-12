# Optional cloud gallery

Cloud delivery is optional. Photobooth always commits a capture locally before
adding it to the upload queue, and network failure never blocks another photo.

The supplied service uses a Cloudflare Worker and private R2 bucket. The Worker
serves the gallery as well as accepting authenticated uploads. `gallery/` is an
optional Vercel proxy for attaching a friendly custom domain.

## Cloudflare

1. Create a Cloudflare account and an R2 bucket.
2. Copy `cloud/wrangler.toml.example` to a local Wrangler configuration and set
   its bucket, event name, venue, timezone, event slug and public origin.
3. In `cloud/`, run `npm ci` and authenticate with `npx wrangler login`.
4. Store a long random upload secret with
   `npx wrangler secret put UPLOAD_TOKEN`.
5. To let guests add photos without accounts, store a shared
   `GUEST_UPLOAD_PASSWORD`. The upload page keeps it only in session storage.
6. For website deletion, also store independent `ADMIN_PASSWORD` and
   `ADMIN_SECRET` values.
7. Set `SHARED_ALBUM_URL` if the gallery should link to an iCloud Shared Album.
8. Deploy with `npm run deploy` and record the Worker HTTPS origin.

Do not put any of those secrets in JSON examples, app bundles or Git history.

## Friendly domain with Vercel

Deploy `gallery/` to Vercel, set `FRAME_GALLERY_BACKEND` to the Worker origin,
and attach the desired domain. This proxy is optional; the Worker origin can be
used directly as both the public gallery and upload endpoint.

## Desktop configuration

Copy `config/event.example.json` to the shared event profile described in the
README. Copy `config/delivery.example.json` to Photobooth's private application
support directory, then set:

- `endpoint`: Worker origin used for authenticated uploads;
- `publicUrl`: guest-facing Worker or Vercel origin;
- `token`: the same `UPLOAD_TOKEN` stored in Cloudflare;
- `event`: the matching event slug;
- `printReceipts`: whether new photos should automatically print a receipt.

Restart Photobooth after changing these files. Test a photo URL over mobile data
before relying on the service at an event.

Finished treated JPEGs and 720-pixel thumbnails upload. Camera originals remain
on the Mac. The event gallery is public to anyone with its URL.

## Adding photographs after the event

`/upload` accepts JPG, PNG, WebP, HEIC and HEIF photographs. The browser prepares
a full-size JPEG and a lightweight gallery thumbnail, then sends up to three
photos at once directly to the Worker. Each file has an independent status and
retry button, so a large batch can recover from an interrupted connection.

Choose **Disposable cameras** before selecting a scan batch, or **Friends and
family** for ordinary guest contributions. These categories become filters on
the gallery homepage. Guest uploads also appear in Loop's photo feed.
