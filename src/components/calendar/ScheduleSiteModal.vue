<template>
  <div class="modal-card schedule-modal">
    <!-- No close control in the header. Bulma lays the head out from the left,
         so a .delete here sat immediately after the title text rather than at
         the far edge, reading as part of the name. Closing is the footer
         button, Escape, or a click outside. -->
    <header class="modal-card-head">
      <div>
        <p class="modal-card-title">
          Book time on {{ site.name }}
          <span class="obs-code">({{ site.site }})</span>
        </p>
        <p class="modal-subtitle">
          {{ subtitle }}
        </p>
      </div>
    </header>

    <section class="modal-card-body">
      <p class="how-to">
        Drag across the calendar to pick your time, then save it.
      </p>

      <the-calendar
        v-if="ready"
        ref="calendar"
        class="the-calendar"
        :calendar-site="site.site"
        :fc_time-zone="timezone"
        local-axis-label="Your Local"
        :site-longitude-override="siteLongitude"
        :site-latitude-override="siteLatitude"
        :forecast-override="forecast"
        :min-time-override="calendarMinTime"
        :max-time-override="calendarMaxTime"
        :scroll-time-override="calendarScrollTime"
        :fc_resources="listOfObservatories"
        :show-moon-events="true"
        :show-weather-forecast="true"
      />
    </section>

    <footer class="modal-card-foot">
      <button
        class="button"
        type="button"
        @click="$emit('close')"
      >
        Close
      </button>
      <button
        class="button is-text"
        type="button"
        @click="openFullCalendar"
      >
        Open the full calendar
      </button>
    </footer>
  </div>
</template>

<script>
/**
 * Booking a telescope without leaving the map.
 *
 * The map is the whole interface for this audience, so sending a student to
 * /site/<code>/calendar to pick a time drops them into the full site UI with no
 * obvious way back. This wraps the same calendar in a modal instead.
 *
 * FullCalendar v4 measures its container at mount and will lay out at zero
 * width inside a modal that is still animating open, so the calendar is not
 * rendered until the modal has settled, and its size is refreshed afterwards.
 * "Open the full calendar" stays as an escape hatch either way.
 */
import TheCalendar from '@/components/calendar/TheCalendar'
import { mapGetters } from 'vuex'
import axios from 'axios'
import moment from 'moment-timezone'
import { darkWindows, siteIsDark } from '@/utils/site_darkness'

/* FullCalendar takes these as durations from midnight, and tolerates hours past
   24 to mean "into the next day" -- 39:00:00 is 3pm tomorrow. */
