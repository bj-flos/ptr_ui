<template>
  <div>
    <!-- Show whether a site is currently reserved or not -->
    <div class="site-reservation-status-box">
      <!-- Display if there are no current reservations -->
      <div v-if="!hasActiveReservation">
        <p class="menu-label site-not-reserved-notice">
          no active reservations
        </p>
        <p v-if="nextReservationStart">
          Next in: {{ timeUntilNextReservation }}
        </p>
        <p
          v-else
          style="color: #555"
        >
          none scheduled
        </p>
        <div style="height: 5px" />
      </div>

      <!-- Display if the site is currently reserved for use (and not by current user). -->
      <div v-if="hasActiveReservation && !userHasActiveReservation">
        <p class="menu-label site-reserved-notice">
          Site is reserved
        </p>
        <p>Remaining: {{ timeRemainingForSoonestCurrentReservation }}</p>
      </div>

      <!-- Display if the site is currently reserved by the active user -->
      <div v-if="userHasActiveReservation">
        <p class="menu-label site-reserved-current-user">
          Reserved for you
        </p>
        <p>Remaining: {{ userReservationTimeRemaining }}</p>
      </div>

      <div style="height: 5px" />
      <router-link :to="`/site/${sitecode}/calendar`">
        <b-button
          size="is-small"
          class="button is-dark"
          icon-right="calendar"
        >
          view calendar
        </b-button>
      </router-link>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import moment from 'moment'
export default {
  name: 'SiteReservationStatus',
  props: ['sitecode'],
  data () {
    return {
      current_time_millis: moment().valueOf(),
      current_time_millis_updater: '', // setInterval object
      upcoming_events_updater: '' // setInterval object
    }
  },
  created () {
    // Update current_time_millis every second. For reservation countdown.
    this.current_time_millis_updater = setInterval(() => {
      this.current_time_millis = moment().valueOf()
    }, 1000)

    /* What is booked next, for the countdown when nothing is running.
     *
     * fetchUpcomingEvents caches per site for UPCOMING_TTL_MS, which is a
     * minute, so refreshing on that period costs one request and picks up a
     * booking made while this page is open. */
    this.refreshUpcomingEvents()
    this.upcoming_events_updater = setInterval(this.refreshUpcomingEvents, 60000)
  },
  beforeDestroy () {
    // These cleared the wrong things: current_time_millis is a number, not the
    // interval handle beside it, so the ticker outlived the component.
    clearInterval(this.current_time_millis_updater)
    clearInterval(this.upcoming_events_updater)
  },
  watch: {
    sitecode: function () {
      // Refresh the active reservations list for the new site.
      this.$store.dispatch('calendar/fetchActiveReservations', this.sitecode)
      this.refreshUpcomingEvents()
    }
  },
  methods: {
    refreshUpcomingEvents () {
      if (!this.sitecode) { return }
      this.$store.dispatch('calendar/fetchUpcomingEvents', this.sitecode)
    }
  },
  computed: {
    ...mapState('calendar', ['active_reservations', 'upcoming_events']),
    ...mapGetters('calendar', [
      'hasActiveReservation',
      'usersWithActiveReservation',
      'userIDsWithActiveReservation',
      'endOfUserReservation',
      'endOfNextReservation'
    ]),
    ...mapState('user_data', [
      'userId',
      'userIsAuthenticated'
    ]),
    /* The soonest booking that has not started yet, or null.
     *
     * The store holds what fetchUpcomingEvents last saw for this site --
     * everything in the next UPCOMING_WINDOW_HOURS -- so anything already
     * running is filtered out here; that case is the "Remaining" panel. */
    nextReservationStart () {
      const cached = this.upcoming_events[this.sitecode]
      if (!cached || cached.failed || !cached.events.length) { return null }
      const now = this.current_time_millis
      const starts = cached.events
        .map(event => moment(event.start).valueOf())
        .filter(start => start > now)
      return starts.length ? Math.min(...starts) : null
    },

    timeUntilNextReservation () {
      const delta = this.nextReservationStart - this.current_time_millis
      if (!(delta > 0)) { return '0h 0m' }
      const hours = Math.floor(delta / (3600 * 1000))
      const minutes = Math.floor((delta - hours * 3600 * 1000) / (60 * 1000))
      return `${hours}h ${minutes}m`
    },

    userHasActiveReservation () {
      if (this.userIsAuthenticated) {
        return this.userIDsWithActiveReservation.includes(this.userId)
      } else {
        return false
      }
    },
    timeRemainingForSoonestCurrentReservation () {
      const expire_time = this.endOfNextReservation
      const current_time = this.current_time_millis
      const delta = expire_time - current_time
      const millis_per_minute = 60 * 1000
      const millis_per_hour = 3600 * 1000
      const hours_left = Math.floor(delta / millis_per_hour)
      const minutes_left = Math.floor(
        (delta - hours_left * millis_per_hour) / millis_per_minute
      )
      return `${hours_left}h ${minutes_left}m`
    },
    userReservationTimeRemaining () {
      if (this.$auth.isAuthenticated) {
        const expire_time = this.endOfUserReservation(this.userId)
        const current_time = this.current_time_millis
        const delta = expire_time - current_time
        const millis_per_minute = 60 * 1000
        const millis_per_hour = 3600 * 1000
        const hours_left = Math.floor(delta / millis_per_hour)
        const minutes_left = Math.floor(
          (delta - hours_left * millis_per_hour) / millis_per_minute
        )
        return `${hours_left}h ${minutes_left}m`
      } else {
        return '0h 0m'
      }
    },
    // Get the username from Auth0
    username () {
      if (this.$auth.isAuthenticated) {
        return this.$auth.user.name
      }
      return 'anonymous'
    }
  }
}
</script>

<style lang="scss" scoped>
@import "@/style/buefy-styles.scss";
.site-not-reserved-notice {
  color: $info;
}
.site-reserved-notice {
  color: yellow;
}
.site-reserved-current-user {
  color: greenyellow;
}
.site-reservation-status-box {
    border: 2px silver;
    border-radius: 8px;
}
</style>
