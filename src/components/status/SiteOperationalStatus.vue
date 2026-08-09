<template>
  <div class="online-status-wrapper">
    <div
      class="status-dot"
      :class="operational_status_color_class"
    />
    <p
      class="status-text"
      :class="[operational_status_color_class, { clickable: has_details }]"
      :title="has_details ? 'Click for details' : null"
      @click="toggle_details"
    >
      {{ operational_status }}
      <span
        v-if="has_details"
        class="details-caret"
      >{{ show_details ? '▾' : '▸' }}</span>
    </p>

    <!-- The status is a rollup of several signals; without this there is no
         way to tell which one degraded, or what the site said about it. -->
    <div
      v-if="show_details && has_details"
      class="status-details"
    >
      <div
        v-for="detail in details"
        :key="detail.label"
        class="detail-row"
        :class="{ 'detail-stale': detail.stale }"
      >
        <span class="detail-label">{{ detail.label }}</span>
        <span class="detail-value">{{ detail.value }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
export default {
  name: 'SiteOperationalStatus',
  props: {
    site: {
      type: String,
      default: null
    },
    // Optional: manually insert the operational status value instead of finding in vuex.
    manual_status: {
      type: String,
      default: null
    }
  },

  data () {
    return {
      show_details: false
    }
  },

  computed: {
    ...mapGetters('sitestatus', [
      'site_operational_status'
    ]),

    operational_status () {
      let status
      // Prefer manual status if it is included
      if (this.manual_status !== null) {
        status = this.manual_status
        // Otherwise retrieve from the active site in vuex
      } else {
        status = this.site_operational_status.text
      }
      return status
    },

    details () {
      return this.site_operational_status.details ?? []
    },

    // A manually supplied status has no diagnostics behind it.
    has_details () {
      return this.manual_status === null && this.details.length > 0
    },

    /**
         * operational: green
         * technical difficulty: yellow
         * offline: grey
         */
    operational_status_color_class () {
      return this.site_operational_status.colorClass
    }
  },

  methods: {
    toggle_details () {
      if (this.has_details) {
        this.show_details = !this.show_details
      }
    }
  }
}
</script>

<style scoped>
.status-text.clickable {
  cursor: pointer;
}
.details-caret {
  font-size: 0.75em;
  opacity: 0.7;
}
.status-details {
  margin-top: 0.35em;
  padding: 0.4em 0.6em;
  border-left: 2px solid currentColor;
  font-size: 0.85em;
  line-height: 1.5;
  opacity: 0.9;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 1.5em;
  white-space: nowrap;
}
.detail-label {
  opacity: 0.75;
}
.detail-value {
  font-family: monospace;
}
/* The signals that are actually degraded are the point of opening this. */
.detail-stale .detail-value {
  font-weight: bold;
}
</style>
