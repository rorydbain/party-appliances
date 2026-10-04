# Optional Vercel gallery proxy

The Cloudflare Worker in `../cloud` already serves the complete photo gallery.
This small Vercel project is needed only when a friendly domain should proxy to
that Worker.

Set the server-side environment variable `FRAME_GALLERY_BACKEND` to the
Worker's HTTPS origin, deploy this directory, and attach the desired domain in
Vercel. The proxy forwards public pages, media range requests, uploads and admin
deletions. It contains no analytics integration and has no browser assets or
secrets.

Cloudflare upload and admin secrets remain in Cloudflare and the local
Photobooth delivery configuration. Do not add them to Vercel client variables.
