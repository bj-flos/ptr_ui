/**
 * Whether a telescope can be used right now, and if not, why not.
 *
 * The map popup and the "Use this Telescope" button both need this answer, and
 * they must never disagree -- a card reading "Weather: ok" beside a toast
 * saying "too cloudy" is the bug this module exists to make impossible. Both
 * read the same object from siteReadiness().
 *
 * The expressions here are lifted verbatim from what the popup used to compute
 * inline in TheWorldMap.vue, so this is a move rather than a second opinion.
 */
import helpers from '@/utils/helpers'
import { STALE_AGE_MS } from '@/store/modules/sitestatus/getters/status_utils'

/* Status is reported in seconds; the shared constant is in milliseconds. The
   popup used to hardcode 300 here, which happened to agree with it. */
export const STALE_AGE_S = STALE_AGE_MS / 1000

/* The palette, so a word in the card matches the colour of that site's dot
   where the two describe the same thing. Kept in step with the `colors` map in
   TheWorldMap's getSiteMapColor. */
export const STATUS_GREEN = 'greenyellow'
export const STATUS_RED = '#cd0000'
export const STATUS_AMBER = '#dd9c00'
export const STATUS_GREY = '#999999'

/**
 * The enclosure record that governs this site.
 *
 * An observatory does not report its own roof -- it inherits its wema's. The
 * store already does this when colouring dots (sitestatus/index.js), and the
 * markers are per-observatory now, so the card has to do it too or every
 * telescope would show a roof of '-'.
 */
export function enclosureFor (site, siteOpenStatus) {
  if (!site || !siteOpenStatus) return null
  const inherited = site.instance_type !== 'wema' && site.wema_name
    ? siteOpenStatus[site.wema_name]?.enclosure_status
    : null
  return inherited || siteOpenStatus[site.site]?.enclosure_status || null
}

/**
 * Three-state readiness for one site.
 *
 * `known` distinguishes "this site has never reported" from "this site reported
 * and is offline". The old popup collapsed both into a red "Offline", which
 * claimed more than the data supports; the dot colour has always called the
 * first case grey.
 */
export function siteReadiness (site, siteOpenStatus) {
  const status = site && siteOpenStatus ? siteOpenStatus[site.site] : null
  if (!status) return { known: false }

  const online = status?.weather?.status_age_s < STALE_AGE_S
  if (!online) return { known: true, online: false }

  const enclosure = enclosureFor(site, siteOpenStatus)
  const roofOpen = helpers.enclosureIsOpen(enclosure)

  return {
    known: true,
    online: true,
    weatherOk: !!status.wx_ok,
    // enclosureIsOpen returns null for "no idea", so this must be an identity
    // test -- !roofOpen would call an unknown roof shut.
    roofOpen: roofOpen === true,
    roofKnown: roofOpen !== null,
    shutReason: enclosure?.shut_reason
  }
}

/** Every gate passed: online, clear skies, roof open. */
export function isUsableNow (readiness) {
  return !!(readiness &&
    readiness.known &&
    readiness.online &&
    readiness.weatherOk &&
    readiness.roofOpen)
}

/**
 * The card's rows, in the order the popup has always shown them.
 *
 * Weather and roof readings only mean anything while the site is reporting, so
 * an offline or unknown site shows the one row and nothing stale.
 *
 * Rows are objects rather than [label, value] pairs on purpose. A pair has to
 * be destructured to be read, and array destructuring in a v-for alias compiles
 * to a Babel helper that vue-loader does not inject into the template's render
 * function -- the render then throws _slicedToArray is not defined, Vue
 * swallows it, and the card renders as an empty placeholder.
 */
export function readinessRows (readiness) {
  if (!readiness || !readiness.known) {
    return [{ label: 'Status', text: 'Unknown', color: STATUS_GREY }]
  }
  if (!readiness.online) {
    return [{ label: 'Status', text: 'Offline', color: STATUS_RED }]
  }
  return [
    { label: 'Status', text: 'Online', color: STATUS_GREEN },
    readiness.weatherOk
      ? { label: 'Weather', text: 'ok', color: STATUS_GREEN }
      : { label: 'Weather', text: 'poor', color: STATUS_RED },
    { label: 'Safety', ...roofRow(readiness) }
  ]
}

/* Split out so the roof wording lives beside the roof toast wording. A roof
   shut for daytime or manual mode is expected rather than a fault, so only a
   weather closure is drawn red. */
function roofRow (readiness) {
  if (!readiness.roofKnown) return { text: '-', color: STATUS_GREY }
  if (readiness.roofOpen) return { text: 'Open', color: STATUS_GREEN }

  const reasons = { bad_weather: 'bad weather', daytime: 'daytime', manual: 'manual' }
  const reason = reasons[readiness.shutReason]
  return {
    text: reason ? `Shut — ${reason}` : 'Shut',
    color: readiness.shutReason === 'bad_weather' ? STATUS_RED : STATUS_AMBER
  }
}

/**
 * Buefy toast options explaining why this telescope cannot be used.
 *
 * Wording is aimed at a grade-school reader: short sentences, plain words, and
 * every message ends with something to do next. Reasons are checked in the same
 * order the card lists its rows, so the toast always names the row the student
 * can see is red. is-danger is reserved for genuinely broken -- daytime is not
 * an error, it is how telescopes work.
 *
 * Returns null when the site is usable, so callers can treat a truthy result as
 * "blocked".
 */
export function unavailableReason (site, readiness) {
  const name = site?.name || site?.site || 'This telescope'
  const toast = (type, message) => ({
    type,
    message,
    duration: 6000,
    position: 'is-bottom'
  })

  if (!readiness || !readiness.known) {
    return toast('is-warning', `We can't tell how ${name} is doing right now. Try a different telescope!`)
  }
  if (!readiness.online) {
    return toast('is-danger', `${name} is not awake right now. Try a different telescope, or come back later.`)
  }
  if (!readiness.weatherOk) {
    return toast('is-warning', `The sky at ${name} is too cloudy for pictures right now. Try a different telescope!`)
  }
  if (!readiness.roofOpen) {
    if (readiness.shutReason === 'daytime') {
      return toast('is-info', `The sun is still up at ${name}. Telescopes wake up after dark!`)
    }
    if (readiness.shutReason === 'bad_weather') {
      return toast('is-warning', `The roof at ${name} is closed because of bad weather. Try a different telescope!`)
    }
    if (readiness.shutReason === 'manual') {
      return toast('is-info', `${name} is closed for a check-up right now. Try a different telescope!`)
    }
    return toast('is-warning', `The roof at ${name} is closed right now. Try a different telescope!`)
  }
  return null
}
