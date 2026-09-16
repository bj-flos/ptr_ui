<template>
  <div class="cal-page-wrapper">
    <the-calendar
      v-if="timezone"
      class="the-calendar"
      :fc_time-zone="timezone"
      :calendar-site="sitecode"
      :fc_resources="listOfObservatories"
      :show-moon-events="showMoonEvents"
      :show-weather-forecast="showWeatherForecast"
    />

    <div class="calendar-adjacent">
      <site-reservation-status
        :sitecode="sitecode"
        class=""
      />

      <div class="projects-section">
        <p class="menu-label">
          Your Projects
        </p>
        <p
          v-if="!userIsAuthenticated"
          class="projects-hint"
        >
          Sign in to see your projects.
        </p>
        <p
          v-else-if="user_projects_is_loading"
          class="projects-hint"
        >
          Loading your projects…
        </p>
        <p
          v-else-if="!user_projects.length"
          class="projects-hint"
        >
          You have no projects yet. Make one on a telescope's Projects tab and
          it will appear here.
        </p>
        <template v-else>
          <p class="projects-hint">
            Drag a project onto the calendar to schedule it.
          </p>
          <div
            ref="projectPalette"
            class="projects-container"
          >
            <!-- The dataset is what the calendar's drop handler reads: the kind
                 of reservation to open, and which project to put in it. -->
            <!-- Right-click inspects. Left-drag is already taken by the
                 calendar: these tags exist to be dragged onto it, so opening a
                 dialog on click would fight the gesture the palette is for. -->
            <span
              v-for="p in user_projects"
              :key="projectId(p)"
              class="draggable-project-tag tag is-rounded"
              data-reservation-type="project"
              :data-project-id="projectId(p)"
              :title="`${p.project_name} — right-click to inspect`"
              @contextmenu.prevent="inspectProject(p)"
            >
              {{ p.project_name }}
            </span>
          </div>
        </template>
      </div>

      <b-modal
        v-model="inspectModalActive"
        @close="closeInspectModal"
      >
        <create-project-form
          class="create-project-form"
          :sitecode="sitecode"
          :project_to_load="project_to_load"
          :read_only="true"
        />
      </b-modal>

      <div class="fc-settings-box">
        <div>
          <p class="menu-label">
            Settings
          </p>
          <div class="field">
            <b-switch v-model="showMoonEvents">
              Show moon events
            </b-switch>
          </div>
          <div class="field">
            <b-switch v-model="showWeatherForecast">
              Show Weather Forecast
            </b-switch>
          </div>
        </div>
        <div style="border-bottom: 1px solid grey; width: 100%; height: 1em; margin-bottom: 1em;" />
        <p class="menu-label">
          Calendar Behavior
        </p>
        <p>Drag events to <b>move</b></p>
        <p>SHIFT-Drag events to <b>copy</b></p>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import CreateProjectForm from '@/components/projects/CreateProjectForm'
import TheCalendar from '@/components/calendar/TheCalendar'
import SiteReservationStatus from '@/components/calendar/SiteReservationStatus'
import { mapGetters, mapState } from 'vuex'
import { Draggable } from '@fullcalendar/interaction'
import moment from 'moment'

