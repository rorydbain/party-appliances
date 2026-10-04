# Two-flash setup for the Canon RP booth

## Cheapest sensible setup

Buy a used **Canon ST-E2 Speedlite Transmitter** and put it on the RP. Both 430EX IIs already contain compatible Canon optical receivers, so no receiver is required beneath either flash. The ST-E2 retains E-TTL exposure and A:B ratio control and is a small, recognisable Canon accessory that should be straightforward to resell.

This is likely the best prototype choice. Its infrared control needs line of sight: turn the red receiver window on the lower front of each 430EX II toward the camera/ST-E2 and keep that window outside any opaque flash chamber. Test it after the cardboard and diffusion panels are installed. The transmitter uses a 2CR5 battery, so carry a spare.

To configure it:

1. Put the ST-E2 on the RP and lock it.
2. Hold the `ZOOM` button on each 430EX II until the wireless icon appears and `SLAVE` is shown.
3. Set both flashes and the ST-E2 to the same channel.
4. Assign the key flash to slave group A and the fill flash to group B.
5. Enable ratio control on the ST-E2 and start at A:B = 4:1.
6. Press the transmitter's pilot/test button. Both flash ready lights should respond before testing a photograph.

### Cheapest cable-assisted prototype

A **JJC FC-E3** (or Canon OC-E3) E-TTL extension cord can move one 430EX II about a metre away from the camera. It controls only one flash. To add the second cheaply, put that flash on a basic optical-slave hot-shoe adapter and set both flashes to manual power. The first flash's light triggers the second.

This costs roughly the same as a used ST-E2, loses E-TTL, and can misfire if the optical sensor is covered. It is useful if a physical lead is reassuring, but the ST-E2 is the cleaner inexpensive system.

A completely wired two-flash arrangement needs a camera hot-shoe-to-PC adapter, a PC-sync splitter, two long leads, and two PC-to-hot-shoe adapters because the RP and 430EX II lack PC sockets. It is manual-only and has at least five plug connections. It is possible, but it offers less reliability and little saving.

## The dependable setup

Use a **Godox XPro II-C** transmitter on the Canon RP and one **Godox X1R-C** receiver beneath each Canon 430EX II. This keeps Canon E-TTL exposure control while placing both flashes off camera. It is radio based, so cardboard and diffusion panels do not need line of sight to the flashes.

The 430EX II can act as an optical slave, but it cannot command another flash. The RP has no built-in flash commander. A pair of 430EX IIs therefore needs either a separate optical commander or a radio transmitter and two receivers.

Avoid a passive hot-shoe splitter. The 430EX II has no native PC-sync socket, a splitter loses E-TTL control, and several adapters and long cables create more failure points inside a portable cardboard structure.

## Buy

- 1 × Godox XPro II-C transmitter for Canon
- 2 × Godox X1R-C receivers for Canon
- 16 × low-self-discharge NiMH AA batteries, ideally Panasonic Eneloop or IKEA LADDA
- A charger that charges and reports each cell independently
- 2 × small cold-shoe or 1/4-inch mounts for fixing the receivers inside the light chambers
- 2 × short safety tethers, so neither flash can fall onto the camera or guests
- Labels or coloured tape for the matched sets of four flash batteries

The transmitter and receivers add six AAs to the eight used by the flashes. Sixteen cells gives one complete loaded set plus two spares. For the party, a second charged set of eight for the flashes would be useful because the flashes do most of the work.

## Mounting and light layout

Place both lights above eye level so reflections in glasses fall downward rather than back into the lens.

```text
Top view — people are about 1.5 m from the lens

                  PEOPLE
                    ●

          key A             fill B
       30–40° left       10–25° right
       higher/brighter    nearer lens/dimmer
              ╲              ╱
               ╲            ╱
                  CAMERA
```

- **Key / group A:** 30–40° to camera left and 20–30° above faces.
- **Fill / group B:** close to camera right, slightly lower than the key.
- Use at least an A3-sized illuminated diffusion area for each light. A larger apparent source matters much more than putting a tiny diffuser directly on a speedlight.
- Keep the flash head roughly 10–15 cm behind the diffuser. Better still, point it at a white card lining and let the reflected light pass through the diffuser; this spreads the hot spot.
- Set both flash zoom heads to 24 mm to spread light around their chambers.
- Leave ventilation around each head. Do not let the flash lens touch polypropylene, tracing film, or cardboard.

Do not use two equally bright lights at equal angles. That gives flat light and two equally strong shadows. The weaker near-axis fill should soften the key's shadow without erasing the shape of faces.

## Pairing the radio system

1. Put the XPro II-C on the RP hot shoe and lock it.
2. Put one X1R-C beneath each 430EX II and lock both feet.
3. Set the transmitter and both receivers to the same channel and wireless ID. Use any arbitrary pair such as channel 7 and ID 27.
4. Assign the key receiver to group A and the fill receiver to group B.
5. Leave each 430EX II in its normal E-TTL mode. Do **not** enable the flash's optical `SLAVE` mode; the X1R-C is now doing the receiving.
6. Disable automatic power-off on each flash for the booth. Test that the first shot after several idle minutes still fires.

On each 430EX II, set **C.Fn-01 to 1 (Disabled)**. Canon's default lets the flash sleep after about 90 seconds; a half-press wakes it, but the camera may still make a photograph before it has recharged. Frame now wakes/focuses at `2`, leaves almost two seconds for recharge, reads the RP's flash-fired record from the photograph, checks whether the portrait area is still unmistakably underlit, and makes one ISO 800 retry when needed. The red pilot lamp remains the definitive physical ready indication before capture.

To set it on the flash, hold the **backlight/C.Fn** button for at least two seconds, select custom function `01`, press **SET**, choose `1`, press **SET** again, then press **MODE** to return to shooting. Repeat on the second flash. If you use the RP's menu instead, open **External Speedlite control → External flash C.Fn setting → Auto power off → Disabled** while the flash is attached and switched on.

## Starting exposure

Start with:

- Camera: manual exposure, 1/160 s, f/5.6, ISO 400 (Frame uses ISO 800 only for one underlit retry)
- White balance: Flash, or a measured fixed Kelvin value after testing the diffuser
- XPro: E-TTL, group A at 0 EV and group B at -2 EV (a 4:1 starting ratio)
- Lens: autofocus for acquisition, then hold focus for the actual countdown and exposure

Take a test frame of a face at the marked standing position. Adjust both groups together until skin is bright without clipped forehead or cheek highlights. Then change only group B: use -1 EV for gentler 2:1 fill, or -3 EV for more directional 8:1 light.

Once the physical booth is fixed, use the XPro II's TCM function to convert the successful TTL exposure to manual power. Manual flash is more consistent from frame to frame, but the camera ISO must then remain fixed. If the booth app changes ISO automatically, leave the flashes in E-TTL until the app has a calibrated fixed-flash preset.

## Test before enclosing anything

1. Fire 10 frames with the key alone and confirm exposure and glasses reflections.
2. Add the fill and tune its ratio.
3. Fire 20 complete booth cycles at the real expected pace.
4. Confirm every frame receives both flashes, the recharge light is ready before capture, and neither unit gets unusually hot.
5. Leave the system idle for 15 minutes, then take another frame to expose power-saving problems.
6. Mark the subject position and all successful angles before transferring the parts into cardboard.

The flashes affect still photos only. Keep a separate continuous, high-CRI LED source for flattering live view and the ten-second film mode.
