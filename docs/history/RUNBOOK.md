# Party-day runbook

> Frame includes Canon RP USB preview, real still capture and fast medium-JPEG transfer. Physical flash capture and automatic return to preview passed on 12 September 2026. Cloud delivery is local-first and queues safely before it is configured; the Epson still requires a physical bench test. See [the RP box plan](RP-BOX.md) and [delivery runbook](DELIVERY.md).

## Canon RP first connection

1. Install `gphoto2` once with `brew install gphoto2` on the booth Mac.
2. Put a formatted SD card in the RP. Frame switches both card and tethered capture to **medium JPEG only** whenever it connects; RAW is deliberately disabled to reduce transfer time and storage.
3. Frame sets **1/160 s, f/5.6, ISO 400, Flash white balance** and relies on E-TTL to meter the flash. If a captured portrait is unmistakably underlit, it allows the flash to recharge and retries once at ISO 800. Keep mechanical/electronic-first-curtain shutter and silent shooting off.
4. Disable Auto power off on the RP. On each 430EX II set **C.Fn-01 to 1** to disable its roughly 90-second auto power-off. If manual flash exposure makes live view too dark, disable exposure simulation. Use face/eye AF and test it at the marked standing distance.
5. Connect the RP directly to the Mac with a known USB-C data cable. Quit EOS Utility, Photos, Image Capture and any webcam utility that opens it.
6. Open Frame. **Check connection** should say “Canon EOS RP connected for tethered stills.” Select **Connect Canon RP** to begin the RP preview.
   Frame sends active live view to the Mac only, leaving the RP's rear display off. After 30 seconds without a capture or mode change, it stops live view and camera output completely. The first tap or button press wakes the feed and returns to a live picture; a separate second tap starts the countdown, preventing an uncertain capture while the camera is still waking.
7. Make at least ten test captures. Confirm each capture folder contains `original.jpg` and `print.jpg`, with no new CR3 files. Confirm the SD card also retains the JPEGs.
8. Disconnect and reconnect the USB cable, then repeat a capture. Reboot the Mac and rehearse again before relying on it unattended.

The first physical USB session verified preview recovery, native shutter capture, download, SD-card retention and saved files. The final lighting session must still verify autofocus, both flashes, recycling, exact exposure and prolonged operation. The simulator verifies application state and files, not those physical behaviours.

## Before the equipment goes into the box

- Copy the appropriate app to each Mac. Open it once and handle macOS permissions while you have a keyboard and access to System Settings.
- Bench-test the exact camera, HDMI capture adapter, cables, continuous power supply and Mac together. Make a photo and a film with sound if using it. Reopen the saved files from disk in another player.
- Read Frame’s actual input resolution. A 4K label on a camera or adapter does not prove that the app receives 4K.
- Check focus and skin colour at full size, then mark light, guest and camera positions. Photograph the final settings for the host.
- Run the booth for at least two hours on its intended power and within its intended enclosure. Make repeated captures. Check heat, focus hunting, recording smoothness and audio drift. The synthetic software tests cannot establish these physical properties.
- Unplug/reconnect the camera once and practise recovering with Connect / apply inputs. Test what happens if the screen is disconnected.
- Check disk space. Reserve at least 20GB for the booth and enough space for two copies of the projection media. The apps warn on near-full storage, but a reserve avoids an interrupted evening.

## Projector Mac

1. Connect mains power and the projector. Set the projector to extended display. Select its native resolution if practical.
2. Enable Do Not Disturb. Close messaging, browser calls and other distracting apps. Disable scheduled sleep and screensaver for the event in the Mac’s settings. Loop requests the display to stay awake while output is running, but does not change your permanent system settings.
3. Open Loop. Import the final exported media. Confirm order, photo interval, fit and whether films should have sound.
4. While online, use Find place names if desired. Check the readout and location visibility; then rehearse with the network disconnected. Run Check playback. Convert rejected files. Watch the complete sequence once on the projector, including every video ending and the wrap from last item to first.
5. If sound is wanted, choose the correct output in macOS Sound and test levels on the actual speakers.
6. Choose the projector in Loop and start. The output shows media on black, with the optional saved metadata readout. The Mac controller retains pause, next/previous, blackout and stop.
7. Keep a plain backup slideshow or an exported single video available on disk. If the projector disconnects, reconnect it, select it again, then start projection.

## Booth Mac

1. Connect mains power, camera/capture, display and button. Use a direct USB 3 connection for the capture adapter where possible.
2. Enable Do Not Disturb; close camera-using apps. Keep the camera and Mac ventilated. Keep the Mac lid open unless you have deliberately tested an appropriate closed-display setup.
3. Open Frame. Select camera and optional microphone. Apply inputs. Check the actual resolution and make one test capture.
4. If recording speech, play back the test file outside Frame’s silent review to check sound, clipping and lip sync. Do not rely on the presence of a microphone in the device list.
5. Choose the photo treatment. Camera colour is the safest default when using an in-camera profile you like.
6. Enter guest mode. The camera remains on so guests can frame themselves; recording only begins after they choose capture and the countdown ends. Put a simple notice on the box: “Photos and short films save to the host’s Mac.” Add that films record sound when applicable.
7. Press Space or the on-screen button. Confirm it makes one capture. Hold the physical button briefly to check that its keyboard repeat does not produce repeated sessions.
8. Keep a host keyboard accessible. Escape cancels the countdown/recording, or exits guest mode while idle. A save failure keeps the capture in memory for Retry save; get a host and leave the app open.

## If something needs attention

| Symptom | Action |
|---|---|
| Black camera preview / camera busy | Close other camera applications. Check camera power, HDMI output and USB lead. Reconnect in Frame. |
| Permission refused | Turn on the app’s Camera/Microphone permission in macOS Privacy & Security, then restart it. |
| Soft or noisy portraits | Check the real focus, light distance/output and exposure; filters will not repair these. |
| Camera resolution too low | Check camera output format, capture device, USB 3 data path and any app holding the camera. The MVP reports the negotiated size. |
| Bands in light areas | Test camera shutter and local lighting. Start from the plan’s UK 50Hz settings; dimmer behaviour varies. |
| Film is silent | Enable sound, choose the right input and apply inputs; verify the saved file outside the deliberately muted booth review. |
| “Not saved” | Leave Frame open. Free disk space or resolve the disk problem, then press Retry save. A forced quit will lose the in-memory capture. |
| Film will not open on a phone | It may be WebM. Play in Loop or a compatible desktop player and convert copies to H.264/AAC MP4 later. Keep originals. |
| Projection item skipped | Run Check playback and convert the source to a supported encoding. Re-import the converted copy. |
| Projector disconnected | Reconnect, select it again and restart output. Rehearse OS display behaviour on the exact Mac. |

## After the party

Quit after the last save finishes. Copy `~/Movies/Party Appliances/Booth captures` to a second drive. Check that the copy opens before deleting anything. Keep the original frames as well as the treated photos. Capture folders use UTC date/time so names remain unambiguous.

The apps do not upload photos or connect to each other. Optional place preparation sends embedded coordinates to Apple and caches names before the party. Sharing, selecting favourites, video conversion and deleting unwanted captures happen afterwards, deliberately.
