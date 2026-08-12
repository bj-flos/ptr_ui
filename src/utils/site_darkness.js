/**
 * Is it dark at a site right now?
 *
 * The map already draws a global terminator (see maps/nite-overlay.js), but it
 * shades the whole globe and never evaluates an individual site. The home page
 * needs the per-site answer so it can show only the telescopes that could
 * actually be observing.
 *
 * suncalc is already a dependency, used by utils/calendar_utils.js for the
 * calendar's twilight bands. This is a separate module because calendar_utils
 * exports FullCalendar-shaped event objects and this is consumed by the map.
 */
import SunCalc from 'suncalc'

const RAD = Math.PI / 180

/**
 * Nautical dark, not astronomical.
 *
 * The night overlay draws its darkest band at 18 degrees, so -18 would make the
 * surviving markers line up exactly with the darkest shading. It is still the
 * wrong threshold here: above roughly 48 degrees latitude the sun never reaches
 * -18 in summer, so a perfectly usable telescope would simply disappear from
 * the map with no explanation. -12 also matches what PTR site configs typically
 * use for 'Observing Begins'.
 */
export const DARK_SUN_ALTITUDE_DEG = -12

/** Solar altitude in degrees. Negative means the sun is below the horizon. */
export function sunAltitudeDeg (date, latitude, longitude) {
  return SunCalc.getPosition(date, latitude, longitude).altitude / RAD
}

/**
 * True when the sun is far enough below the horizon at this site to observe.
 *
 * Takes a site record from the site_config/all_sites getter, which carries
 * latitude and longitude. Returns false rather than throwing when a site has no
 * usable coordinates -- a site we cannot place is one we cannot claim is dark.
 */
export function siteIsDark (site, date = new Date()) {
  if (!site) return false
  const lat = Number(site.latitude)
  const lng = Number(site.longitude)
  if (!isFinite(lat) || !isFinite(lng)) return false
  return sunAltitudeDeg(date, lat, lng) <= DARK_SUN_ALTITUDE_DEG
}

/**
 * The dark windows overlapping [from, from + hours], as {start, end} Dates.
 *
 * Sampled at a fixed step rather than solved analytically: the caller only
 * needs windows to the nearest few minutes to intersect them with bookings, and
 * a sampler is a great deal easier to be confident in than a root finder over a
 * function that has no crossing at all on some days at high latitude.
 *
 * A window still open at the end of the range is returned clipped to it, so
 * callers must not read a window's `end` as "the sun rises here".
 */
export function darkWindows (site, from = new Date(), hours = 24, stepMinutes = 5) {
  const windows = []
  if (!site) return windows

  const stepMs = stepMinutes * 60 * 1000
  const end = new Date(from.getTime() + hours * 60 * 60 * 1000)
  let openWindow = null

  for (let t = from.getTime(); t <= end.getTime(); t += stepMs) {
    const at = new Date(t)
    if (siteIsDark(site, at)) {
      if (!openWindow) openWindow = { start: at, end: at }
      else openWindow.end = at
    } else if (openWindow) {
      windows.push(openWindow)
      openWindow = null
    }
  }
  if (openWindow) windows.push(openWindow)

  return windows
}
