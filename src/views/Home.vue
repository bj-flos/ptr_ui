<template>
  <div>
    <div class="page-content">
      <SiteNavbar />

      <!-- Wrapper exists so the overlay can be positioned over the map and
           the blur applied to the map alone: the navbar above stays sharp and
           usable, because it carries apply and Log in. -->
      <div class="map-region">
        <div
          class="map-layer"
          :class="{ 'map-blurred': showGuestWelcome }"
        >
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
            @schedule-later="onScheduleLater"
            @loading="schedulesLoading = $event"
          />
          <!--leaflet-map name="leafmap"></leaflet-map-->
        </div>

        <GuestWelcomeOverlay
          v-if="showGuestWelcome"
          @dismiss="dismissGuestWelcome"
        />

        <!-- Lower left of the map, arrow up into it. Inside .map-region so it
             is positioned against the map rather than the page, and after the
             welcome so it cannot sit on top of it. -->
        <GuestCallout
          v-if="!showGuestWelcome && guestCalloutVisible('map')"
          direction="up"
          class="guest-callout-map"
          @dismiss="dismissCallout('map')"
        >
          A Web Mercator projection is used to illustrate a map of the world
          with markers representing the location of telescopes. Hovering over
          the icon will allow the user to request time on the selected
          telescope. Clicking on the map and then dragging will scroll the map
          in the direction of the drag. The Sun icon marks where the sun is
          currently overhead, and the shaded bands either side of it are Civil,
          Nautical and Astronomical Twilight, with Full Night beyond them.
        </GuestCallout>
      </div>

      <!-- Every telescope, which is what the map above draws. all_sites_real
           excludes simulated ones, and with five of the six observatories
           simulated the row under the map showed a single card. -->
      <sites-overview-cards
        :sites="all_sites"
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
import GuestWelcomeOverlay from '@/components/GuestWelcomeOverlay'
import GuestCallout from '@/components/GuestCallout'
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
    SitesOverviewCards,
    GuestWelcomeOverlay,
    GuestCallout
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
    ...mapState('user_data', ['isGuest', 'guestWelcomeDismissed']),
    ...mapGetters('user_data', ['guestCalloutVisible']),

    /* Only for a guest who has not dismissed it, and never for someone signed
       in -- a real user who once browsed as a guest should not meet this
       again. isGuest is cleared on sign-in anyway; this is the belt to that
       brace, because the cost of getting it wrong is a logged-in user staring
       at a blurred map. */
    showGuestWelcome () {
      return this.isGuest &&
        !this.guestWelcomeDismissed &&
        !this.userIsAuthenticated
    },

    ...mapGetters('site_config', ['all_sites']),
    ...mapState('sitestatus', ['site_open_status']),
    ...mapGetters('calendar', ['nextAvailable'])
  },

  methods: {
    dismissGuestWelcome () {
      this.$store.commit('user_data/guestWelcomeDismissed', true)
    },

    dismissCallout (id) {
      this.$store.commit('user_data/guestCalloutDismissed', id)
    },

    /**
     * What the card's main button does. Its label says which of these it is.
     *
     * The schedule is checked first. Conditions only gate the paths that would
     * put a student in front of the telescope right now -- booking a slot for
     * later has nothing to do with tonight's cloud, and checking conditions
     * first meant a rained-off telescope whose button read "Schedule Time"
     * answered a click with a weather toast and never opened the calendar.
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

      const next = this.nextAvailable(site)

      // "Schedule Time": booking a later slot, so current conditions are moot.
      if (next.status === 'later') {
        this.openScheduler(site, next.start)
        return
      }

      // Everything below sends them to observe now, which is when being online,
      // clear and open actually matters.
      const readiness = siteReadiness(site, this.site_open_status)
      if (!isUsableNow(readiness)) {
        this.$buefy.toast.open(unavailableReason(site, readiness))
        return
      }

      if (next.status === 'now') {
        this.goToSkyMap(site)
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

    /**
     * "Schedule Later" on a telescope that is free right now.
     *
     * Deliberately not gated on conditions the way onUseTelescope is: booking a
     * slot for tonight or tomorrow has nothing to do with whether it happens to
     * be cloudy at this moment, and refusing to let a student book a rained-off
     * telescope would be the wrong answer to the wrong question.
     */
    onScheduleLater (site) {
      if (!site) return
      if (!this.userIsAuthenticated) {
        this.login()
        return
      }
      // No start time: the point of this button is that the student picks one.
      this.openScheduler(site, null)
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
/* Both wrappers are layout pass-throughs: MapToolbar and the map were direct
   flex children of .page-content, and anything that broke that chain left the
   map at its min-height instead of filling the page. min-height: 0 is the
   usual flex-child fix -- without it the map cannot shrink below its content
   and overflows instead. */
.map-region {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
}

.map-layer {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
}

.guest-callout-map {
  position: absolute;
  /* Clear of the map's own bottom-left furniture -- Google puts its logo and
     terms link there. */
  left: 1rem;
  bottom: 3.5rem;
  z-index: 15;
}

.map-blurred {
  filter: blur(6px);
  /* Not only cosmetic: without this a guest can pan and click a map they
     cannot read, and tab into its controls behind the card. */
  pointer-events: none;
  user-select: none;
}

.map-display {
  margin: 0 auto;
  flex: 1 1 auto;
  // The flex remainder alone left the map ~450px tall once the toolbar and the
  // site cards had taken their share, which is short enough to clip markers
  // off the bottom of the world -- the map went from filling the screen to a
  // letterbox strip. Claiming most of the viewport and letting the cards sit
  // below the fold matches what the page did before the heading was added.
  min-height: 70vh;
  max-height: 900px;
  width: 100%;
  // Matches one world at zoom 3 (256 * 2^3). A wider box would be filled with
  // duplicate copies of the world rather than stretched. Width and height are
  // doubled together so the same span of latitude stays visible.
  max-width: 2048px;
}
</style>
