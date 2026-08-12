<template>
  <div>
    <div class="page-content">
      <SiteNavbar />

      <MapToolbar
        :dark-only.sync="darkOnly"
        :bookable-only.sync="bookableOnly"
        :loading="schedulesLoading"
        class="map-toolbar"
      />

      <the-world-map
        name="google"
        :dark-only="darkOnly"
        :bookable-only="bookableOnly"
        class="map-display"
        @use-telescope="onUseTelescope"
        @loading="schedulesLoading = $event"
      />
      <!--leaflet-map name="leafmap"></leaflet-map-->

      <sites-overview-cards
        :sites="all_sites_real"
        class="sites-overview-cards"
      />
    </div>
  </div>
</template>

<script>
import TheWorldMap from '@/components/maps/TheWorldMap'
import MapToolbar from '@/components/maps/MapToolbar'
import SiteNavbar from '@/components/SiteNavbar'
import SitesOverviewCards from '@/components/SitesOverviewCards'
import ScheduleSiteModal from '@/components/calendar/ScheduleSiteModal'
import { mapGetters, mapState } from 'vuex'
import { user_mixin } from '@/mixins/user_mixin'
import { siteReadiness, isUsableNow, unavailableReason } from '@/utils/site_availability'

export default {
  name: 'Home',
  components: {
    TheWorldMap,
    MapToolbar,
    SiteNavbar,
    SitesOverviewCards
  },
  mixins: [user_mixin],

  data () {
    return {
      darkOnly: false,
      bookableOnly: false,
      schedulesLoading: false
    }
  },

  computed: {
    ...mapGetters('site_config', ['all_sites_real']),
    ...mapState('sitestatus', ['site_open_status']),
    ...mapGetters('calendar', ['nextAvailable'])
  },

  methods: {
    /**
     * What "Use this Telescope" does.
     *
     * The order is deliberate: whether the telescope works at all comes before
     * whether it is free. A student told "someone else has it until 9pm" about
     * a telescope that is actually rained off has been told the wrong thing.
     *
     * Navigation lives here rather than in the card because router.js imports
     * this view, which imports the map -- so the map importing the router back
     * would close a cycle.
     */
    onUseTelescope (site) {
      if (!site) return
      if (!this.userIsAuthenticated) {
        this.login()
        return
      }

      const readiness = siteReadiness(site, this.site_open_status)
      if (!isUsableNow(readiness)) {
        this.$buefy.toast.open(unavailableReason(site, readiness))
        return
      }

      const next = this.nextAvailable(site, readiness)
      if (next.status === 'now') {
        this.goToSkyMap(site)
        return
      }
      if (next.status === 'later') {
        this.openScheduler(site, next.start)
        return
      }

      // Unknown: the telescope itself has already passed every check, so the
      // only thing missing is the schedule. Blocking on our own failed lookup
      // would be the least useful thing to do with that.
      this.$buefy.toast.open({
        type: 'is-info',
        duration: 6000,
        position: 'is-bottom',
        message: "We couldn't check the schedule, so we'll take you there anyway."
      })
      this.goToSkyMap(site)
    },

    // "Sky Map" is the `targets` subpage of a site.
    goToSkyMap (site) {
      this.$router.push(`/site/${site.site}/targets`)
    },

    // A modal rather than a route: the map is the whole interface for this
    // audience, and sending them into the full site UI to pick a time is a lot
    // of screen to come back from.
    openScheduler (site, startTime) {
      this.$buefy.modal.open({
        component: ScheduleSiteModal,
        parent: this,
        hasModalCard: true,
        trapFocus: true,
        fullScreen: false,
        props: { site, startTime }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.title {
  font: 70px "Share Tech Mono", monospace;
  /*font: 70px 'Faster One', cursive;*/
  margin: 20px;
}
.page-content {
  position:absolute;
  //top: 75px;
  //height: calc(100vh - 75px);
  // An absolutely positioned box with width:auto and only one of left/right
  // shrink-wraps its content, so a child width:100% resolved against the
  // content rather than the window. Setting both makes the width resolve to
  // the containing block.
  left: 0;
  right: 0;
  height: 100vh;
  overflow-y: auto;

  // The map used to be height:100% of a 100vh box. Adding a heading above it
  // pushed that full height down and spilled the map into the scroll region,
  // so the column now shares the space instead.
  display: flex;
  flex-direction: column;
}

.map-toolbar {
  width: 100%;
  max-width: 2048px;
  margin: 0 auto;
  flex: 0 0 auto;
}

.sites-overview-cards {
  margin: 1em auto;
  max-width: 90vw;
  flex: 0 0 auto;
}
.map-display {
  margin: 0 auto;
  flex: 1 1 auto;
  min-height: 400px;
  max-height: 900px;
  width: 100%;
  // Matches one world at zoom 3 (256 * 2^3). A wider box would be filled with
  // duplicate copies of the world rather than stretched. Width and height are
  // doubled together so the same span of latitude stays visible.
  max-width: 2048px;
}
</style>
