# The home page world map

## Where it opens

**The map opens centred on the middle of the current dark time.**

The centre longitude is the anti-solar meridian — the subsolar point plus 180
degrees — which is where it is solar midnight at that instant. The night side of
the terminator is therefore in the middle of the view on load, and the daylit
half of the world is split across the two edges.

`src/components/maps/TheWorldMap.vue`, in `initMap`:

    const sun_pos = { lat: nite.calculatePositionOfSun().lat(), lng: nite.calculatePositionOfSun().lng() }
    const map_center_latitude = 15
    ...
    center: new google.maps.LatLng(map_center_latitude, sun_pos.lng + 180),

`calculatePositionOfSun` is the NOAA solar calculation in
`src/components/maps/nite-overlay.js`; it returns the subsolar point, so adding
180 degrees of longitude gives the antipode of the sun.

The reason is that this is a map of telescopes, and a telescope is only useful
where it is dark. Opening on the midnight meridian puts the sites that can
observe right now in the centre of the screen, and it is what makes the "In the
dark" filter look consistent with what is on screen rather than arbitrary.

Two consequences worth knowing:

- **The centre is set once, at load.** It is not re-centred as the night moves.
  The terminator shading and the sun marker both refresh on 10-second intervals
  (`updateTwilightInterval`, `updateSunInterval`), so over a long-lived session
  the shading drifts away from the centre of the view. Reloading re-centres it.
- **Latitude is fixed at 15 degrees north**, not derived from anything. The
  comment in the source calls it "a more visibly comfortable location": it lifts
  the populated middle latitudes away from the bottom edge. It does not track
  the subsolar latitude, so the framing is slightly different in June and
  December.

## Zoom

Zoom is 3, and `minZoom` is 3 as well. One world is `256 * 2^zoom` pixels wide,
so zoom 3 is exactly 2048px — and `.map-display` in `src/views/Home.vue` is
capped at `max-width: 2048px` to match. Any container wider than one world gets
filled with repeat copies of it, and markers only ever attach to one copy, so
the cap and the `minZoom` together keep a single world on screen.

## What is drawn

One marker per telescope — every `instance_type` that is not a wema, plus any
wema that has no observatory of its own, so nothing is dropped. Observatories
inherit their wema's coordinates, so telescopes at one site land on the same
point; OverlappingMarkerSpiderfier groups those and fans them out on click.

Sites missing from `/allopenstatus` are still drawn, in grey, and their card
reads `Unknown` rather than `Offline` — the two are different claims, and the
dot colour has always called the second case grey.

## Times shown on the card

The "next free" line is in **the reader's local time**, not the observatory's,
with the zone named (`h:mm A z`). A student in California reading that a
telescope in Melbourne is free at "2:15 PM AEST" would have to work across a
date line to find out whether that is tonight or a school morning.

Note the calendar inside the booking modal still runs on the **site's** own
time, because that is what booking against a site needs. The summary line and
the calendar grid therefore speak different clocks.
