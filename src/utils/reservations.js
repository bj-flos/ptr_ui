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
  realtime: 'Interactive Session',
  project: 'Project Observation',
  maintenance: 'Maintenance'
}

export function event_type_label (reservation_type) {
  if (!reservation_type) { return '—' }
  return EVENT_TYPE_LABELS[reservation_type] || reservation_type
}
