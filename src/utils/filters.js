/* Whether a project's exposures can actually be taken at the site it is being
 * booked on.
 *
 * A PTR project is written against ONE telescope's filter wheel and can then be
 * booked on any other, and the wheels do not agree. Every ptr-observatory site
 * carries the photometric set
 *
 *     lum/PhLum, dk, SA, BU, BB, BV, ha, BI
 *
 * while an Asterism-backed site publishes what NINA reports
 *
 *     Blue, Clear, Green, Ha, OIII, Red, SII
 *
 * so Ha is the only name the two share. A project authored on MRC-17 and booked
 * on BJ Sky Simulator is refused for nearly every filter it asks for, and until
 * now nothing said so: the booking sat on the calendar looking accepted and was
 * dropped server-side with a log line nobody reads.
 *
 *
 * WHY ONLY ASTERISM-BACKED SITES
 *
 * Because those are the only ones whose rules we know exactly.
 *
 * PTR's own project form offers generic names -- Lum, Red, HA, Exo, and the
 * quick-stack entries like 'RGB irg' -- that appear in NO site config. On a
 * ptr-observatory site they are resolved at the mount by the filter_groups
 * table in ptr-observatory/devices/filter_wheel.py, which maps e.g. Red onto
 * whichever of rp/BR/PR/Rc that wheel actually holds. Checking a project
 * against the bare config list there would warn about nearly every project
 * ever written, and a warning that is usually wrong is worse than none: people
 * learn to click past it, and then miss the real one.
 *
 * An Asterism-backed site is different. The import rules are in
 * packages/server/src/services/ptr/ptrCalendarMapper.ts and the alias table
 * below is a copy of the one there, so this predicts the server's answer
 * exactly rather than guessing at it. Keep the two in step: if they drift,
 * this either warns about bookings that would have worked or stays quiet about
 * ones that will not.
 */

/* Aliases for the SAME passband under a different name, from the importer. A
 * project asking for "Lum" on a rig whose luminance filter is called "Clear"
 * is a spelling difference, not a missing filter.
 *
 * Nothing else belongs here, and the Johnson/Cousins names are why: BB and BV
 * are Bessell B and V, standard photometric bands with their own responses,
 * not alternative spellings of Blue and Green. Treating them as equivalent
 * would mean imaging the wrong band and reporting success -- which is the
 * failure the server's refusal exists to prevent, and the reason this warning
 * is the right remedy rather than a wider alias table.
 */
const FILTER_ALIASES = {
  LUM: ['LUMINANCE', 'CLEAR', 'L', 'LUM', 'C'],
  LUMINANCE: ['LUM', 'CLEAR', 'L', 'LUMINANCE', 'C'],
  L: ['LUM', 'LUMINANCE', 'CLEAR', 'L', 'C'],
  CLEAR: ['CLEAR', 'LUM', 'LUMINANCE', 'L', 'C'],
  C: ['CLEAR', 'LUM', 'LUMINANCE', 'L', 'C'],
  R: ['RED', 'R'],
  RED: ['RED', 'R'],
  G: ['GREEN', 'G'],
  GREEN: ['GREEN', 'G'],
  B: ['BLUE', 'B'],
  BLUE: ['BLUE', 'B'],
  HA: ['HA', 'H-ALPHA', 'HALPHA'],
  'H-ALPHA': ['HA', 'H-ALPHA', 'HALPHA'],
  OIII: ['OIII', 'O3'],
  O3: ['OIII', 'O3'],
  SII: ['SII', 'S2'],
  S2: ['SII', 'S2']
}

/* Exposure types that need no filter, so a project full of them is not a
 * mismatch. The importer only ever builds light frames from a booking. */
const NON_LIGHT_IMTYPES = ['bias', 'dark']

/**
 * Whether this site's schedule is run by Asterism rather than by PTR.
 *
 * `source` is stamped by the Asterism publisher when it writes the config in,
 * and no ptr-observatory site carries it. `asterism_code` is checked too so a
 * config written before that field existed is still recognised.
 */
