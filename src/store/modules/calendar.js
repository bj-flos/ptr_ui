import moment from 'moment'
import axios from 'axios'
import { computeNextAvailable, UPCOMING_WINDOW_HOURS } from '@/utils/site_schedule'

// This is a 'global' timeout to refresh the reservation list when the
// earliest one expires. It is cleared and recreated whenever
// fetchActiveReservations is run so that we don't end up with a billion
// function calls.
let refresh_reservations_timeout = ''

// How long a fetched schedule is trusted before it is fetched again. The home
// page asks for this on every marker hover, so without a cache a student
// sweeping the pointer across the map would fire a POST per marker crossed.
const UPCOMING_TTL_MS = 60000

// Requests in flight, keyed by sitecode. Deliberately outside `state`: it holds
// promises, which have no business being reactive, and a second hover during
// the first request should await that request rather than start another.
const upcoming_inflight = {}

// initial state
const state = {
  active_reservations: [],

  // { [sitecode]: { fetched_at, events, failed } }
  upcoming_events: {}

}

// getters
const getters = {

  // Boolean: whether the most recently queried site has a reservation.
  hasActiveReservation: state => state.active_reservations.length > 0,

  // List of user names corresponding to active reservations
  usersWithActiveReservation: state => state.active_reservations.map(
    reservation => reservation.creator
  ),

  // List of user ids corresponding to active reservations
  userIDsWithActiveReservation: state => state.active_reservations.map(
    reservation => reservation.creator_id
  ),

  // Function that gets nearest expiration of a user's active reservations
  endOfUserReservation: state => user_id => {
    const end_times = state.active_reservations
      .filter(resv => resv.creator_id == user_id) // only the user's events
      .map(resv => moment(resv.end).valueOf()) // only end times: millis
    return Math.min(...end_times) // get the soonest end time
  },

  // Value (milliseconds since epoch) of soonest ending active reservation
  endOfNextReservation: state => {
    const end_times = state.active_reservations
      .map(resv => moment(resv.end).valueOf())
    return Math.min(...end_times)
  },

  /**
   * When this telescope is next free to observe, as
   * { status: 'now' | 'later' | 'unknown', start? }.
   *
   * Takes the whole site record (not just a code) because darkness needs its
   * coordinates. It answers only "has anyone claimed this time" -- live
   * conditions are a separate question, asked by siteReadiness.
   *
   * Returns 'unknown' rather than guessing whenever the schedule has not been
   * fetched yet or the fetch failed -- callers show that as "we couldn't check"
   * and let the student through rather than blocking on our own uncertainty.
   */
  nextAvailable: (state, getters, rootState) => site => {
    const cached = site ? state.upcoming_events[site.site] : null
    if (!cached || cached.failed) return { status: 'unknown' }

    return computeNextAvailable({
      site,
      events: cached.events,
      userId: rootState.user_data.userId,
      now: new Date()
    })
  },

  /**
   * Whether anyone other than this user holds the telescope right now.
   *
   * Unknown counts as bookable: a schedule we could not read is not evidence
   * that someone booked it, and hiding a telescope for that reason would be
   * indistinguishable from the telescope not existing.
   */
  isBookableNow: (state, getters, rootState) => site => {
    const cached = site ? state.upcoming_events[site.site] : null
    if (!cached || cached.failed) return true

    const now = moment()
    const user_id = rootState.user_data.userId
    return !cached.events.some(event =>
      event.creator_id !== user_id &&
      now.isSameOrAfter(moment(event.start)) &&
      now.isBefore(moment(event.end)))
  }
}

