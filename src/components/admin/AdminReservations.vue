<template>
  <div class="reservations">
    <div class="controls">
      <b-button
        size="is-small"
        icon-left="chevron-left"
        @click="shift(-1)"
      >
        Earlier
      </b-button>

      <p class="window-label">
        {{ windowLabel }}
      </p>

      <b-button
        size="is-small"
        icon-right="chevron-right"
        @click="shift(1)"
      >
        Later
      </b-button>

      <b-button
        v-if="offsetHours !== 0"
        size="is-small"
        type="is-text"
        @click="shift(-offsetHours)"
      >
        Now
      </b-button>
    </div>

    <div class="grid">
      <!-- Header: the hour boundaries, in UTC. The label sits at the left edge
           of its own hour, which is where the gridline is. -->
      <div class="row header">
        <div class="site-cell" />
        <div class="track">
          <div
            v-for="tick in ticks"
            :key="tick.key"
            class="tick"
            :style="{ left: tick.left + '%' }"
          >
            <span class="tick-label">{{ tick.label }}</span>
          </div>
        </div>
      </div>

      <p
        v-if="!observatories.length"
        class="empty"
      >
        No telescopes are configured.
      </p>

      <div
        v-for="site in observatories"
        :key="site"
        class="row"
      >
        <div class="site-cell">
          {{ site }}
        </div>
        <div class="track">
          <div
            v-for="(tick, i) in ticks"
            :key="'line-' + i"
            class="gridline"
            :style="{ left: tick.left + '%' }"
          />

          <!-- The current moment, when it is inside the window. Green, as it is
               on the calendar, so the two read the same way. -->
          <div
            v-if="nowLeft !== null"
            class="now-line"
            :style="{ left: nowLeft + '%' }"
          />

          <div
            v-for="bar in barsFor(site)"
            :key="bar.id"
            class="bar"
            :class="{ 'is-mine': bar.mine }"
            :style="{ left: bar.left + '%', width: bar.width + '%' }"
            :title="bar.tooltip"
          >
            <span class="bar-label">{{ bar.label }}</span>
          </div>

          <p
            v-if="!barsFor(site).length && !loading"
            class="nothing"
          >
            nothing booked
          </p>
        </div>
      </div>
    </div>

    <p
      v-if="error"
      class="error"
    >
      {{ error }}
    </p>
  </div>
</template>

<script>
/**
 * What is booked on every telescope over a few hours, on one screen.
 *
 * In UTC throughout, deliberately: this is the view for someone looking after
 * all of them at once, and five telescopes in four zones have no shared local
 * clock to read them in.
 */
import axios from 'axios'
import moment from 'moment-timezone'
import { mapState } from 'vuex'

const WINDOW_HOURS = 12
const REFRESH_MS = 60000

