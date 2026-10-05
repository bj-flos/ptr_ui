/* What a calendar event's reservation_type means to a reader.
 *
 * The stored values are the scheduler's words, not the interface's: an event
 * booked to drive the telescope by hand is 'realtime', and one that runs a
 * project unattended is 'project'. 'maintenance' is a third the wema writes
 * against an enclosure, and it reaches a user's table whenever one of their
 * events shares a night with it, so it is named here rather than left to fall
 * through as a raw word.
 *
 * Anything unrecognised is returned as it was stored: a value this does not
 * know about is better shown than blanked, since a blank column reads as a
 * fault in the table rather than a gap in this list.
 */
const EVENT_TYPE_LABELS = {
  realtime: 'Manual Control',
  project: 'Project Observation',
  maintenance: 'Maintenance'
}

/* The stored value for a booking the user drives by hand -- an RTS window.
 * Named here rather than written as 'realtime' at each call site, because the
 * value and the label have to be free to differ: this one is spelled
 * 'realtime' in the database and "Manual Control" on screen, and the thing
 * that must never drift is the value compared against the API.
 *
 * It was called five different things until 2026-10-05 -- "Interactive
 * Session" here, "Realtime Session" in the legend, "Real Time Session" in the
 * editor tab, "Interactive Reservation" in the event hover and "Manual
 * control" on the calendar token. If a sixth name is ever wanted, change the
 * label in this file and let it propagate.
 */
export const INTERACTIVE_RESERVATION = 'realtime'

export function is_interactive_reservation (reservation_type) {
  return reservation_type === INTERACTIVE_RESERVATION
}

export function event_type_label (reservation_type) {
  if (!reservation_type) { return '—' }
  return EVENT_TYPE_LABELS[reservation_type] || reservation_type
}
