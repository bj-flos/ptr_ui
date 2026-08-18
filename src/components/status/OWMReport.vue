<template>
  <div>
    <div style="margin-bottom: 1em;">
      OpenWeatherMap Report

      <!-- Structured report: the wema sends the hours as data and the table
           below is the only place their presentation is decided. -->
      <div v-if="reportHours.length">
        <p class="owm-report-meta">
          <span v-if="report.local_evening">Local evening of {{ report.local_evening }}.</span>
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
          Roof would {{ report.open_at_start ? 'open' : 'stay shut' }} at the start of the night.
        </p>
      </div>

      <!-- Reports published before the wema sent structured data are a list of
           already-formatted lines. Show them as they were written. -->
      <pre v-else>{{ legacyReport }}</pre>
    </div>

    <div style="margin-bottom: 1em;">
      <b-button @click="showOwmStatus">
        (alternate method) show OpenWeatherMap Status
      </b-button>
    </div>
    <b-modal v-model="owmModalVisible">
      <pre>{{ legacyReport }}</pre>
    </b-modal>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'OWMReport',
  data () {
    return {
      owmModalVisible: false,
      owmReport: '...loading...'
    }
  },
  computed: {
    ...mapGetters('site_config', [
      'wema_name'
    ]),

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
    showOwmStatus () {
      this.owmModalVisible = true
    },
    percent (value) {
      return value == null ? '-' : `${Math.round(value)}%`
    },
    wind (value) {
      return value == null ? '-' : `${Number(value).toFixed(1)} m/s`
    },
    roofPlan (plan) {
      if (plan == 'open') { return 'would open' }
      if (plan == 'close') { return 'would close' }
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
