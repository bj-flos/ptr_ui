
import timespace from '@mapbox/timespace'

class CoordinateTimezoneError extends Error {
  constructor (message) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * @param {Array} coords is an array of two floats: [latitude, longitude]
 * @returns {Number} timezone offset from UTC in minutes
 */
function tz_name_from_coordinates (lat, lng) {
  const location = [lng, lat]
  const tz_name = timespace.getFuzzyLocalTimeFromPoint(new Date(), location)
  console.log(tz_name)
  try {
    return tz_name.tz()
  } catch (e) {
    console.log(e)
    if (e instanceof TypeError) {
      throw new CoordinateTimezoneError('Provided coordinates do not map to a timezone region name.')
    }
    throw e
  }
}

/**
 * @param {String} timeZone is the name of the timezone as used in the tz database. Eg. America/Los_Angeles
 * @param {Date} date at which we want to calculate the offset. This matters in regions that use daylight savings time.
 * @returns {Number} offset from UTC in minutes
 */
function get_offset (timeZone = 'UTC', date = new Date()) {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone }))
  return (tzDate.getTime() - utcDate.getTime()) / 6e4
}

/**
 * Estimate the time offset from UTC based on longitude.
 * This is useful when lat/lng coordinates do not locate a timezone when searching via @mapbox/timespace, etc.
 *
 * Note: offset is discretized on 1 hour blocks centering on nth lines of longitude, where n is integer multiples
 * of 15. So longitudes of 0, 15, 30... mark the centers of offsets of 0, 1, 2... hours.
 *
 * @param {Number} lng in degrees, [-180, +180]
 * @returns {Number} offset from UTC in hours
 */
function offset_from_longitude (lng) {
  return Math.floor((lng + 7.5) / 15)
}

/**
 * Determine the UTC offset for a location at a given latitude, longitude, and time.
 *
 * Note: This method should not be used for critical applications.
 * The coordinate lookup doesn't always return results, in which case we estimate based on longitude.
 * However, the longitude estimates are often different than the real world timezone boundaries.
 *
 * Since this is provided as a convenience method for users figuring out times at custom lat/lng coordinates,
 * we choose to fall back on an approximation rather than throw an error or use an expensive computation for
 * better precision.
 *
 * @param {Number} lat is latitude in degrees, -90 to +90
 * @param {Number} lng is longitude in degrees, -180 to +180
 * @param {Date} date is the time we want to lookup. This matters for determining whether DST is active.
 * @returns {Number} UTC offset, in hours.
 */
function utc_offset_from_coordinates (lat, lng, date = new Date()) {
  try {
    const tz_name = tz_name_from_coordinates(lat, lng)
    const offset = get_offset(tz_name, date) / 60 // convert to hours
    console.log('offset from tz_name: ', offset)
    return offset
  } catch (err) {
    console.log(err)
    // If we can't resolve a timezone region name, then estimate the offset from the longitude
    if (err instanceof CoordinateTimezoneError) {
      const offset = offset_from_longitude(lng)
      console.log('offset from lng: ', offset)
      return offset
    }
    throw err
  }
}

/**
 * A short label for a timezone, eg. 'PDT' or 'AEST'.
 *
 * Intl follows daylight saving, which a hand-written abbreviation in a site
 * config does not -- mrc's says PST all summer. But Intl only knows letter
 * abbreviations for a few regions and answers 'GMT+10' for Australia/Melbourne,
 * where the site's own 'AEST' reads better. So: prefer Intl, and fall back to
 * the supplied label only where Intl gives an offset rather than a name.
 *
 * @param {String} timeZone tz database name, eg. 'America/Los_Angeles'
 * @param {String} fallback the site's own abbreviation, if it publishes one
 * @returns {String} the label, or '' when neither source has one
 */
function zone_label (timeZone, fallback = '') {
  if (!timeZone) { return fallback }
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
      .formatToParts(new Date())
    const label = parts.find(p => p.type == 'timeZoneName')?.value ?? ''
    if (label && !label.startsWith('GMT')) { return label }
    return fallback || label
  } catch (e) {
    // An unrecognised zone should cost a label, nothing more.
    return fallback
  }
}

/**
 * The same label for whatever zone the browser is in.
 * @returns {String}
 */
function browser_zone_label () {
  try {
    return zone_label(Intl.DateTimeFormat().resolvedOptions().timeZone)
  } catch (e) {
    return ''
  }
}

export { utc_offset_from_coordinates, zone_label, browser_zone_label }
