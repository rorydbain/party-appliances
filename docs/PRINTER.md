# Epson receipt printing

Printing is optional and currently supports the Epson TM-T20III USB profile.
Photobooth prints from the local treated JPEG, so it does not wait for upload.
The QR URL is assigned before upload and shows an automatically refreshing
waiting page until the photograph reaches the gallery.

## Install the helper

```sh
python3 -m venv "$HOME/Library/Application Support/Frame/printer-venv"
"$HOME/Library/Application Support/Frame/printer-venv/bin/pip" install -r requirements-printer.txt
```

Connect and power the printer, load an 80 mm roll, then use **Reprint a receipt**
in Photobooth to test an existing local capture. Receipt title and venue come
from the shared event profile.

Photobooth checks printer presence before starting. A job interrupted after
printing begins is marked as needing attention instead of retrying automatically,
because an automatic retry could make a duplicate after a paper jam or restart.

Thermal receipts fade with heat, sunlight, plasticisers, oils and abrasion. They
are keepsakes rather than archival photographs. Store them cool, dark and flat;
the downloadable gallery image is the durable copy.