export default {
  name: 'SiteCalendar',
  props: ['sitecode'],
  components: {
    TheCalendar,
    SiteReservationStatus,
    CreateProjectForm
  },
  data () {
    return {
      localTime: '-',
      siteTime: '-',
      utcTime: '-',
      inspectModalActive: false,
      project_to_load: {},

      projectDraggable: null,

      showMoonEvents: true,
      showWeatherForecast: true
    }
  },
  created () {
    this.timeInterval = setInterval(this.updateTime, 1000)
    window.moment = moment // use moment lib in browser devtools
  },
  mounted () {
    // Load the users projects so they can add them to calendar events.
    if (this.userIsAuthenticated) {
      this.$store.dispatch('user_data/fetchUserProjects', this.userId)
    }
    this.refreshProjectDraggable()
  },

  watch: {
    /* The palette only exists once there is something in it, and it is a fresh
       element each time the list changes, so the draggable is rebuilt with it
       rather than left pointing at a node that has been replaced. */
    user_projects () {
      this.refreshProjectDraggable()
    }
  },
  destroyed () {
    clearInterval(this.timeInterval)
    if (this.projectDraggable) {
      this.projectDraggable.destroy()
      this.projectDraggable = null
    }
  },
  methods: {
    /* The form of id the rest of the app uses for a project: its name and when
       it was made, because a name on its own is not unique. */
    projectId (project) {
      return `${project.project_name}#${project.created_at}`
    },

    /* Open one of the palette's projects, read-only.
     *
     * The palette carries a project's name and creation time, not the project,
     * so the whole thing is fetched the same way the Projects tab's inspect
     * button fetches it. The draft is saved first and reloaded on close: the
     * form is shared with the editor, and inspecting a project should not cost
     * someone the one they were part-way through writing.
     */
    inspectProject (project) {
      const project_endpoint = this.$store.state.api_endpoints.projects_endpoint + '/get-project'
      axios.post(project_endpoint, {
        project_name: project.project_name,
        created_at: project.created_at
      }).then(response => {
        this.$store.dispatch('project_params/saveProjectDraft')
        this.project_to_load = { project: response.data }
        this.inspectModalActive = true
      }).catch(err => {
        console.warn('could not load project for inspection: ', err)
      })
    },

    closeInspectModal () {
      this.inspectModalActive = false
      this.$store.dispatch('project_params/reloadProjectDraft')
    },

    /* create:false, exactly as the two tokens above the calendar do it:
       FullCalendar drops nothing of its own, and the drop handler opens the
       editor so that nothing is booked until it is saved. */
    refreshProjectDraggable () {
      if (this.projectDraggable) {
        this.projectDraggable.destroy()
        this.projectDraggable = null
      }
      this.$nextTick(() => {
        const palette = this.$refs.projectPalette
        if (!palette) return
        this.projectDraggable = new Draggable(palette, {
          itemSelector: '.draggable-project-tag',
          eventData: { create: false }
        })
      })
    },

    displayUtcTime (time) {
      return moment(time).utc().format('MMM D, kk:mm')
    },
    updateTime () {
      this.localTime = moment().format('MMM D, kk:mm')

      if (this.timezone) {
        this.siteTime = moment().tz(this.timezone).format('MMM D, kk:mm')
      }
      else {
        this.siteTime = '---'
      }
      this.utcTime = moment().utc().format('MMM D, kk:mm')
    }
  },
  computed: {
    ...mapGetters('site_config', [
      'all_sites',
      'timezone'
    ]),
    ...mapState('user_data', [
      'userIsAuthenticated',
      'userIsAdmin',
      'userId',
      'userName',
      'user_projects',
      'user_projects_is_loading'
    ]),

    // Calendar Resources (Observatories) to feed into the calendar component
    listOfObservatories () {
      const all_obs = []
      this.all_sites.forEach(o => {
        all_obs.push({
          id: o.site,
          title: o.name,
          eventColor: '#4e1199',
          eventBorderColor: '#200589',
          eventTextColor: '#fbf8fd',
          eventClassNames: '',
          children: '',
          parentId: '',
          anyOtherPropsHere:
            'call from key extendedProps of this resource object'
        })
      })
      return all_obs
    }
  }
}
</script>

<style scoped lang="scss">
@import "@/style/_responsive.scss";
@import "@/style/_variables.scss";
@import "@/style/buefy-styles.scss";

$content-view-height: calc(100vh - #{$top-bottom-height});
$content-padding: 2em;
$calendar-height: calc(#{$content-view-height} - #{$content-padding * 2});

.cal-page-wrapper {
  width: 100%;
  padding: $content-padding;
  padding-left: calc($content-padding + 25px); // account for quick sites button column

  @include mobile {
    padding-left: 1.5em;
    padding-right: 1.5em;
  }

  @include tablet {
    display: grid;
    grid-template-rows: 50vh 1fr 1fr;
    grid-template-columns: 1fr;
  }

  @include desktop {
    grid-template-rows: $calendar-height;
  }

  @include fullhd {
    display: grid;
    /* 3:1 rather than 2:1 -- the controls column takes a quarter of the width
       instead of a third, which is a 25% cut, and the calendar keeps it. */
    grid-template-columns: 3fr 1fr;
    grid-template-rows: $calendar-height;
  }
}

.the-calendar {
  @include desktop {
    height: calc(100vh - 360px); //hacky, but make it so you don't need to scroll to see full calendar
  }
}

.calendar-adjacent {
  padding: 2em;
  display:flex;
  gap: 2em;

  @include mobile {
    flex-direction: column;
    padding: 0;
    margin-top: 2em;
  }

  @include tablet {
    flex-direction: row;
    margin: 0;
  }

  @include fullhd {
    flex-direction: column;
    margin: 0;
    margin-top: 2em;
  }

  & > div {
    padding: 1em;
    width: 100%;
    border-radius: 8px;
    background-color:rgba(10,10,10,0.8);
  }
}

.projects-section {
  & .projects-container {
    display: flex;
    gap: 1em;
  }
}

.projects-hint {
  opacity: 0.75;
  font-size: 0.85rem;
  margin-bottom: 0.75em;
}

.draggable-project-tag {
  cursor: grab;
  background-color: $ptr-calendar-project-color !important;
}

#moon-info {
  position: absolute;
  visibility: hidden;
  z-index: 16;
  top: 0px;
  left: 0px;
}
.fc-moon-indicator {
  z-index: 5;
  opacity: 0.5;
  width: 20px;
  border-radius: 12px;
  transition: 0.2s;
}
.fc-moon-indicator:hover {
  opacity: 0.8;
  transition: 0.2s;
}

</style>
