<template>
  <div class="map-toolbar">
    <h1 class="map-title">
      Active Sites
    </h1>

    <div class="map-filters">
      <b-tooltip
        label="Show only telescopes that are in the dark right now"
        position="is-bottom"
        type="is-black"
        :delay="300"
      >
        <button
          class="button filter-button"
          :class="darkOnly ? 'is-primary' : 'is-light'"
          type="button"
          :aria-pressed="String(darkOnly)"
          @click="$emit('update:darkOnly', !darkOnly)"
        >
          <TelescopeIcon />
          <span class="filter-label">In the dark</span>
        </button>
      </b-tooltip>

      <b-tooltip
        label="Show only telescopes nobody is using right now"
        position="is-bottom"
        type="is-black"
        :delay="300"
      >
        <button
          class="button filter-button"
          :class="bookableOnly ? 'is-primary' : 'is-light'"
          type="button"
          :aria-pressed="String(bookableOnly)"
          :disabled="loading"
          @click="$emit('update:bookableOnly', !bookableOnly)"
        >
          <b-icon
            icon="calendar-month"
            size="is-small"
          />
          <span class="filter-label">Free now</span>
        </button>
      </b-tooltip>
    </div>
  </div>
</template>

<script>
/**
 * The heading and the two map filters.
 *
 * Presentational only: it owns no state and performs no fetching, so which
 * telescopes a filter actually hides stays a question for the map. Both toggles
 * are emitted with .sync-style event names.
 *
 * Lives above the map rather than as a Google Maps custom control: a custom
 * control takes a raw DOM node, which rules out b-button/b-icon/b-tooltip and
 * would mean hand-rolling the listeners and the pressed state.
 */
import TelescopeIcon from '@/components/svg/TelescopeIcon'

export default {
  name: 'MapToolbar',
  components: { TelescopeIcon },
  props: {
    darkOnly: { type: Boolean, default: false },
    bookableOnly: { type: Boolean, default: false },
    // True while the schedules behind the "free now" filter are being fetched.
    loading: { type: Boolean, default: false }
  }
}
</script>

<style lang="scss" scoped>
/* The filters sit directly beside the title rather than being pushed to the
   far edge: on a wide map that put them most of a screen away from the thing
   they filter, with nothing in between to connect them. */
.map-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 1.25em;
  padding: 0.75em 1em 0.5em;
}

/* Deliberately not `.title`: Home.vue carries a scoped `.title` rule setting
   70px Share Tech Mono, which was dead until something used the class. */
.map-title {
  font-size: 2rem;
  font-weight: 600;
  line-height: 1.2;
  margin: 0;
}

.map-filters {
  display: flex;
  gap: 0.5em;
}

.filter-button {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
}

@media screen and (max-width: 480px) {
  .filter-label {
    display: none;
  }
}
</style>
