<template>
  <div class="site-status">
    <div class="status-head">
      <p class="hint">
        Each enclosure with the telescopes it houses. Refreshed every 30
        seconds.
      </p>
      <p
        v-if="asOf"
        class="as-of"
      >
        as of {{ asOf }}
      </p>
    </div>

    <p
      v-if="!wemas.length"
      class="empty"
    >
      No sites are reporting.
    </p>

    <div
      v-for="wema in wemas"
      :key="wema.code"
      class="wema-block"
    >
      <div class="row wema-row">
        <span :class="['dot', colorFor(wema.code)]" />
        <span class="code">{{ wema.code }}</span>
        <span class="name">{{ wema.name }}</span>
        <span class="state">{{ enclosureText(wema.code) }}</span>
        <span class="age">{{ freshness(wema.code) }}</span>
      </div>

      <!-- An enclosure with no telescope under it is worth showing rather than
           hiding: it is usually the interesting case. -->
      <p
        v-if="!wema.observatories.length"
        class="row obs-row none"
      >
        no telescopes configured here
      </p>

      <div
        v-for="obs in wema.observatories"
        :key="obs.code"
        class="row obs-row"
      >
        <span :class="['dot', colorFor(obs.code)]" />
        <span class="code">{{ obs.code }}</span>
        <span class="name">{{ obs.name }}</span>
        <span class="state">{{ obsText(obs.code) }}</span>
        <span class="age">{{ freshness(obs.code) }}</span>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Every enclosure and the telescopes it houses, with what each is reporting.
 *
 * The colours are the same getter the map markers and the navbar dropdown use,
 * so a site means the same thing in all three places: green is reporting,
 * yellow is partly stale, grey is silent, and a site that is reporting but shut
 * reads as shut.
 */
import { mapState, mapGetters } from 'vuex'
import moment from 'moment-timezone'

const REFRESH_MS = 30000

export default {
  name: 'AdminSiteStatus',

  data () {
    return {
      asOf: '',
      refreshTimer: null
    }
  },

  computed: {
    ...mapState('site_config', ['global_config']),
    ...mapState('sitestatus', ['site_open_status']),
    ...mapGetters('sitestatus', ['all_sites_status_color']),

    /* Enclosures with their telescopes beneath them. Built from the config
       rather than from the status payload, so a site that has stopped
       reporting altogether still appears -- silent is a state worth seeing. */
    wemas () {
      const config = this.global_config || {}
      const codes = Object.keys(config)

      const wemas = codes
        .filter(code => config[code]?.instance_type === 'wema')
        .map(code => ({
          code,
          name: config[code]?.name || '',
          observatories: codes
            .filter(c => config[c]?.instance_type === 'obs' && config[c]?.wema_name === code)
            .sort()
            .map(c => ({ code: c, name: config[c]?.name || '' }))
        }))
        .sort((a, b) => a.code.localeCompare(b.code))

      /* A telescope whose wema is missing from the config would otherwise
         vanish. Collected under a heading that says so rather than dropped. */
      const housed = new Set(wemas.flatMap(w => w.observatories.map(o => o.code)))
      const orphans = codes
        .filter(c => config[c]?.instance_type === 'obs' && !housed.has(c))
        .sort()
        .map(c => ({ code: c, name: config[c]?.name || '' }))

      if (orphans.length) {
        wemas.push({ code: '—', name: 'no enclosure configured', observatories: orphans })
      }
      return wemas
    }
  },

  async mounted () {
    await this.refresh()
    this.refreshTimer = setInterval(this.refresh, REFRESH_MS)
  },

  beforeDestroy () {
    clearInterval(this.refreshTimer)
  },

  methods: {
    async refresh () {
      try {
        await this.$store.dispatch('sitestatus/getSiteOpenStatus')
        this.asOf = moment.utc().format('HH:mm:ss [UTC]')
      } catch (e) {
        // A failed poll leaves the previous reading on screen, which is more
        // use than blanking the page; the timestamp stops advancing and says so.
        console.warn('[admin] could not refresh site status', e)
      }
    },

    colorFor (code) {
      return this.all_sites_status_color[code] || 'status-grey'
    },

    statusOf (code) {
      return this.site_open_status?.[code] || null
    },

    /* The roof, in the words the payload uses. An observatory inherits its
       enclosure from its wema, so both read the same shutter -- which is the
       point: one physical roof should not be described two ways. */
    enclosureText (code) {
      const status = this.statusOf(code)
      if (!status) return 'not reporting'

      const enclosure = status.enclosure_status
      const parts = []
      if (enclosure?.shutter) parts.push(enclosure.shutter)
      if (enclosure?.mode) parts.push(enclosure.mode.toLowerCase())
      if (enclosure?.shut_reason) parts.push(`(${enclosure.shut_reason})`)
      if (status.wx_ok === false) parts.push('weather not ok')
      return parts.length ? parts.join(' · ') : 'reporting'
    },

    obsText (code) {
      const status = this.statusOf(code)
      if (!status) return 'not reporting'
      const parts = []
      if (status.enclosure_status?.shutter) parts.push(status.enclosure_status.shutter)
      parts.push(status.device ? 'devices reporting' : 'no device status')
      return parts.join(' · ')
    },

    /* The oldest of whatever the site publishes, because a site is only as
       current as its stalest part. */
    freshness (code) {
      const status = this.statusOf(code)
      if (!status) return ''
      const ages = ['enclosure', 'weather', 'device', 'obs_settings', 'wema_settings']
        .map(key => status[key]?.status_age_s)
        .filter(age => typeof age === 'number')
      if (!ages.length) return ''
      const oldest = Math.max(...ages)
      if (oldest < 60) return `${oldest}s ago`
      if (oldest < 3600) return `${Math.round(oldest / 60)}m ago`
      return `${Math.round(oldest / 3600)}h ago`
    }
  }
}
</script>

<style lang="scss" scoped>
@import "@/style/_variables.scss";

.status-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5em;
  margin-bottom: 1.25em;
}

.hint {
  opacity: 0.75;
  font-size: 0.85rem;
}

.as-of {
  opacity: 0.6;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.empty {
  opacity: 0.7;
  font-style: italic;
}

.wema-block {
  margin-bottom: 1.5em;
  border-left: 3px solid rgba(255, 255, 255, 0.15);
}

.row {
  display: flex;
  align-items: center;
  gap: 0.75em;
  padding: 0.4em 0.75em;
}

.wema-row {
  font-weight: 700;
  background-color: rgba(255, 255, 255, 0.04);
}

/* Indented, so the telescopes read as belonging to the enclosure above them
   rather than as more enclosures. */
.obs-row {
  padding-left: 2.25em;
}

.obs-row.none {
  opacity: 0.6;
  font-style: italic;
}

.code {
  min-width: 7ch;
}

.name {
  flex: 1;
  opacity: 0.8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.state {
  opacity: 0.9;
  font-size: 0.85rem;
  text-align: right;
}

.age {
  min-width: 7ch;
  text-align: right;
  opacity: 0.55;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 9999px;
  flex: none;
  background-color: $ptr-grey;
}

.dot.status-green {
  background-color: $ptr-green;
}

.dot.status-yellow {
  background-color: $ptr-yellow;
}

.dot.status-red {
  background-color: $ptr-red;
}

.dot.status-grey {
  background-color: $ptr-grey;
}

@media (max-width: 700px) {
  .name {
    display: none;
  }
}
</style>
