# Sky Map: zoom and the camera field of view box

Design notes for the zoom control and camera footprint added to the Sky Map tab
(`/site/:sitecode/targets`).

## What this is for

The Sky Map draws a red crosshair where the user clicks and a greenyellow reticle where the
mount is pointing. Neither said anything about how much sky the camera covers, so there was
no way to judge from the chart whether a target fits in a frame. The footprint is now drawn
as a box around the reticle.

Zoom came first, because it is what makes the box worth having. The chart is a fixed all-sky
airy projection — `skymap_config.js` sets `interactive: false`, `adaptable: false`,
`controls: false` — so 180 degrees always spanned the canvas width, about **4.4 px per
degree** on a typical 690 px chart. Against the real cameras in `/all/config`:

| Site | Camera FoV | Box at 1x | Box at 8x |
|---|---|---|---|
| DPO-17 | 0.688 x 0.516 deg | ~3 x 2 px | ~24 x 18 px |
| MRC-17 / ARO-17 / ECO-17 | 2.398 x 1.799 deg | ~11 x 8 px | ~85 x 64 px |

At 1x the true-size box is smaller than the ~15 px reticle it sits inside, so it is enlarged
to a minimum size and its outline changes to say so:

| State | Outline | Meaning |
|---|---|---|
| To scale | solid | the box is the camera's true angular footprint |
| Clamped | dashed | enlarged to `MIN_FOV_BOX_PX`; the aspect ratio is true, the size is not |

Both axes are scaled by the same factor when clamping, so the shape always reports the
sensor's real aspect ratio even when the size cannot be trusted. Zooming in past the
threshold drops the clamp and the outline goes solid.

## How it fits together

- `TheSkyChart.vue` owns everything needing the projection and hands the overlay plain
  geometry.
- `InteractionCanvas.vue` only draws, and forwards input.
- `site_config.js` supplies the camera's angular size, `rotator_getters.js` its orientation.

### One redraw callback, not two

`Celestial.addCallback` keeps a *single* function rather than a list:

```js
Celestial.addCallback = function(dat) { Celestial.callback = dat; hasCallback = (dat !== null); }
```

The component used to register the two crosshair updates separately, so the second silently
replaced the first and the telescope reticle was never refreshed on redraw — it moved only
when the mount RA/Dec watchers happened to fire, and drifted out of position as the map
re-centred every 6 seconds. Everything the overlay draws now updates from one
`redraw_overlays()` registration. Since `redraw()` invokes it, that is also what keeps the
overlay pinned to the chart while zooming.

### Zoom is driven from the component

d3-celestial's own zoom handlers are deliberately unused:

- **They never see the events.** `cfg.interactive` binds `d3.geo.zoom()` to the celestial
  canvas, which `InteractionCanvas` covers with a `z-index: 1` overlay.
- **Their drag gesture rotates the map**, and `follow: 'zenith'` plus the 6-second
  `Celestial.date(new Date())` re-centre would undo any pan immediately.

So zoom is scale-only and always about the zenith, applied through `Celestial.zoomBy()`, with
the wheel forwarded from the overlay as an `i_wheel` event. Zoom scale survives the
re-centre; only panning would have fought it, and there is no panning.

`zoomextend: 60` in `skymap_config.js` raises the ceiling. Note the spelling: d3-celestial
reads `zoomextend` into its internal `zoomextent` variable, and writing `zoomextent` as the
config key is silently ignored.

### The zoom level has to be reasserted

`Celestial.resize()` rebuilds the projection at the zoom level in the *config*, not the
current one, and d3-celestial registers its own `window` resize listener. Either path drops
the chart back to all-sky without telling the component, leaving the readout claiming a zoom
the chart is no longer at.

`desired_zoom` is therefore the authority, and `restore_zoom()` reapplies it from the redraw
callback. Every path that resets the scale ends in a redraw, so reconciling in one place
covers all of them rather than chasing each one.

### Measuring the sky in screen pixels

The map is centred on the zenith, so screen-up is north along only one meridian and the
pixels per degree varies across the chart. Rather than assume either, `compute_telescope_fov()`
projects a probe point a known angle from the telescope and reads back the pixel offset — the
same trick `drawAirmassCircle` uses in `add_custom_data.js`. Taking *both* axes from the
projection also gets the parity right, so the box cannot come out mirrored, and reading the
live projection means it picks up the current zoom without being told.

Probe points come from `sky_offset()`, the standard destination-point formula. The usual
shortcut — offsetting RA by `distance / cos(dec)` — was tried first and is wrong: it
misstates the angular distance actually covered as declination grows. At dec +89.8, where
MRC-17 happened to be pointing, it was out by a factor of five and drew a visibly squashed
box. It also divides by zero at the pole. The full formula is exact everywhere, and going
over the pole returns the right answer instead of needing a special case.

