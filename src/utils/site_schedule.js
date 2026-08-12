/**
 * When is this telescope next free to observe?
 *
 * "Free" is the intersection of three things, and all three matter:
 *   - it is dark there (utils/site_darkness)
 *   - nobody else holds a reservation (the calendar)
 *   - it is online, clear and open right now (utils/site_availability)
 *
 * The third is why `readiness` is an argument rather than something this module
 * looks up. Without it, "free right now" could send a student to a telescope
 * the card beside the button has just told them is shut.
 */
/* moment-timezone, not moment. Everywhere else in this codebase calls .tz() off
   a plain `moment` import and gets away with it because @fullcalendar/moment-
   timezone patches the shared instance -- but that plugin only loads on the
   calendar page, and this runs on the home page. Importing it here is what
   makes the site-local formatting below actually work. */
import moment from 'moment-timezone'
import { darkWindows } from '@/utils/site_darkness'
import { isUsableNow } from '@/utils/site_availability'

/** How far ahead to look. One night is the useful horizon for this audience. */
export const UPCOMING_WINDOW_HOURS = 24

/** Shorter than this and there is no point handing it to a student. */
export const MIN_SESSION_MINUTES = 15

/**
 * Subtract busy intervals from a dark window, returning what is left.
 * All arguments and results are {start, end} with millisecond numbers.
 */
function subtractBusy (window, busy) {
  let free = [window]
  busy.forEach(b => {
    const next = []
    free.forEach(f => {
      // No overlap: the fragment survives whole.
      if (b.end <= f.start || b.start >= f.end) {
        next.push(f)
        return
      }
      if (b.start > f.start) next.push({ start: f.start, end: b.start })
      if (b.end < f.end) next.push({ start: b.end, end: f.end })
    })
    free = next
  })
  return free
}

/**
 * The next window in which this telescope could be used.
 *
 * Returns one of:
 *   { status: 'now' }                  usable this instant
 *   { status: 'later', start: Date }   free from `start`
 *   { status: 'unknown' }              not enough information to say
 */
export function computeNextAvailable ({ site, events, readiness, userId, now = new Date() }) {
  if (!site || !Array.isArray(events)) return { status: 'unknown' }

  const dark = darkWindows(site, now, UPCOMING_WINDOW_HOURS)
  if (!dark.length) return { status: 'unknown' }

  // A reservation this user made is not an obstacle to this user.
  const busy = events
    .filter(event => event.creator_id !== userId)
    .map(event => ({
      start: moment(event.start).valueOf(),
      end: moment(event.end).valueOf()
    }))
    .filter(b => isFinite(b.start) && isFinite(b.end) && b.end > b.start)

  const min_ms = MIN_SESSION_MINUTES * 60 * 1000
  const free = []
  dark.forEach(window => {
    subtractBusy({ start: window.start.getTime(), end: window.end.getTime() }, busy)
      .filter(f => f.end - f.start >= min_ms)
      .forEach(f => free.push(f))
  })

  if (!free.length) return { status: 'unknown' }

  free.sort((a, b) => a.start - b.start)
  const first = free[0]
  const now_ms = now.getTime()

  // "Now" means both that the schedule is clear and that the telescope itself
  // is actually in a fit state to use.
  if (first.start <= now_ms && first.end > now_ms && isUsableNow(readiness)) {
    return { status: 'now' }
  }

  const upcoming = free.find(f => f.start > now_ms)
  if (upcoming) return { status: 'later', start: new Date(upcoming.start) }

  // The only free window is the one containing now, but the telescope is not
  // usable this instant -- so we cannot promise a later time either.
  return { status: 'unknown' }
}

/**
 * The "next free" line on the card, in the reader's own local time.
 *
 * Deliberately the student's clock rather than the observatory's. A student in
 * California being told a telescope in Melbourne is free at "2:15 PM AEST" has
 * to do arithmetic across a date line before knowing whether that is tonight or
 * school time; the whole point of the line is to answer "can I use this, and
 * when", so it is answered in the clock they are looking at.
 *
 * The zone is still named, because a time with no zone on a page about
 * telescopes on the other side of the world is exactly what invites the wrong
 * reading. `z` gives the abbreviation where the zone has one and the UTC offset
 * where it does not.
 */
export function nextAvailableText (next) {
  if (!next) return ''
  if (next.status === 'now') return 'Free right now!'
  if (next.status === 'unknown') return "We couldn't check the schedule"

  const zone = moment.tz.guess()
  const start = moment(next.start).tz(zone)
  const same_day = start.isSame(moment().tz(zone), 'day')
  const at = start.format('h:mm A z')

  return same_day
    ? `Free tonight at ${at}`
    : `Free ${start.format('dddd')} at ${at}`
}
