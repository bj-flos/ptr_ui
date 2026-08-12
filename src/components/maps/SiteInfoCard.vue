<template>
  <!-- The root element must exist from the very first render, even with no site
       yet: TheWorldMap hands this element to a Google InfoWindow once and never
       asks for it again. A v-if here would make the first render a comment
       placeholder, and Vue would then swap in a different element that the
       InfoWindow is not holding -- an empty popup. Hence the inner v-if. -->
  <div
    class="site-info-card"
    @mouseenter="$emit('card-enter')"
    @mouseleave="$emit('card-leave')"
  >
    <template v-if="site">
      <div class="card-header">
        <p class="card-name">
          {{ site.name }}
        </p>
        <p class="card-code">
          site code: {{ site.site }}
        </p>
      </div>

      <div class="status-entry">
        <div class="col">
          <div
            v-for="[label] in rows"
            :key="label"
            class="key"
          >
            {{ label }}
          </div>
        </div>
        <div class="col">
          <div
            v-for="[label, value] in rows"
            :key="label"
            class="val"
          >
            <span :style="{ color: value.color }">{{ value.text }}</span>
          </div>
        </div>
      </div>

      <p class="next-free">
        {{ nextFreeText }}
      </p>

      <button
        class="button is-success use-telescope"
        @click="$emit('use-telescope', site)"
      >
        Use this Telescope
      </button>
    </template>
  </div>
</template>

<script>
/**
 * The card shown inside the map's InfoWindow.
 *
 * This used to be an HTML string built by TheWorldMap.renderSiteContent. It
 * needs a button that runs JavaScript, a router navigation, a toast and an
 * async schedule lookup, none of which a string can carry without re-binding
 * listeners by hand on every open.
 *
 * TheWorldMap creates ONE instance of this for the whole map, mounted detached,
 * and mutates `site` as the pointer moves between markers -- so hovering from
 * one telescope to the next patches the existing DOM instead of remounting.
 *
 * It deliberately does not import the router or dispatch navigation itself:
 * router.js -> Home.vue -> TheWorldMap.vue, so importing the router back here
 * would close a cycle. Everything the card cannot do alone it emits upward.
 */
import { mapState, mapGetters } from 'vuex'
import { siteReadiness, readinessRows } from '@/utils/site_availability'
import { nextAvailableText } from '@/utils/site_schedule'

export default {
  name: 'SiteInfoCard',
  props: {
    site: {
      type: Object,
      default: null
    }
  },
  computed: {
    // Read from the store rather than taking a prop, so a status update while
    // the card is open re-renders it in place.
    ...mapState('sitestatus', ['site_open_status']),
    ...mapState('calendar', ['upcoming_events']),
    ...mapGetters('calendar', ['nextAvailable']),

    readiness () {
      return siteReadiness(this.site, this.site_open_status)
    },

    rows () {
      return readinessRows(this.readiness)
    },

    /* The card opens before the schedule has been asked for, so the absence of
       a cache entry means "still looking", not "we failed". Those read very
       differently to a student waiting on the answer. */
    nextFreeText () {
      if (!this.site) return ''
      if (!this.upcoming_events[this.site.site]) return "We're still checking the schedule…"
      return nextAvailableText(this.nextAvailable(this.site, this.readiness), this.site)
    }
  }
}
</script>

<style lang="scss" scoped>
/* Google renders the InfoWindow into its own DOM with a fixed white
   background, so every colour here is stated outright -- inheriting from the
   surrounding dark theme gives white text on white. */
.site-info-card {
  max-width: 260px;
  background-color: white;
  color: black;
}

.card-header {
  padding-bottom: 4px;
  border-bottom: 1px solid black;
}

.card-name {
  color: black;
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.2;
}

.card-code {
  color: #333;
  font-size: 0.9rem;
}

.status-entry {
  font-weight: normal;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  width: 100%;
  margin-top: 1em;
  align-items: center;
}

.col {
  flex-direction: column;
  width: 50%;
}

.status-entry .key {
  color: black;
  padding: 4px 8px;
  white-space: nowrap;
  margin-bottom: 3px;
  text-align: right;
  flex-grow: 1;
  height: 2em;
}

.status-entry .val {
  background-color: black;
  padding: 4px 8px;
  margin-bottom: 3px;
  white-space: nowrap;
  flex-grow: 1;
  height: 2em;
}

.next-free {
  color: black;
  margin-top: 0.75em;
  font-size: 0.95rem;
  text-align: center;
}

.use-telescope {
  font-weight: bold;
  margin-top: 0.5em;
  width: 100%;
}
</style>
