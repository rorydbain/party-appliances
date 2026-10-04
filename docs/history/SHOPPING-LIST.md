# Compact portrait booth: specific shopping list

> Updated: Canon RP, two 430EX IIs and a 28mm f/2.8 lens have been ordered. The actual box is 47 × 36 × 22.5cm. See [the current RP box plan and diagrams](RP-BOX.md); it supersedes the camera, power and size assumptions below.

Prices checked 6 September 2026, in GBP, excluding delivery. Used stock changes. This is a proposed hardware build, not a physically tested system. It supersedes the earlier Sony/HDMI/external-softbox shopping direction.

## Recommended parts

| Part | Current price / allowance | Why this one |
|---|---:|---|
| [Canon EOS M50 body, used — MPB](https://www.mpb.com/en-uk/product/canon-eos-m50) | £324–349 | Compact 24.1MP camera; remote capture and live view listed as supported by libgphoto2. |
| [Canon EF-M 15–45mm IS STM — MPB](https://www.mpb.com/en-uk/product/canon-ef-m-15-45mm-f-3-5-6-3-is-stm) | Allow £44 | Small adjustable lens; useful for setting framing to the available space. Listings span £19–44; inspect condition. Buy EF-M, not EF-S or RF. |
| [Canon Speedlite 430EX II, Excellent — MPB](https://www.mpb.com/en-uk/product/canon-speedlite-430ex-ii/excellent) | £44 | Compact flash with manual power and an adjustable head, mounted inside the light chamber. Current SKU 3930857. |
| [JJC FC-E3 Canon off-camera cord — UK Camera Equipment](https://ukcameraequipment.co.uk/product/viltrox-oc-e3-ttl-off-camera-flash-hot-shoe-sync-cord-cable-for-canon-uk-seller/) | £23.99 | Connects camera hot shoe to the flash inside the same box; no radio trigger needed. The product title is JJC FC-E3 despite the older Viltrox URL. |
| [Waveshare 10.1-inch IPS HDMI display — The Pi Hut](https://thepihut.com/products/10-1inch-capacitive-touch-display) | £72 | Model 10.1DP-CAPLCD, SKU WAV-23739; 1280×800, approximately 239×147mm front panel. Treat as an HDMI display: Mac touch support is unverified. |
| [amaran Ace 25x Charcoal — Thomann](https://www.thomann.co.uk/amaran_ace_25x_charcoal.htm) | £60 | Small continuous light for framing and secondary films. Approximately 118×77×33mm; standard unit is sufficient, no tripod kit needed. |
| [LEE 216 White Diffusion, 61×53cm half sheet](https://leefiltersdirect.com/products/216-white-diffusion?variant=42276770218164) | £4 | Cut to the booth's broad front lighting window. Requires a reflective chamber to distribute the flash across it. |
| **Listed parts** | **£571.99–596.99** | Lens budgeted at £44. |

An alternative [eBay listing for the JJC FC-E3 cord](https://www.ebay.co.uk/itm/266972870733) was found, but its current price was not readable. Compare delivery and seller terms. [Wex also listed a used Canon 430EX II at £43](https://www.wexphotovideo.com/canon-speedlite-430ex-ii-flashgun-used-3345900/).

## Remaining budget

Reserve roughly £150–200 for camera mains power, rechargeable flash batteries and charger, display/light power supplies, SD card, USB data cable, any Mac HDMI adapter and a capture button. This is an allowance, not a priced basket. Start testing with an existing keyboard's Space key.

For the M50, the Canon mains combination is **CA-PS700 plus DR-E12**, also sold as an ACK-E12 kit. Both pieces are required; the adapter alone is insufficient. [Canon's compatibility page](https://www.canon.co.uk/store/canon-ca-ps700-compact-power-adapter/7875A009/). Use a USB micro-B data cable for the camera. For the flash, budget eight Panasonic Eneloop AA cells and a suitable charger: four in use, four spare. Flash power remains battery-based; the proposed single mains lead supplies the other equipment.

Allow £80–120 for a lightweight rigid frame/case, equipment mounts, handles, protective front cover, partitions and cable retention; retain about £50 contingency. The whole booth therefore targets approximately **£850–970 excluding the Mac**, depending on power accessories and construction. These allowances need pricing before a final order.

## Fit and lighting

Keep the existing provisional 50cm high × 40cm wide × 28cm deep target. Arrange the diffused flash above the lens, the guest display below, and the small LED alongside the display. The actual Mac and mounting clearances must be measured before producing a cut list. A custom light frame with a cardboard exterior gives more control over size than choosing a heavy flightcase first.

The broad diffusion window should be evenly illuminated; one bright spot behind a large sheet will still behave like a small light. Prototype a white reflective chamber and shield the lens from internal spill. Provide ventilation and manufacturer-required clearance around the flash and LED, with equipment supported by the rigid frame. Keep the LED's cooling vents exposed. Confirm its sustained plugged-in operation and temperature during rehearsal rather than relying on its battery runtime for the whole event.

Start with one or two people around 1–1.3m away, then set zoom and exposure using actual portraits. The intended look is a consistent, softly frontal portrait with restrained colour. The light chamber, exposure and subject placement matter more here than adding an expensive lens.

## First purchase and validation

Buy or borrow the first four parts together: **approximately £436–461**. Use a seller with suitable return terms, and inspect those terms before ordering. Test with the intended Mac during that window.

[libgphoto2 lists the M50 as supporting image capture, trigger capture, live view and configuration](https://gphoto.sourceforge.io/proj/libgphoto2/support.php). That establishes a plausible integration route, not proof of our complete workflow. Test live view → autofocus/countdown → real shutter with flash → full-resolution download → review → return to preview, including repeated use and reconnect recovery.

**Frame currently saves photographs from a video feed. The tethered still-camera backend and flash workflow have not yet been implemented or tested.** This list is for that next photo-first version. Keep secondary video as a separate validation step: simultaneous USB webcam and tethered camera control must not be assumed. Defer the enclosure order until the capture sequence and light chamber work with measured parts.
