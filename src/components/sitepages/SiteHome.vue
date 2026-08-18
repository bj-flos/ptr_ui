<template>
  <div class="site-home-wrapper">
    <div class="level site-welcome-text mt-4 mb-0">
      <div class="level-item">
        {{ site_name }}
      </div>
    </div>

    <div
      class="spacer"
      style="height: 2em;"
    />

    <div class="windy-and-site-events">
      <!-- Windy weather map -->
      <div class="windy-container">
        <iframe
          style="width: 100%; height: 100%;"
          :src="`https://embed.windy.com/embed2.html?lat=${site_latitude}&lon=${site_longitude}&zoom=7&level=surface&overlay=clouds&menu=&message=&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&detailLat=${site_latitude}&detailLon=${site_longitude}&metricWind=m%2Fs&metricTemp=%C2%B0C&radarRange=-1`"
          frameborder="0"
        />
      </div>

      <site-events-modal
        class="site-events"
        :sitecode="sitecode"
      />
    </div>

    <!-- ClearDarkSky chart, shown when the site config names one. -->
    <div
      v-if="clear_sky_chart_id"
      class="level"
    >
      <a :href="clear_sky_chart_key_url">
        <img
          :src="clear_sky_chart_image_url"
          :alt="`Clear Sky Chart for ${site_name}`"
        ></a>
    </div>

    <div style="height: 2em;" />

    <OWMReport />
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { commands_mixin } from '../../mixins/commands_mixin'
import { user_mixin } from '../../mixins/user_mixin'
import SiteEventsModal from '@/components/SiteEventsModal'
import OWMReport from '@/components/status/OWMReport'

export default {
  name: 'SiteHome',
  props: ['sitecode'],
  mixins: [commands_mixin, user_mixin],
  components: {
    SiteEventsModal,
    OWMReport
  },
  computed: {
    ...mapGetters('site_config', [
      'site_latitude',
      'site_longitude',
      'site_name',
      'clear_sky_chart_id'
    ]),
    clear_sky_chart_key_url () {
      return `https://www.cleardarksky.com/c/${this.clear_sky_chart_id}key.html`
    },
    clear_sky_chart_image_url () {
      // The 'c' value identifies PTR as the embedder to cleardarksky.com. It is
      // not per-site, and the image serves fine without it.
      return `https://www.cleardarksky.com/c/${this.clear_sky_chart_id}csk.gif?c=1594801`
    },
    userIsAdmin () {
      return this.$store.state.user_data.userIsAdmin
    }
  }
}

</script>

<style lang="scss" scoped>
@import "@/style/_responsive.scss";
.site-home-wrapper {
  margin: 0 auto;
  width: 88vw;
  max-width: 1150px;
}
.site-welcome-text {
    font: 24px "Share Tech Mono";
    @include tablet {
        font: 34px "Share Tech Mono";
    }
}

.windy-and-site-events {
  display:flex;
  flex-direction: column;
  justify-content: space-between;
  margin-bottom: 4rem;
  gap: 1rem;
  @include tablet {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    grid-gap: 1rem;
  }
}

.windy-container {
    height: 500px;
}
</style>
