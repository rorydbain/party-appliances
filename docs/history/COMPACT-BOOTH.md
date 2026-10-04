# Proposed revision: a portable portrait box

> Updated: Canon RP, two 430EX IIs and a 28mm f/2.8 lens have been ordered. The actual box is 47 × 36 × 22.5cm. See [the current RP box plan and diagrams](RP-BOX.md); it supersedes the camera, power and size assumptions below.

The [specific shopping list](SHOPPING-LIST.md) now contains checked UK listings and updated budget allowances. It supersedes the indicative allocation below; physical integration remains untested.

10 September 2026. This proposal incorporates two new priorities: photographs first, films second; and transport from London to Glasgow by train with the booth contained in one box. It supersedes the earlier external-softbox shopping direction. Frame now includes RP USB preview, real shutter capture and JPEG/optional CR3 transfer; the camera has not yet been connected, so physical capture and flash synchronization remain to be tested.

## Current camera constraints

Use a dedicated purchased camera. The user’s X100VI is excluded, including from prototype suggestions. The M50 is the budget candidate; Canon R6 and Sony A7-series alternatives are being evaluated. No higher total budget or final camera choice has been agreed.

## Recommended architecture

Build a compact portrait appliance into a rigid, ventilated case with a removable cardboard exterior if desired. At the venue it sits on a stable table, with one accessible mains lead. No separate light stand, external softbox or backdrop frame is part of the travelling booth. Guests stand or sit in front of it. The projector and projector Mac remain a separate system; this one-box target refers to the booth.

**Packing target:** roughly 50cm high × 40cm wide × 28cm deep, with a provisional total mass of 6–9kg including the booth Mac. These are design allowances, not measured dimensions or a final cut list. Include handles, cover, cable storage and padding within the final transport measurements. The actual Mac model and component layout determine feasibility. A light rigid case or thin plywood structure is preferable to a heavy rack/flightcase or unsupported cardboard.

If travelling with Avanti, its published largest-bag limit is 30 × 70 × 90cm, and passengers must be able to carry their own luggage. The proposed target fits those dimensions, but does not reserve luggage space. [Avanti luggage policy](https://www.avantiwestcoast.co.uk/onboard/luggage).

## The face of the box

Arrange a broad diffusion panel of approximately 30 × 20–25cm in the upper front, the camera lens immediately below, a small 10–13-inch guest display below that, and a large capture button. Keep the illuminated surface a little above lens height. A removable hard cover protects the face during transport and can stow under the case at the venue.

Behind the diffusion panel, use a compact flash and a shallow white reflective chamber to spread its light across the panel. Prevent direct spill into the camera opening with an opaque partition and a black lens surround. The chamber must be prototyped: simply firing a flash through a translucent sheet does not guarantee an evenly illuminated large light source. Use purpose-made lighting diffusion, appropriate flash-head clearances, and accessible ventilation. Do not press a flash head against diffusion or pack it tightly in foam/cardboard during operation. Flash equipment has thermal/duty-cycle limits. [Example compact-flash manual](https://www.godox.com/static/upload/file/20230225/1677307549404629.pdf).

Keep camera, screen, light and Mac attached to an internal frame. Store the disconnected mains lead and optional small mouse/keyboard inside for transport. A removable rear panel permits battery changes and access to power switches. All equipment is off during transport.

## Photograph first

Choose the camera for reliable **USB remote still capture, full-resolution file transfer and flash synchronisation**. After a countdown the program pauses live view if required, commands a real exposure, waits for the file, saves it and displays the result. The flash is synchronised by the camera through a compatible hot-shoe cord or trigger; a JavaScript timer must not attempt to synchronise it independently.

Save the camera JPEG for immediate review and, where supported and useful, its RAW alongside it. Camera colour/picture-style settings give a sensible first look. Bespoke processing can follow once real samples exist. Focus, manual exposure, flash readiness, preview brightness and recovery after disconnect all need proving on the selected model. A dim modelling/preview light can help live view and autofocus while the flash supplies the photo exposure.

A used Canon EOS M50 with its compact EF-M 15–45mm lens is a candidate to investigate, rather than a purchase instruction. Canon specifies 24.1MP stills and JPEG/RAW recording, and provides EOS software/SDK information. The specific capture API, installed macOS version, flash compatibility and live-view-to-shutter flow need validating before buying. Avoid assuming all Canon or Sony bodies have identical tethering and flash behaviour. [Canon M50 specifications](https://downloads.canon.com/nw/camera/products/eos/m50/specifications/canon-eos-m50-specifications-chart.pdf), [Canon support](https://www.usa.canon.com/support/p/eos-m50).

The previous Sony ZV-E10/Cam Link recommendation was chosen around a shared video feed. The revised design should not buy an HDMI adapter unless the selected preview/video route actually needs it.

## Secondary films

Build a small continuous LED source into the same front lighting area for framing and casual films. Size it for usable subject illumination, not just a decorative glow. It will provide less exposure headroom than flash, so films may be noisier, use a wider aperture or require guests to keep still. Keep the same framing and colour direction where practical.

Do not assume a camera can offer USB webcam output and USB remote still capture simultaneously. Depending on the chosen camera, films could use its internally recorded movie files transferred afterwards, a tested HDMI output, or a separate small USB camera inside the same box. A second cheap camera adds framing/quality compromises; select that only if switching modes on the primary camera is unreliable. Prefer dropping films from the first physical prototype over compromising the still-photo capture path.

The EP-2350, external audio interface and printer are deferred from the travelling first version. The photo-first brief makes a clean, complete capture cycle the priority.

## The photographic trade-off

A light built into the front of a small box is closer to the lens axis and physically smaller than the earlier 60cm side softbox. Expect a more frontal, compact-studio portrait with less sculpted side lighting. That can be an intentional and attractive look. Work at a reasonably close marked distance, initially around 1–1.3m, and frame one or two people rather than large groups. Test framing and flash exposure before fixing those distances.

The illuminated panel must actually emit across its area for its nominal size to help softness. Increasing flash power does not make a small emitting area softer. Guest-to-background distance and avoiding strong coloured venue light on faces remain useful.

## Indicative budget allocation

These are design allowances, not checked listings. The target remains £500–£1,000 excluding the existing Mac and the separate projection setup.

| Item | Allowance |
|---|---:|
| Used tether-capable camera and small zoom | £350 |
| Compact flash, compatible sync connection and spare batteries | £120 |
| Built-in LED for preview / secondary films | £50 |
| Small guest display | £70 |
| Camera power and other power supplies | £60 |
| Light case, mounts, diffusion, partitions, cover | £120 |
| Cables, adapters and capture button | £50 |
| Contingency | £100 |
| **Target** | **£920** |

Before purchasing, prove one real still capture with flash and file transfer on the intended Mac, test the diffusion chamber, then make a full-size cardboard packing mock-up around measured parts. Bench-testing those three things resolves the highest risks without committing to a large enclosure or accumulating incompatible equipment.