The box is then rotated by the rotator's position angle. `rotator_position` formats for
display (`'12.3400 °'`), so `rotator_position_angle` was added alongside it for the raw
number; sites with no rotator yield `null` and the box is drawn unrotated.

### Star catalogues follow the zoom

`stars.6.json` leaves a zoomed-in view looking empty, but `stars.8.json` is 6.3 MB against
759 KB, so it is not fetched until the zoom justifies it — in at 4x, out again at 3x. The two
thresholds are deliberately apart; a single one would reload the map every time the user
crossed it. Only `stars.data` is passed to `Celestial.reload()`, because it merges config key
by key and that preserves the magnitude limit the user set in the sidebar.

### Label placement had to be bounded

d3 v3's quadtree subdivides until a point fits inside its extent, so adding one from far
outside recurses until the stack gives out. Zooming does exactly that: an object stays inside
the 90-degree clip, and so keeps being drawn, long after it has left the visible canvas.
Zooming in a few steps reliably threw `RangeError: Maximum call stack size exceeded`.
`label_positions()` in `add_custom_data.js` now wraps the quadtree and ignores out-of-canvas
points, which are invisible anyway.

## Files

| File | Change |
|---|---|
| `src/components/celestialmap/TheSkyChart.vue` | single redraw callback, zoom state and controls, FoV geometry |
| `src/components/celestialmap/InteractionCanvas.vue` | wheel forwarding, `telescope_fov` prop, `draw_telescope_fov()` |
| `src/components/celestialmap/add_custom_data.js` | bounded label quadtree |
| `src/components/celestialmap/skymap_config.js` | `zoomextend`, `star_catalogues` |
| `src/components/sitepages/SiteTargets.vue` | "Camera Field of View" toggle |
| `src/store/modules/site_config.js` | `camera_width_degrees`, `camera_height_degrees` |
| `src/store/modules/sitestatus/getters/rotator_getters.js` | `rotator_position_angle` |

`camera_width_degrees` and `camera_height_degrees` return `null`, not a placeholder, when the
camera config is incomplete. `camera_size_degrees` falls back to 1 so Aladin always has a
usable field, but a box drawn to scale must show the real instrument or nothing at all — a
fabricated 1 degree box would misrepresent the hardware.

## Verifying a change here

The dev server runs on port 8082 (8080 and 8081 are taken), reachable over HTTPS through
`tailscale serve --https=8443`.

```bash
cd ~/PTR/ptr_ui && npm run serve -- --port 8082
```

Open a real observatory, not a WEMA: `/site/mrc-17/targets` has a camera and mount status,
`/site/mrc/targets` does not.

1. **Reticle holds position** across the 6-second re-centre rather than drifting. This is the
   single-callback fix and everything else depends on it.
2. **Zoom** via buttons and wheel; the readout tracks, the chart stays zenith-centred, and the
   ceiling stops at 60x. Crosshairs and box stay locked to their sky positions throughout.
3. **Zoom survives a resize.** Zoom in, resize the window, confirm it does not snap to 1x.
   Both `Celestial.resize()` and a bare `window` resize event are worth trying.
4. **Clamp threshold.** On MRC-17 the box is dashed at 1x and solid by 1.5x, growing linearly
   with zoom, with the drawn aspect holding at the sensor's 1.333 throughout.
5. **Projection correctness.** Worth testing deliberately, because a naive implementation
   looks right only near the zenith. Move the pointing toward the horizon and around in
   azimuth with the date/location picker: the box must stay centred on the reticle and rotate
   with screen north. If it stays axis-aligned everywhere, the local frame is wrong.
6. **Rotation** matches the Position Angle in the status footer where a rotator reports one.
7. **Toggle** hides the box and leaves the reticle untouched.
8. **Degradation.** A site with no camera config drops the box cleanly and still draws the
   reticle — no placeholder box, no console errors.
9. **No dash leak.** The red user crosshair still draws solid after a dashed box renders.
10. `npm run lint:check` clean.

Points 4, 5 and 9 are easiest to check by reading the canvas rather than by eye, since at 1x
the box and the reticle circle nearly coincide. Isolate the box by capturing the overlay with
`telescope_fov` nulled and again with it set, and diffing — a solid box traces 100% of its
perimeter, a dashed one about 40% across several gaps.

## Known limits

- **No panning.** Zoom is zenith-centred only. Free panning would need the 6-second re-centre
  reworked, since it would fight any pan the user made.
- **Zoom is about the canvas centre**, not the mouse pointer, which follows from the same
  zenith-centred model.
