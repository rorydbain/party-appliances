#!/usr/bin/env python3
"""Render or print a Photobooth photo slip for the Epson ESC/POS printer."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import qrcode

VENDOR_ID = 0x04B8
PRODUCT_ID = 0x0E28
WIDTH = 512
DEFAULT_TITLE = "YOUR EVENT"
DEFAULT_VENUE = ""

def font(size):
    for candidate in ("/System/Library/Fonts/SFNSMono.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"):
        try: return ImageFont.truetype(candidate, size)
        except OSError: pass
    return ImageFont.load_default()

def atkinson(image):
    gray = ImageOps.autocontrast(image.convert("L"))
    # Thermal paper closes up dark mid-tones. Lift them before diffusion so
    # faces retain shape instead of becoming one dense black area.
    gray = gray.point(lambda value: round(255 * ((value / 255) ** 0.68)))
    w, h = gray.size
    pixels = [float(v) for v in gray.getdata()]
    out = Image.new("1", (w, h), 1)
    target = out.load()
    for y in range(h):
        for x in range(w):
            i = y * w + x
            old = max(0, min(255, pixels[i])); new = 255 if old >= 128 else 0
            target[x, y] = new; error = (old - new) / 8
            for dx, dy in ((1,0),(2,0),(-1,1),(0,1),(1,1),(0,2)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h: pixels[ny*w+nx] += error
    return out

def photo_bitmap(source):
    with Image.open(source) as opened: image = ImageOps.exif_transpose(opened).convert("RGB")
    image.thumbnail((WIDTH, 380), Image.Resampling.LANCZOS)
    return atkinson(image)

def preview(photo, url, capture_id, title, venue):
    qr = qrcode.make(url).convert("1").resize((190, 190), Image.Resampling.NEAREST)
    canvas = Image.new("1", (WIDTH, photo.height + 282), 1)
    canvas.paste(photo, ((WIDTH-photo.width)//2, 18))
    draw = ImageDraw.Draw(canvas); label = font(16); detail = font(13)
    y = photo.height + 42
    draw.text((WIDTH//2, y), title, font=label, fill=0, anchor="mm")
    venue_offset = 24 if venue else 0
    if venue: draw.text((WIDTH//2, y+venue_offset), venue, font=detail, fill=0, anchor="mm")
    canvas.paste(qr, ((WIDTH-190)//2, y+venue_offset+20))
    return canvas

def send(photo, url, capture_id, title, venue):
    from escpos.printer import Usb
    # The TM-T20III uses the same 203 dpi, 576-pixel paper geometry as the
    # bundled TM-T20II capability profile. This also makes centre alignment
    # deterministic instead of falling back to an unspecified generic width.
    printer = Usb(VENDOR_ID, PRODUCT_ID, profile="TM-T20II")
    try:
        printer.set(align="center")
        printer.image(photo)
        printer.set(width=2, height=2)
        printer.text(f"\n{title}\n")
        printer.set(width=1, height=1)
        if venue: printer.text(f"{venue}\n")
        printer.qr(url, size=7)
        printer.text("\n")
        printer.cut(feed=False)
    finally: printer.close()

def status():
    from escpos.printer import Usb
    printer = Usb(VENDOR_ID, PRODUCT_ID, profile="TM-T20II")
    try:
        value = printer.paper_status()
        state = "adequate" if value == 2 else "near-end" if value == 1 else "out"
        print(json.dumps({"paper": state}))
    finally: printer.close()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image"); parser.add_argument("--url")
    parser.add_argument("--capture-id"); parser.add_argument("--print", action="store_true", dest="do_print")
    parser.add_argument("--title", default=DEFAULT_TITLE); parser.add_argument("--venue", default=DEFAULT_VENUE)
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--preview")
    args = parser.parse_args()
    if args.status:
        status(); return
    if not args.image or not args.url or not args.capture_id:
        parser.error("--image, --url and --capture-id are required unless --status is used")
    photo = photo_bitmap(args.image)
    if args.preview:
        preview(photo, args.url, args.capture_id, args.title, args.venue).save(args.preview); print(args.preview)
    if args.do_print: send(photo, args.url, args.capture_id, args.title, args.venue); print("printed")
    if not args.preview and not args.do_print:
        target = str(Path(args.image).with_name("receipt-preview.png")); preview(photo, args.url, args.capture_id, args.title, args.venue).save(target); print(target)

if __name__ == "__main__": main()
