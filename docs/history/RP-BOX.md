# Original box study

> Historical document. This two-flash layout was not the final tested booth.
> See `../HARDWARE.md` for the current supported setup.

6 September 2026. This supersedes previous camera-shopping and enclosure-size assumptions.

## Hardware and drawing assumptions

Ordered: **Canon EOS RP, two Canon 430EX II flashes, 28mm f/2.8 lens**. The drawings assume the native **RF 28mm F2.8 STM**, without adapter or hood. Box dimensions are interpreted as **47cm wide × 36cm high × 22.5cm deep**, measured externally. Measure inside before cutting: cardboard, reinforcements, mounts and bent cables consume space.

The Mac may be the user's 2026 MacBook Air or a dedicated machine. The model reserves a **34 × 24 × 2cm closed-laptop envelope** at the rear and a **24 × 15cm display envelope** on the front. These are allowances, not verified dimensions of a chosen computer/display. No separate display has been confirmed. No further camera shopping is needed.

## Drawings and editable models

- [Front concept](booth-layout/booth-front.png)
- [Exploded interior](booth-layout/booth-cutaway.png)
- [Dimensioned layout and wiring](booth-layout/dimensions.png) / [editable vector](booth-layout/dimensions.svg)
- [Blender model](booth-layout/portrait-box.blend) / [exploded Blender model](booth-layout/portrait-box-exploded.blend)

Blender uses centimetres and named component objects. These are equipment envelopes and assembly relationships, not manufacturing CAD, a thermal simulation or an optical prediction. The lens projects slightly beyond the box; add a protective transport cover. No physical assembly has yet been tested.

## Layout and light

Place the RP high in the centre, lens approximately 26.5cm above the base. Put a **14 × 16cm diffusion window** on each side. The proposed 10-inch HDMI display sits below, offset slightly left to leave space for an optional small LED on the right and a capture button on the left. Flash supplies the photo exposure; the LED supports framing and secondary films.

Each flash occupies a separate upper chamber. The camera is close to the inner baffles: provide measured, light-shielded cut-outs for its USB/power leads rather than trapping plugs against a partition. Socket access and a right-angle connector may change the final baffle shape. Black inner partitions keep spill out of the lens; white reflective surfaces distribute light over the diffusion. Start by testing the head aimed into a white rear/upper surface. The model has only a few centimetres behind a head: revise orientation or chamber dimensions if clearance, heat or illumination tests require it. Use rigid mounts and an appropriate non-combustible reflector near the flash. Keep cloth/cardboard clear of the heads and provide ventilation. Test modest manual power and adequate recycle time over repeated sessions. More power will not fix an unevenly lit panel.

Two small windows give fairly frontal light and potentially two catchlights. They will not reproduce the wrap of a large studio softbox. Compare one flash, both equally powered, and the second a stop lower. Keep the combination that looks best on faces; the second flash can also serve as a spare.

The Mac sits vertically in a removable rear cradle, separated from the light chambers. Its cooling surfaces and cable bends need space. Side/top vents in the model are provisional, not a validated cooling design. A closed-lid Mac needs external display, power and controls configured beforehand. [Apple accessory guidance](https://support.apple.com/en-mide/102282).

Use the cardboard as a shell around a thin rigid base, uprights and shelves. Attach the camera and handles to the structure. Make the rear removable for batteries and the Mac. Keep mains adapters in their original housings.

## Diffusion to buy

Start with **white photographic diffusion fabric**, approximately one stop, such as [NEEWER polyester diffusion fabric](https://uk.neewer.com/products/neewer-polyester-white-seamless-diffusion-fabric-66600687). The smallest 0.9 × 1.5m option is ample for panels, test pieces and spares. Mount it taut on removable frames. Fabric is convenient to fold and transport.

On Amazon, search **NEEWER white seamless diffusion fabric**. [This product link](https://www.amazon.co.uk/dp/B019GSCL5S) was indexed, but current Amazon price/stock could not be verified. Check that it is translucent diffusion cloth, not opaque backdrop fabric. Alternatively, [LEE 216 White Diffusion](https://leefilters.com/colour/216/) has a specified 1.5-stop loss. Avoid coloured or heavily textured material in the light path.

## Trigger and power changes

**A 430EX II is an optical slave, not a radio receiver or optical master. The RP has no built-in optical master flash.** One hot-shoe cord fires one flash; it does not make the second fire automatically. [Canon manual](https://www2.canon.com.hk/myContent/Product_Tab/LensesandAccessories/Speedlite/_manual/430EXII_ECC_Web_000.pdf).

The drawing proposes **a Canon-version Godox X transmitter such as X2T-C, plus two X1R-C receivers**, one under each flash. The receivers bridge the older Canon flashes to the radio system. Bench-test the exact combination/firmware before installation. Use the same channel and separate groups. A Canon-compatible off-camera hot-shoe cord lets the transmitter sit low in the box instead of above the RP. [Godox X system](https://www.godox.com/product-d/X1C.html), [camera compatibility](https://www.godox.com/Downloads/Compatible_Camera_List_for_Flash_Trigger.pdf), [manufacturer manual describing Canon flashes through X1R-C](https://www.godox.com/static/upload/file/20230227/1677473137332773.pdf).

The **RP mains-power combination is DR-E18 + AC-E6N**, not the M50's DR-E12 parts. [Canon DR-E18 compatibility](https://www.canon.co.uk/store/canon-dr-e18-dc-coupler/0250C001/). Use USB-C data to the Mac. The flashes and radio gear still need batteries; one external mains lead does not make all components mains-powered.

## Subject position

On a 75cm table, the lens will be only about **102cm from the floor**. Plan seated portraits or a taller, stable venue surface for standing guests. Avoid a precarious stack of boxes.

At a subject distance of 1.4m, the RP and 28mm lens cover approximately **1.8m wide × 1.2m high**, before correction/cropping. Start there for two seated people. Keep faces away from extreme edges and avoid guests leaning very close to the lens. Choose the final seat/floor mark from real portraits.

## Worth doing next

**Frame:** implement and prove native RP shutter capture, flash and full-resolution download; then develop one good colour treatment from those photographs. Add a host rehearsal check for connection, storage, save access and a test exposure. A subtle cue near the lens could help guests look up from the screen. These remain proposed work: the current app still captures video frames and does not yet control the RP's still shutter or flash.

**Loop:** cached place names are now implemented. Next consider a manual caption/place correction for meaningful personal names, and a per-photo duration override so selected pictures can linger. Deliberate pairing of portrait images might later use a widescreen projector well, but should be optional and composed. Leave games, automatic zooms and social upload out of this version.

The current revision implements consistent booth orientation and optional slideshow metadata with cached place names. The Blender work is for assembly planning; no 3D animation has been added to the guest flow.

## Reference dimensions

- RP body: 132.5 × 85 × 70mm; [Canon specifications](https://asia.canon/en/support/6200598100).
- RF28mm: diameter 69.2mm, stored length 24.7mm; [Canon reference](https://global.canon/en/c-museum/product/rf526.html). Body/lens depths overlap at the mount; measure the assembly.
- 430EX II: nominal 72 × 122 × 101mm; [Canon specifications](https://www.usa.canon.com/support/p/speedlite-430ex-ii). Head rotation, receiver and mounting add to the envelope.
- Screen/Mac: allowances pending exact models.