export function isAsterismSite (siteConfig) {
  if (!siteConfig || typeof siteConfig !== 'object') return false
  return String(siteConfig.source || '').toLowerCase() === 'asterism' ||
    !!siteConfig.asterism_code
}

/**
 * Every filter name a site's wheel answers to.
 *
 * Two shapes are in use. The Asterism-published configs carry a flat `filters`
 * array; ptr-observatory sites carry
 * `filter_wheel.<wheel>.settings.filter_data`, rows of
 * [name, [positions], description]. Element 0 is the name the rest of ptr_ui
 * treats as canonical (see ImageFilter.vue and InstrumentControls/Camera.vue,
 * both of which bind `filter[0]`); element 2 is a human description such as
 * 'Bessell V', so it is deliberately NOT read as a name.
 *
 * The wheel named in `defaults.filter_wheel` is the one in use. Every wheel is
 * read when that default is missing or does not resolve, since the key is
 * site-specific -- `filter_wheel1` on one site, `SimFW` on another.
 *
 * An empty result means UNKNOWN, not "carries nothing", and the caller stays
 * silent on it.
 */
export function siteFilterNames (siteConfig) {
  const names = new Set()
  if (!siteConfig || typeof siteConfig !== 'object') return []

  if (Array.isArray(siteConfig.filters)) {
    siteConfig.filters.forEach(f => {
      const name = String(f || '').trim()
      if (name) names.add(name)
    })
  }

  const wheels = siteConfig.filter_wheel
  if (wheels && typeof wheels === 'object') {
    const preferred = siteConfig.defaults && siteConfig.defaults.filter_wheel
    const chosen = (preferred && wheels[preferred]) ? [wheels[preferred]] : Object.values(wheels)
    chosen.forEach(wheel => {
      const rows = wheel && wheel.settings && wheel.settings.filter_data
      if (!Array.isArray(rows)) return
      rows.forEach(row => {
        const name = Array.isArray(row) ? String(row[0] || '').trim() : ''
        if (name) names.add(name)
      })
    })
  }

  return [...names]
}

/**
 * The site's own spelling for a requested filter, or null if it has none.
 *
 * `available` empty means we do not know what the site carries, so the request
 * passes: warning on ignorance would train people to ignore the warning.
 */
export function resolveFilter (requested, available) {
  const wanted = String(requested || '').trim()
  if (!wanted) return null
  if (!Array.isArray(available) || available.length === 0) return wanted

  const byUpper = new Map(available.map(f => [String(f).trim().toUpperCase(), String(f)]))
  const exact = byUpper.get(wanted.toUpperCase())
  if (exact) return exact

  for (const candidate of FILTER_ALIASES[wanted.toUpperCase()] || []) {
    const match = byUpper.get(candidate)
    if (match) return match
  }
  return null
}

/**
 * The filters a project asks for that this site cannot take, de-duplicated and
 * in the order asked for.
 *
 * Empty means the booking is fine as far as filters go -- which includes every
 * case we are not certain about: a site PTR schedules itself, a site that has
 * not said what it carries, and a project with no exposures.
 */
export function unavailableProjectFilters (project, siteConfig) {
  if (!isAsterismSite(siteConfig)) return []

  const available = siteFilterNames(siteConfig)
  if (available.length === 0) return []

  const exposures = Array.isArray(project && project.exposures) ? project.exposures : []
  const missing = []
  exposures.forEach(e => {
    if (!e) return
    const imtype = String(e.imtype || 'light').toLowerCase()
    if (NON_LIGHT_IMTYPES.includes(imtype)) return
    // 'Clear' is the importer's default for an exposure naming no filter, so
    // the check assumes the same or it would pass a booking the server refuses.
    const requested = String(e.filter || 'Clear').trim()
    if (!requested) return
    if (resolveFilter(requested, available) === null && !missing.includes(requested)) {
      missing.push(requested)
    }
  })
  return missing
}
