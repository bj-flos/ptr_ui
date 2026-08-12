<template>
  <div class="modal-card schedule-modal">
    <header class="modal-card-head">
      <div>
        <p class="modal-card-title">
          Book time on {{ site.name }}
        </p>
        <p class="modal-subtitle">
          {{ subtitle }}
        </p>
      </div>
      <button
        type="button"
        class="delete"
        aria-label="close"
        @click="$emit('close')"
      />
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
import moment from 'moment-timezone'

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
      ready: false
    }
  },

  computed: {
    ...mapGetters('site_config', ['all_sites']),

    // The site's own zone, not the site_config `timezone` getter -- that one
    // follows selected_site, which is whatever site page was last open and has
    // nothing to do with the telescope that was clicked on the map.
    timezone () {
      return this.site.TZ_database_name || 'UTC'
    },

    subtitle () {
      if (!this.startTime) return 'Pick a time that suits you.'
      // The student's clock, matching the map card. The calendar below shows
      // the observatory's own time, which is what booking against a site needs;
      // this line is the plain-language summary, so it stays in the reader's.
      const local = moment.tz.guess()
      const start = moment(this.startTime).tz(local)
      const same_day = start.isSame(moment().tz(local), 'day')
      const at = start.format('h:mm A z')
      const when = same_day
        ? `tonight at ${at}`
        : `${start.format('dddd')} at ${at}`
      return `Someone is using it right now. It's free from ${when}.`
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

  mounted () {
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

.how-to {
  margin-bottom: 0.75em;
}

.the-calendar {
  height: 100%;
}
</style>
