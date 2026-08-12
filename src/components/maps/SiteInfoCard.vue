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
            v-for="row in rows"
            :key="row.label"
            class="key"
          >
            {{ row.label }}
          </div>
        </div>
        <div class="col">
          <div
            v-for="row in rows"
            :key="row.label"
            class="val"
          >
            <span :style="{ color: row.color }">{{ row.text }}</span>
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
        {{ buttonLabel }}
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
 * TheWorldMap renders ONE of these, hidden, inside its own template, and hands
 * this element to the InfoWindow. Rendering it in the tree rather than mounting
 * a detached instance by hand is what makes `site` an ordinary prop with
 * ordinary reactivity; the hand-built version updated its data without the
 * template ever re-rendering, which showed as an empty popup.
 *
 * Because there is one instance for the whole map, moving between markers only
 * changes the prop, so Vue patches the existing DOM rather than remounting.
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

    /* Null while the schedule has not come back yet. The card opens before it
       has even been asked for, so the absence of a cache entry means "still
       looking", not "we failed" -- and those read very differently to a student
       waiting on the answer. */
    next () {
      if (!this.site || !this.upcoming_events[this.site.site]) return null
      return this.nextAvailable(this.site, this.readiness)
    },

    nextFreeText () {
      if (!this.site) return ''
      if (!this.next) return "We're still checking the schedule…"
      return nextAvailableText(this.next, this.site)
    },

    /* The button says what the click will actually do. While the schedule is
       still unknown it stays neutral rather than promising either, because the
       click could still go to either one. */
    buttonLabel () {
      if (this.next && this.next.status === 'now') return 'Use Now'
      if (this.next && this.next.status === 'later') return 'Schedule Time'
      return 'Use this Telescope'
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
