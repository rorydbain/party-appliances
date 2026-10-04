# Tested hardware

Photobooth currently supports the hardware profile used for its first event.
Treat other cameras and printers as development work until the complete capture
cycle has been physically tested.

## Core booth

- Apple-silicon Mac running macOS 13 or later
- Canon EOS RP
- Canon RF 28mm F2.8 STM
- SD card in the camera
- USB-C data cable directly from the camera to the Mac
- Canon 430EX II on the camera hot shoe
- Four low-self-discharge NiMH AA cells in the flash, plus a charged spare set
- iPad connected to the Mac with Sidecar for the guest display

For a long unattended session, use the Canon DR-E18 DC coupler with an
AC-E6N-compatible mains adapter. USB tethering does not reliably power the RP.
Keep a charged real camera battery available even when testing a coupler.

## Receipt option

- Epson TM-T20III connected over USB
- Epson power adapter
- 80 mm thermal receipt rolls

The implementation identifies USB vendor `04b8` and product `0e28` and uses the
TM-T20II ESC/POS capability profile, which matches the tested TM-T20III print
geometry. Other Epson models may need different identifiers, widths or status
commands.

## Loop

- A second Mac is recommended when Photobooth and Loop run simultaneously
- Projector, television or large display configured as an extended display
- Appropriate HDMI/USB-C adapter and mains power

## Camera setup

Photobooth configures the RP for medium JPEG and keeps a copy on the SD card.
The tested still starting point is:

- manual exposure
- f/5.6
- ISO 400
- 1/80 second
- flash white balance
- continuous autofocus disabled
- mechanical or electronic-first-curtain shutter; silent shooting disabled

Live view uses a separate ambient-light configuration. E-TTL controls the flash
output. Mark a guest position and tune the flash at that distance before the
event; software cannot determine the flash battery level.

The original enclosure used a 47 × 36 × 22.5 cm cardboard box with removable
Velcro-mounted parts. See [the drawings](booth-layout/dimensions.png) and
[original build notes](history/RP-BOX.md). Those files document one build rather than a
required or safety-certified enclosure. Keep mains adapters intact, support the
camera independently of the cardboard, leave ventilation, and keep diffusion
material clear of the flash head.