export default {
  name: 'AdminReservations',

  data () {
    return {
      // Hours away from the current hour. Moved by the Earlier/Later buttons.
      offsetHours: 0,
      // Keyed by sitecode; each an array of {start, end, title, creator_id, id}.
      events: {},
      loading: false,
      error: '',
      now: new Date(),
      refreshTimer: null,
      clockTimer: null
    }
  },

  computed: {
    ...mapState('site_config', ['global_config']),
    ...mapState('user_data', ['userId']),

    observatories () {
      const config = this.global_config || {}
      return Object.keys(config)
        .filter(code => config[code]?.instance_type === 'obs')
        .sort()
    },

    windowStart () {
      return moment.utc(this.now).startOf('hour').add(this.offsetHours, 'hours')
    },

    windowEnd () {
      return this.windowStart.clone().add(WINDOW_HOURS, 'hours')
    },

    windowLabel () {
      const from = this.windowStart
      const to = this.windowEnd
      const sameDay = from.isSame(to, 'day')
      return sameDay
        ? `${from.format('ddd D MMM')} · ${from.format('HH:mm')}–${to.format('HH:mm')} UTC`
        : `${from.format('ddd D MMM HH:mm')} – ${to.format('ddd D MMM HH:mm')} UTC`
    },

    /* One tick per hour boundary, including the far edge so the last hour is
       closed rather than trailing off. */
    ticks () {
      const out = []
      for (let i = 0; i <= WINDOW_HOURS; i++) {
        const at = this.windowStart.clone().add(i, 'hours')
        out.push({
          key: at.valueOf(),
          left: (i / WINDOW_HOURS) * 100,
          label: at.format('HH:mm')
        })
      }
      return out
    },

    nowLeft () {
      const pct = this.fraction(this.now) * 100
      return pct >= 0 && pct <= 100 ? pct : null
    }
  },

  watch: {
    offsetHours () {
      this.fetchAll()
    }
  },

  async mounted () {
    await this.fetchAll()
    this.refreshTimer = setInterval(this.fetchAll, REFRESH_MS)
    // Only to move the now-line; the window itself follows the hour it is in.
    this.clockTimer = setInterval(() => { this.now = new Date() }, 30000)
  },

  beforeDestroy () {
    clearInterval(this.refreshTimer)
    clearInterval(this.clockTimer)
  },

  methods: {
    shift (hours) {
      this.offsetHours += hours
    },

    /* Where a moment falls across the window, 0 at the left edge and 1 at the
       right. Outside the window it goes negative or past 1, which is what the
       clamping below is for. */
    fraction (at) {
      const from = this.windowStart.valueOf()
      const span = this.windowEnd.valueOf() - from
      return (moment(at).valueOf() - from) / span
    },

    async fetchAll () {
      const endpoint = this.$store.state.api_endpoints.calendar_api
      if (!endpoint) {
        this.error = 'No calendar endpoint is configured for this deployment.'
        return
      }

      this.loading = true
      this.error = ''

      // An hour of padding either side, so a booking that starts before the
      // window still draws the part of itself that is inside it.
      const start = this.windowStart.clone().subtract(1, 'hour').format()
      const end = this.windowEnd.clone().add(1, 'hour').format()

      try {
        const results = await Promise.all(this.observatories.map(async site => {
          const { data } = await axios.post(`${endpoint}/siteevents`,
            { site, start, end },
            { headers: { 'Content-Type': 'application/json;charset=UTF-8' } })
          return [site, Array.isArray(data) ? data : []]
        }))
        const next = {}
        results.forEach(([site, list]) => { next[site] = list })
        this.events = next
      } catch (e) {
        // The previous reading stays on screen: an empty grid would read as
        // "nothing is booked", which is a different and worse claim.
        this.error = 'Could not reach the calendar. Showing the last reading.'
        console.warn('[admin] reservations fetch failed', e)
      } finally {
        this.loading = false
      }
    },

    barsFor (site) {
      const list = this.events[site] || []
      return list.map(event => {
        const from = Math.max(0, this.fraction(event.start))
        const to = Math.min(1, this.fraction(event.end))
        if (!(to > from)) return null

        const who = event.creator || ''
        const when = `${moment.utc(event.start).format('HH:mm')}–${moment.utc(event.end).format('HH:mm')} UTC`
        return {
          id: event.event_id || `${site}-${event.start}`,
          left: from * 100,
          width: (to - from) * 100,
          mine: event.creator_id === this.userId,
          label: event.title || who || 'reserved',
          tooltip: [event.title, who, when].filter(Boolean).join(' — ')
        }
      }).filter(Boolean)
    }
  }
}
</script>

<style lang="scss" scoped>
@import "@/style/_variables.scss";

.controls {
  display: flex;
  align-items: center;
  gap: 0.75em;
  margin-bottom: 1em;
  flex-wrap: wrap;
}

.window-label {
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}

.row {
  display: flex;
  align-items: stretch;
  min-height: 2.25em;
}

.row.header {
  min-height: 1.75em;
}

.site-cell {
  flex: none;
  width: 7.5rem;
  display: flex;
  align-items: center;
  font-weight: 700;
  font-size: 0.85rem;
}

/* The bars and gridlines are positioned as percentages of this box, so it is
   the one thing that has to be relative. */
.track {
  position: relative;
  flex: 1;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  min-height: 2.25em;
}

.tick {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
}

.tick-label {
  font-size: 0.7rem;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.gridline {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background-color: rgba(255, 255, 255, 0.08);
}

.now-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3px;
  background-color: $green;
  z-index: 2;
}

.bar {
  position: absolute;
  top: 0.3em;
  bottom: 0.3em;
  background-color: rgba(75, 149, 214, 0.55);
  border: 1px solid rgba(75, 149, 214, 0.9);
  border-radius: 3px;
  overflow: hidden;
  display: flex;
  align-items: center;
  padding: 0 0.35em;
  z-index: 1;
}

/* The reader's own bookings, so an admin can pick their own out of a busy
   row without reading every label. */
.bar.is-mine {
  background-color: rgba(46, 204, 113, 0.45);
  border-color: rgba(46, 204, 113, 0.9);
}

.bar-label {
  font-size: 0.7rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nothing {
  position: absolute;
  left: 0.5em;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
  opacity: 0.4;
  font-style: italic;
}

.empty {
  opacity: 0.7;
  font-style: italic;
  padding: 1em 0;
}

.error {
  margin-top: 1em;
  color: #ff5252;
  font-size: 0.85rem;
}

@media (max-width: 700px) {
  .site-cell {
    width: 5rem;
    font-size: 0.75rem;
  }
}
</style>
