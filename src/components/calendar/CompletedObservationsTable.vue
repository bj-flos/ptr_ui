<template>
  <div>
    <b-table
      :data="user_past_events"
      :loading="user_past_events_is_loading"
      :paginated="true"
      :per-page="20"
      class="no-margin"
    >
      <b-table-column
        v-slot="props"
        field="site"
        label="site"
        sortable
      >
        {{ props.row.site }}
      </b-table-column>

      <b-table-column
        v-slot="props"
        field="event name"
        label="event name"
      >
        {{ props.row.title }}
      </b-table-column>

      <b-table-column
        v-slot="props"
        field="reservation_type"
        label="event type"
        sortable
      >
        {{ eventTypeLabel(props.row.reservation_type) }}
      </b-table-column>

      <b-table-column
        v-slot="props"
        field="duration"
        label="duration (h:m)"
        sortable
      >
        {{ displayEventDuration(props.row) }}
      </b-table-column>

      <b-table-column
        v-slot="props"
        field="start"
        label="start"
        sortable
      >
        {{ displayUtcTime(props.row.start) }}
      </b-table-column>

      <b-table-column
        v-slot="props"
        field="end"
        label="end"
        sortable
      >
        {{ displayUtcTime(props.row.end) }}
      </b-table-column>

      <b-table-column
        v-slot="props"
        field="project_id"
        label="project"
      >
        {{ projectName(props.row.project_id) }}
      </b-table-column>

      <template #empty>
        <p class="empty-note">
          Nothing finished in the last year.
        </p>
      </template>
    </b-table>
  </div>
</template>

<script>
/**
 * What the user has already had, newest first.
 *
 * Read-only on purpose: the sibling Reservations table lets a booking be
 * edited and a project attached to it, and neither is a thing to offer for a
 * night that has been and gone.
 */
import moment from 'moment'
import { mapState } from 'vuex'
import { event_type_label } from '@/utils/reservations'

export default {
  name: 'CompletedObservationsTable',

  methods: {
    eventTypeLabel (reservation_type) {
      return event_type_label(reservation_type)
    },

    /* project_id carries its creation time after a '#', which identifies the
       project but is not what anyone calls it. */
    projectName (project_id) {
      if (!project_id || project_id == 'none') { return '—' }
      return String(project_id).split('#')[0]
    },

    displayUtcTime (time) {
      return moment(time).utc().format('MMM D, kk:mm')
    },

    displayEventDuration (event) {
      const ms = moment(event.end).diff(moment(event.start))
      return Math.floor(moment.duration(ms).asHours()) + moment.utc(ms).format(':mm')
    }
  },

  computed: {
    ...mapState('user_data', [
      'user_past_events',
      'user_past_events_is_loading'
    ])
  }
}
</script>

<style scoped>
.empty-note {
  opacity: 0.7;
  font-style: italic;
  padding: 0.75em 0;
}
</style>
