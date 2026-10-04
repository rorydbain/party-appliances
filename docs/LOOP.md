# Loop

Loop is a projector player for a large personal library of photographs and
videos. It copies selected files into its own local library, so moving the
originals later does not break a prepared show.

## Playback

Connect the projector as an extended display, add media, choose the projector
under **Play on**, then start projection. **Check playback** verifies that each
file begins decoding; rehearse the complete library because that cannot prove
every video frame is intact.

Single-item mode shuffles the full sequence on launch and again after a complete
rotation. Grid mode uses four-, five- and six-tile mosaics. Layouts change
gradually, media is matched to similarly shaped spaces, and tile changes are
staggered so the screen does not replace everything at once.

Long videos play in excerpts of at most 12 seconds. Loop spreads excerpt starts
across the duration and retains recent history, allowing the same long video to
return later without repeatedly showing its opening. Grid videos stay muted.

**Balanced fill** uses a small crop when the source and tile are close in shape;
otherwise it shows the complete source over a soft edge fill. **Show the whole
image** never crops.

## Large libraries

Width, height and video duration are measured in small background batches and
cached in `playlist.json`. Projection starts with the measurements already
available rather than waiting for a complete scan. **Optimise large videos** can
replace oversized library copies with smaller 1080p playback files; selected
originals are never changed.

Sequence search supports names, captions, places, dates and media type. Duplicate
review checks exact file contents and a conservative visual fingerprint.

## Captions

Optional playback captions can show a manual caption, trustworthy camera date
and cached place name. Camera names are not displayed. Dates from recognised
scanners and filesystem/export timestamps are suppressed. **Find place names**
uses Apple's geocoder while online and caches successful results for offline
playback.

## Optional live Photobooth feed

When the shared event profile has `liveFeedUrl`, Loop checks it in the background.
New booth photographs are cached and scheduled promptly, then join the ordinary
shuffle. Loss of internet never stops local playback. With no profile, Loop does
not contact a remote feed.

Loop writes rotating diagnostics and playback observations under
`~/Movies/Party Appliances/Diagnostics/`.
