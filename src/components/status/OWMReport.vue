<template>
  <div>
    <div style="margin-bottom: 1em;">
      {{ reportHeading }}

      <!-- Structured report: the wema sends the hours as data and the table
           below is the only place their presentation is decided. -->
      <div v-if="reportHours.length">
        <p class="owm-report-meta">
          <span v-if="report.generated_utc">Forecast retrieved {{ report.generated_utc }} UTC.</span>
          <span v-if="report.night_fitzgerald_number != null">
            Fitzgerald number for the night: {{ report.night_fitzgerald_number }}.
          </span>
        </p>

        <div class="owm-report-scroll">
          <table class="table is-narrow is-fullwidth owm-report-table">
            <thead>
              <tr>
                <th>Hour (UTC)</th>
                <th class="has-text-right">
                  FNumber
                </th>
                <th>Conditions</th>
                <th class="has-text-right">
                  Cloud
                </th>
                <th class="has-text-right">
                  Humidity
                </th>
                <th class="has-text-right">
                  Wind
                </th>
                <th class="has-text-right">
                  Rain
                </th>
                <th>Roof</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="hour in reportHours"
                :key="hour.iso_time || hour.hour_utc"
              >
                <td>{{ hour.hour_utc }}</td>
                <td class="has-text-right">
                  {{ hour.fitzgerald_number }}
                </td>
                <td>{{ hour.description }}</td>
                <td class="has-text-right">
                  {{ percent(hour.cloud_pct) }}
                </td>
                <td class="has-text-right">
                  {{ percent(hour.humidity_pct) }}
                </td>
                <td class="has-text-right">
                  {{ wind(hour.wind_ms) }}
                </td>
                <td class="has-text-right">
                  {{ percent(hour.rain_probability_pct) }}
                </td>
                <td>{{ roofPlan(hour.roof_plan) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="owm-report-meta">
          Roof {{ report.open_at_start ? 'could open' : 'should stay closed' }} at the start of the night.
        </p>
      </div>

      <!-- Reports published before the wema sent structured data are a list of
           already-formatted lines. Show them as they were written. -->
      <pre v-else>{{ legacyReport }}</pre>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { zone_label } from '@/utils/timezones'

export default {
  name: 'OWMReport',
  data () {
    return {
      owmReport: '...loading...'
    }
  },
  computed: {
    ...mapGetters('site_config', [
      'wema_name',
      'timezone'
    ]),

    /* The site's zone, for the heading. */
    siteZoneLabel () {
      return zone_label(this.timezone, this.$store.getters['site_config/site_config']?.timezone)
    },

    /* Names the night the report covers. Falls back to the bare title when the
     * site is still sending the older format, which carries no evening. */
    reportHeading () {
      const evening = this.report.local_evening
      if (!evening) { return 'OpenWeatherMap Report' }
      const zone = this.siteZoneLabel
      return `OpenWeatherMap Report for Evening of ${evening}${zone ? ' ' + zone : ''}`
    },

    /* The structured payload, or an empty object when this site is still
     * sending the older list of rendered lines. */
    report () {
      const report = this.owmReport
      return report && !Array.isArray(report) && typeof report == 'object' ? report : {}
    },

    reportHours () {
      return Array.isArray(this.report.hours) ? this.report.hours : []
    },

    /* Whatever cannot be rendered as a table, shown verbatim. */
    legacyReport () {
      return this.reportHours.length ? '' : this.owmReport
    }
  },
  mounted () {
    this.getOwmReport()
  },
  watch: {
    '$route.params.sitecode' () {
      this.owmReport = '...loading...'
      this.getOwmReport()
    }
  },
  methods: {
    getOwmReport () {
      this.$store.dispatch('sitestatus/getLatestOwmReport').then((res) => {
        this.owmReport = this.$store.getters['sitestatus/owmReport']
      })
    },
    percent (value) {
      return value == null ? '-' : `${Math.round(value)}%`
    },
    wind (value) {
      return value == null ? '-' : `${Number(value).toFixed(1)} m/s`
    },
    roofPlan (plan) {
      if (plan == 'open') { return 'could open' }
      if (plan == 'close') { return 'should close' }
      return ''
    }
  }
}
</script>

<style lang="scss" scoped>
.owm-report-meta {
  font-size: 0.85em;
  opacity: 0.75;
  margin: 0.4em 0;
}
// The table is wider than a phone, so let it scroll rather than the page.
.owm-report-scroll {
  overflow-x: auto;
}
.owm-report-table {
  font-size: 0.85em;
  white-space: nowrap;
}
</style>
