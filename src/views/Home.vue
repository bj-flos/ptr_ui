<template>
  <div>
    <div class="page-content">
      <SiteNavbar />

      <the-world-map
        name="google"
        class="map-display"
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
import SiteNavbar from '@/components/SiteNavbar'
import SitesOverviewCards from '@/components/SitesOverviewCards'
import { mapGetters } from 'vuex'

export default {
  name: 'Home',
  components: {
    TheWorldMap,
    SiteNavbar,
    SitesOverviewCards
  },

  computed: {
    ...mapGetters('site_config', ['all_sites_real'])
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
}

.sites-overview-cards {
  margin: 1em auto;
  max-width: 90vw;
}
.map-display {
  margin: 2rem auto 0;
  height: 100%;
  max-height: 900px;
  width: 100%;
  // Matches one world at zoom 3 (256 * 2^3). A wider box would be filled with
  // duplicate copies of the world rather than stretched. Width and height are
  // doubled together so the same span of latitude stays visible.
  max-width: 2048px;
}
</style>
