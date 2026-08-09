
const STALE_AGE_MS = 1000 * 60 * 5 // 5 minutes before status is reported to be stale

const display_colors = {
  default: 'lightgrey',
  red: 'orangered',
  yellow: 'yellow',
  green: 'greenyellow',
  missing: 'grey'
}

function isItemStale (getters, device_state, status_key) {
  const now = getters.now // use a getter so this stays reactive
  const status_timestamp = getters[device_state][status_key]?.timestamp
  if (typeof status_timestamp == 'undefined') { return true }
  return now - status_timestamp > STALE_AGE_MS
}

function statusAgeDisplay (status_age) {
  if (status_age < 60) {
    return {
      val: status_age_seconds(status_age),
      color: display_colors.green
    }
  } else if (status_age < 300) {
    return {
      val: status_age_minutes(status_age),
      color: display_colors.green
    }
  } else if (status_age < 600) {
    return {
      val: status_age_minutes(status_age),
      color: display_colors.yellow
    }
  } else if (status_age < 3600) {
    return {
      val: status_age_minutes(status_age),
      color: display_colors.red
    }
  } else if (status_age < 86400) {
    return {
      val: status_age_hours(status_age),
      color: display_colors.red
    }
  } else if (status_age < 18000 * 86400) {
    return {
      val: status_age_days(status_age),
      color: display_colors.red
    }
  } else {
    return {
      val: 'na',
      color: display_colors.red
    }
  }
}
function status_age_days (timestamp_ms) {
  let timestring = ''
  const days = parseInt(timestamp_ms / 86400)
  const hours = parseInt((timestamp_ms % 86400) / 3600)
  timestring += days + 'd  '
  timestring += hours + 'h  '
  return timestring
}
function status_age_hours (timestamp_ms) {
  let timestring = ''
  const hours = parseInt(timestamp_ms / 3600)
  const minutes = parseInt((timestamp_ms % 3600) / 60)
  timestring += hours + 'h  '
  timestring += minutes + 'm  '
  return timestring
}
function status_age_minutes (timestamp_ms) {
  let timestring = ''
  let minutes = parseInt(timestamp_ms / 60)
  let seconds = parseInt(timestamp_ms % 60)
  timestring += minutes += 'm  '
  timestring += seconds += 's  '
  return timestring
}
function status_age_seconds (timestamp_ms) {
  return parseInt(timestamp_ms) + 's '
}

/**
 * Read a status value out of its {val, timestamp} envelope.
 *
 * photonranch-status wraps whatever it is handed, so a value posted already
 * wrapped comes back as {val: {val: X}} and a single .val yields an object,
 * which the panel then prints as raw JSON. Unwrap until we reach something
 * that is not an envelope. parseTrueFalse below already does this for
 * booleans; this is the same idea for every other value.
 */
function unwrapVal (entry, fallback = '-') {
  let node = entry
  for (let depth = 0; depth < 5; depth++) {
    if (node === null || typeof node !== 'object' || !('val' in node)) { break }
    node = node.val
  }
  return node ?? fallback
}

/**
 * Round a numeric status value to fit its display box, appending a unit.
 * Non-numeric values ('-', 'n/a', booleans) are passed through untouched so a
 * missing reading still reads as '-' rather than 'NaN'.
 */
function displayNumber (value, decimals, unit = '') {
  const n = typeof value === 'number' ? value : parseFloat(value)
  // A missing reading should read as '-' or 'n/a', not '-%' or 'null%',
  // so non-numeric values keep their own text and drop the unit.
  if (!Number.isFinite(n)) { return value ?? '-' }
  return `${n.toFixed(decimals)}${unit}`
}

/**
 * Append a unit to a reading, unless the reading is missing.
 *
 * get_val() returns '-' when a key is absent, and '-' + ' °' reads as '- °'.
 * A missing value should carry no unit at all. The numeric value itself is
 * returned unchanged, so this does not alter how present values are formatted;
 * use displayNumber() when the number also needs rounding.
 */
function withUnit (value, unit) {
  const n = typeof value === 'number' ? value : parseFloat(value)
  if (!Number.isFinite(n)) { return value ?? '-' }
  return `${value}${unit}`
}

const parseTrueFalse = s => {
  if (typeof s == 'object') {
    return parseTrueFalse(s.val)
  }
  if (undefined == s) {
    return false
  }
  if (typeof s === 'boolean') {
    return s
  }
  else if (s.toLowerCase() == 'true') { return true }
  else if (s.toLowerCase() == 'false') { return false }
  return false
}

export {
  STALE_AGE_MS,
  display_colors,
  isItemStale,
  statusAgeDisplay,
  parseTrueFalse,
  unwrapVal,
  displayNumber,
  withUnit
}
