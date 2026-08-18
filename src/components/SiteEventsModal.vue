<template>
  <div>
    <b-table
      height="500px"
      :mobile-cards="false"
      :narrowed="true"
      :data="site_events"
      :columns="columns"
      :hoverable="true"
      sticky-header
      default-sort="unix"
    />
    <div
      v-if="site_events.length == 0"
      class="empty-warning"
    >
      No events found in the site config.
    </div>
  </div>
</template>

<script>
import moment from 'moment'
import { mapGetters } from 'vuex'
import { zone_label, browser_zone_label } from '@/utils/timezones'

/* Events that fall on the same instant, in the order they should read.
 *
 * The wema gives Operational Window Start and Cool Down, Open the same moment
 * -- both are cool_down_open -- so sorting by time alone leaves their order to
 * however the config happened to come back, and the round trip through the
 * config store does not preserve the order they were declared in.
 *
 * Anything not listed sorts after what is, alphabetically among itself. */
const TIED_EVENT_ORDER = [
  'cool down, open',
  'operational window start'
]

function tie_rank (key) {
  const index = TIED_EVENT_ORDER.indexOf(key)
  return index == -1 ? TIED_EVENT_ORDER.length : index
}

export default {
  name: 'SiteEventsModal',
  props: ['sitecode'],
  beforeMount () {
    this.getSiteEvents('config')
  },
  watch: {
    sitecode () {
      this.getSiteEvents('config')
    }
  },
  computed: {
    ...mapGetters('site_config', {
      config_site_events: 'site_events',
      timezone: 'timezone'
    }),

    ...mapGetters('sitestatus', [
      'buildRotatorTabStatus'
    ]),

    /* Zone labels for the column headings, so a reader can tell which clock
     * each time is on without knowing where the site is. */
    siteZoneLabel () {
      return zone_label(this.timezone, this.$store.getters['site_config/site_config']?.timezone)
    },

    userZoneLabel () {
      return browser_zone_label()
    },

    columns () {
      return [
        // Widths are fixed so the table does not re-lay out when the site
        // changes: without them each column sizes to its widest cell, and a
        // wema's code is shorter than its instrument's.
        {
          field: 'key',
          label: 'key',
          searchable: false,
          width: '45%',
          cellClass: 'site-events-table-key-cell'
        },
        {
          field: 'time',
          label: 'time',
          searchable: false,
          visible: false,
          sortable: true
        },
        {
          field: 'date',
          // Holds MM/DD, so it needs far less room than it was given.
          label: 'date',
          searchable: false,
          width: '12%',
          sortable: true
        },
        {
          field: 'UTC',
          label: 'UTC',
          searchable: false,
          width: '13%',
          sortable: true
        },
        {
          field: 'observatory',
          label: this.siteZoneLabel ? `site (${this.siteZoneLabel})` : 'site',
          visible: true,
          width: '15%',
          sortable: true
        },
        {
          field: 'user',
          label: this.userZoneLabel ? `user (${this.userZoneLabel})` : 'user',
          visible: true,
          width: '15%',
          sortable: true
        },
        {
          field: 'unix',
          label: 'unix',
          visible: false,
          sortable: true
        }
      ]
    }
  },
  data () {
    return {
      site_events: []
    }
  },
  methods: {
    async getSiteEvents (source = 'config') {
      const tableData = []

      // Configure the time display format
      const formatString = 'HH:mm:ss'

      for (const property in this.config_site_events) {
        const time = moment(this.config_site_events[property])
        // Exclude the 'day_directory' which is not actually a site event
        if (property != 'day_directory') {
          tableData.push({
            key: property.toLowerCase(),
            time: time.format('HH:mm:ss'),
            user: time.format(formatString),
            date: time.format('MM/DD'),
            UTC: time.tz('utc').format(formatString),
            observatory: this.timezone ? time.tz(this.timezone).format(formatString) : 'unknown',
            unix: time.unix()
          })
        }
      }
      // Chronological by absolute time, which is what the UTC column shows.
      // The table's default-sort points at a hidden column, so ordering the
      // rows here does not depend on that still working.
      tableData.sort((a, b) =>
        (a.unix - b.unix) ||
        (tie_rank(a.key) - tie_rank(b.key)) ||
        a.key.localeCompare(b.key))
      this.site_events = tableData
    }
  }
}
</script>

<style scoped>
.empty-warning {
    width: 100%;
    margin: 10px 0;
    color: rgb(255, 239, 20);
    text-align: center;
}

</style>
<style lang="scss">

.site-events-table-key-cell {
    $table-border-color: rgb(85,95,97);
    //font-weight: bold;
    font-style:italic;
    border-right: 4px solid $table-border-color !important;
}
</style>