// actions
const actions = {

  /**
     * Get the active reservations at the given site.
     * Note: this is called from TheCalendar (when events views are refreshed)
     * and Site (on load and whenever the sitecode changes).
     *
     * The idea is to keep the list as up-to-date as possible without polling
     * every single second.
     */
  fetchActiveReservations ({ commit, dispatch, rootState }, site) {
    if (!site) {
      console.error('Bad sitecode while trying to fetch active reservations.')
      return
    }

    // Prepare the api call get reservations
    const url = rootState.api_endpoints.calendar_api + '/get-event-at-time'
    const iso_datestring = moment.utc().format()
    const request_body = {
      site,
      time: iso_datestring
    }

    // Send out the api call to get reservations.
    // If the call returns successfully:
    axios.post(url, request_body).then(response => {
      // Save the reservation list.
      commit('setActiveReservations', response.data)

      // If there are current reservations, refresh the list when the
      // earliest one expires.
      if (response.data.length > 0) {
        // List of expirations for current reservations, in millis
        const expirations = response.data.map(reservation =>
          moment(reservation.end).valueOf())
        const soonest = Math.min(...expirations)

        // additional milliseconds before we rescan for reservations
        const buffer_time = 1500
        const time_to_reservation_end = (soonest + buffer_time) - moment().valueOf()

        // Replace any old timeouts. We don't need a million of these.
        clearTimeout(refresh_reservations_timeout)

        // Set the new timeout
        refresh_reservations_timeout = setTimeout(() => {
          dispatch('fetchActiveReservations', site)
        }, time_to_reservation_end)
      }

      // In case the api call to get reservations fails: just log it for now
    }).catch(error => {
      console.warn('error getting active site reservations...')
      console.warn(error)
    })
  },

  /**
   * Fetch this site's bookings for the next day, for the home page.
   *
   * Uses /siteevents rather than /get-event-at-time because the question is not
   * "is it booked now" but "when is it next free", and get-event-at-time can
   * only ever describe the booking covering the instant you ask about.
   *
   * Scheduler observations (the separate /scheduler-observations feed) are
   * deliberately NOT fetched: they are a queue of work the site will get to,
   * not an exclusive hold on the telescope, so counting them as busy would hide
   * telescopes a student could use. Do not "fix" this by adding them.
   */
  async fetchUpcomingEvents ({ state, commit, rootState }, site) {
    if (!site) return

    // The TTL covers failures too, so a site whose schedule is unreachable is
    // not re-requested on every pointer movement across its marker.
    const cached = state.upcoming_events[site]
    if (cached && Date.now() - cached.fetched_at < UPCOMING_TTL_MS) {
      return cached.events
    }
    if (upcoming_inflight[site]) return upcoming_inflight[site]

    const url = rootState.api_endpoints.calendar_api + '/siteevents'
    // The API takes UTC; only the display is ever site-local.
    const request_body = {
      site,
      start: moment.utc().format(),
      end: moment.utc().add(UPCOMING_WINDOW_HOURS, 'hours').format()
    }

    const request = axios.post(url, request_body).then(response => {
      const events = (response.data || []).map(event => ({
        start: event.start,
        end: event.end,
        creator_id: event.creator_id,
        reservation_type: event.reservation_type
      }))
      commit('setUpcomingEvents', { site, events })
      return events
    }).catch(error => {
      console.warn(`error getting upcoming events for ${site}`)
      console.warn(error)
      commit('setUpcomingEventsFailed', site)
      return []
    }).finally(() => {
      delete upcoming_inflight[site]
    })

    upcoming_inflight[site] = request
    return request
  }

}

// mutations
const mutations = {
  setActiveReservations (state, data) {
    state.active_reservations = data
  },

  // Vue 2 cannot see a new key added to an object, and the card renders off
  // this, so the whole map is replaced rather than mutated in place.
  setUpcomingEvents (state, { site, events }) {
    state.upcoming_events = {
      ...state.upcoming_events,
      [site]: { fetched_at: Date.now(), events, failed: false }
    }
  },

  // Recorded rather than left absent so a failure is not retried on every
  // single hover; the TTL applies to failures too.
  setUpcomingEventsFailed (state, site) {
    state.upcoming_events = {
      ...state.upcoming_events,
      [site]: { fetched_at: Date.now(), events: [], failed: true }
    }
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