function asDuration (hours) {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

export default {
  name: 'ScheduleSiteModal',
  components: { TheCalendar },
  props: {
    site: { type: Object, required: true },
    // When the telescope next comes free. Used for the subtitle only; the
    // calendar opens on today either way.
    startTime: { type: Date, default: null }
  },

  data () {
    return {
      ready: false,
      // Fetched here rather than through the store: the store keeps one
      // forecast, for whichever site was last opened, and this modal is for a
      // site nobody has selected. Writing to it would clobber the site page's.
      forecast: []
    }
  },

  computed: {
    ...mapGetters('site_config', ['all_sites']),

    /* The reader's own zone, so the left column of the calendar is the clock
       they are actually looking at -- matching the "next free" line on the map
       card, which is where they arrived from.
       Only the axis changes: FullCalendar places events by absolute time, and
       bookings are submitted in UTC (newEventSelected converts), so the site
       still receives the same instants whichever zone is displayed.
       Deliberately not the site_config `timezone` getter either way -- that one
       follows selected_site, which is whatever site page was last open and has
       nothing to do with the telescope clicked on the map. */
    timezone () {
      return moment.tz.guess() || this.site.TZ_database_name || 'UTC'
    },

    /* The sidereal column is computed against this. Without it the calendar
       falls back to the store's selected-site longitude, which is unset on the
       home page -- the column rendered NaN.NaN. */
    siteLongitude () {
      const lng = Number(this.site.longitude)
      return isFinite(lng) ? lng : null
    },

    // The moon band is computed against these; without them the lookup gets NaN.
    siteLatitude () {
      const lat = Number(this.site.latitude)
      return isFinite(lat) ? lat : null
    },

    /* The site's next full night. Longest rather than first, because if it is
       already dark there the first window is only the remainder of tonight and
       centring on its midpoint would be off by hours. */
    darkWindow () {
      const windows = darkWindows(this.site, new Date(), 36)
      if (!windows.length) return null
      return windows.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a))
    },

    /* Put the site's dark hours down the middle of the column.
       The axis is the reader's clock, so the observatory's night can fall
       anywhere in their day -- a Melbourne night is a Chicago morning. Starting
       the column 12 hours before the middle of that night centres it, which
       leaves the reader's afternoon above it and their morning below. */
    calendarMinTime () {
      if (!this.darkWindow) return null
      const mid = moment((this.darkWindow.start.getTime() + this.darkWindow.end.getTime()) / 2)
        .tz(this.timezone)
      const midHours = mid.hours() + mid.minutes() / 60
      // Floored to the hour: sunset moves a little every day, and a column
      // labelled 15:05, 16:05, 17:05 reads as broken rather than as precise.
      return asDuration(Math.floor((midHours + 12) % 24))
    },

    calendarMaxTime () {
      if (!this.calendarMinTime) return null
      return asDuration(this.minHours + 24)
    },

    // Opens with the night already in view rather than at the top of the column.
    calendarScrollTime () {
      if (!this.darkWindow) return null
      const start = moment(this.darkWindow.start).tz(this.timezone)
      let startHours = start.hours() + start.minutes() / 60
      if (startHours < this.minHours) startHours += 24
      return asDuration(Math.floor(Math.max(this.minHours, startHours - 1)))
    },

    minHours () {
      if (!this.calendarMinTime) return 12
      const [h, m] = this.calendarMinTime.split(':').map(Number)
      return h + m / 60
    },

    /* Why they are being shown a calendar rather than the sky map, in the
       reader's own clock.
       It used to say "Someone is using it right now" whichever reason applied,
       which was simply untrue for the common one: most of the time nothing is
       booked and it is merely still daylight there. Naming the wrong reason and
       then quoting the start of darkness as though it were the end of somebody
       else's session is worse than saying nothing. */
    subtitle () {
      if (!this.startTime) return 'Pick a time that suits you.'

      const start = moment(this.startTime).tz(this.timezone)
      const same_day = start.isSame(moment().tz(this.timezone), 'day')
      const at = start.format('h:mm A z')
      const when = same_day ? `tonight at ${at}` : `${start.format('dddd')} at ${at}`

      if (this.someoneIsObservingNow) {
        return `Someone is using it right now. It's free from ${when}.`
      }
      if (!this.isDarkThereNow) {
        return `It isn't dark there yet. Observing starts ${when}.`
      }
      return `It's free from ${when}.`
    },

    // Is anyone -- including this reader -- booked over this moment?
    someoneIsObservingNow () {
      const cached = this.$store.state.calendar.upcoming_events[this.site.site]
      if (!cached || cached.failed) return false

      const now = moment()
      return cached.events.some(event =>
        now.isSameOrAfter(moment(event.start)) && now.isBefore(moment(event.end)))
    },

    isDarkThereNow () {
      return siteIsDark(this.site, new Date())
    },

    // Same shape SiteCalendar feeds the calendar; the resource timeline views
    // need every observatory, not only the one being booked.
    listOfObservatories () {
      return this.all_sites.map(o => ({
        id: o.site,
        title: o.name,
        eventColor: '#4e1199',
        eventBorderColor: '#200589',
        eventTextColor: '#fbf8fd',
        eventClassNames: '',
        children: '',
        parentId: ''
      }))
    }
  },

  async mounted () {
    this.fetchForecast()

    // One frame after the modal's open transition, so FullCalendar measures a
    // container that has its final width.
    this.readyTimer = setTimeout(() => {
      this.ready = true
      this.$nextTick(() => {
        const api = this.$refs.calendar?.$refs?.fullCalendar?.getApi()
        if (api) api.updateSize()
      })
    }, 350)
  },

  beforeDestroy () {
    clearTimeout(this.readyTimer)
  },

  methods: {
    /* The forecast belongs to the wema, not the individual telescope, which is
       the same shape the store's own fetch uses. A failure here is silent on
       purpose: no bars is exactly what the calendar shows anyway. */
    async fetchForecast () {
      const wema = this.site.wema_name || this.site.site
      const endpoint = this.$store.state.api_endpoints.status_endpoint
      if (!wema || !endpoint) return

      try {
        const response = await axios.get(`${endpoint}/${wema}/forecast`)
        this.forecast = response.data?.status?.forecast || []
      } catch (e) {
        console.warn('booking modal could not load the forecast', e)
        this.warnAboutMissingForecast('unreachable')
        return
      }

      /* Published hours that are still ahead of us. A forecast can be present
         and yet useless: nothing publishes for sites outside the weather
         model's area, so what is left is whatever was last written, days ago.
         Either way the calendar draws no bars, and saying so beats leaving a
         student to wonder where the weather went. */
      const now = moment()
      const usable = this.forecast.filter(hour => moment(hour.utc_long_form).isAfter(now))
      if (!usable.length) this.warnAboutMissingForecast('none published')
    },

    warnAboutMissingForecast (reason) {
      console.warn(`no usable forecast for ${this.site.site}: ${reason}`)
      this.$buefy.toast.open({
        type: 'is-info',
        duration: 7000,
        position: 'is-bottom',
        message: `No weather forecast for ${this.site.name}, so the calendar ` +
          "won't show weather colours. The forecast only covers telescopes in " +
          'North America.'
      })
    },

    openFullCalendar () {
      this.$emit('close')
      this.$router.push(`/site/${this.site.site}/calendar`)
    }
  }
}
</script>

<style lang="scss" scoped>
.schedule-modal {
  width: 90vw;
  max-width: 1200px;
}

.modal-card-body {
  min-height: 60vh;
}

.modal-subtitle {
  font-size: 0.9rem;
  opacity: 0.8;
  margin-top: 0.25em;
}

/* The observatory's own code beside its name. Several of these names read as
   the site rather than the telescope -- "Apache Ridge Observatory" is the
   place, ARO-17 is the instrument -- so the code says which one is being
   booked. */
.obs-code {
  font-size: 0.8em;
  font-weight: normal;
  opacity: 0.75;
  margin-left: 0.5em;
}

.how-to {
  margin-bottom: 0.75em;
}

.the-calendar {
  height: 100%;
}
</style>
