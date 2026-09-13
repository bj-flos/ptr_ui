<template>
  <div class="site-projects-wrapper">
    <div>
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
    </div>
    <!-- The editable form, in a dialog rather than across half the page. The
         tables are what someone comes here to read; making a project is what
         they come here to do, once, and it does not need to sit open while
         they read. -->
    <b-modal
      v-model="createModalActive"
      :can-cancel="['escape', 'outside', 'x']"
    >
      <create-project-form
        class="create-project-form"
        :sitecode="sitecode"
        :project_to_load="project_to_load"
      />
    </b-modal>

    <div class="projects-events-tables">
      <div class="tables-head">
        <b-button
          type="is-primary"
          icon-left="plus"
          @click="openCreateModal"
        >
          Create New
        </b-button>
      </div>

      <user-projects-table
        class="user-projects-table"
        :user="user"
        @load_project_form="loadProjectForm"
        @inspect_project="inspectProject"
      />

      <div class="user-events-table">
        <h1 class="subtitle">
          Reservations
        </h1>
        <user-events-table :user="user" />
      </div>
    </div>
  </div>
</template>

<script>
import UserEventsTable from '@/components/calendar/UserEventsTable'
import UserProjectsTable from '@/components/projects/UserProjectsTable'
import CreateProjectForm from '@/components/projects/CreateProjectForm'
import { mapState, mapGetters } from 'vuex'
import moment from 'moment'

export default {
  name: 'SiteProjects',
  props: ['sitecode'],
  components: {
    UserEventsTable,
    UserProjectsTable,
    CreateProjectForm
  },
  data () {
    return {
      localTime: '-',
      siteTime: '-',
      utcTime: '-',

      project_to_load: {},
      inspectModalActive: false,
      createModalActive: false
    }
  },
  created () {
    this.timeInterval = setInterval(this.updateTime, 1000)
    window.moment = moment // use moment lib in browser devtools
  },
  mounted () {
    if (this.userIsAuthenticated) {
      this.refreshUserEvents()
      this.refreshUserProjects()
    }
  },
  destroyed () {
    clearInterval(this.timeInterval)
  },
  watch: {
    userId () {
      this.refreshUserEvents()
      this.refreshUserProjects()
    }
  },
  methods: {
    displayUtcTime (time) {
      return moment(time).utc().format('MMM D, kk:mm')
    },
    updateTime () {
      this.localTime = moment().format('MMM D, kk:mm')
      this.siteTime = moment().tz(this.timezone).format('MMM D, kk:mm')
      this.utcTime = moment().utc().format('MMM D, kk:mm')
    },
    inspectProject (project) {
      this.project_to_load = project
      this.inspectModalActive = true
    },
    closeInspectModal () {
      this.inspectModalActive = false
      // return the project params state back to where it was before we opened the modal
      this.$store.dispatch('project_params/reloadProjectDraft')
    },
    /* Editing one of the listed projects opens the same dialog, already
       holding it -- otherwise the table would hand the form a project and
       leave it out of sight. */
    loadProjectForm (project) {
      this.project_to_load = project
      this.createModalActive = true
    },

    /* A blank form. The form clears itself when handed an empty project, which
       is how it tells a new project from one being edited. */
    openCreateModal () {
      this.project_to_load = {
        project: '',
        is_modifying_project: false,
        is_cloned_project: false
      }
      this.createModalActive = true
    },
    refreshUserEvents () {
      this.$store.dispatch('user_data/fetchUserEvents', this.userId)
    },
    refreshUserProjects () {
      this.$store.dispatch('user_data/refreshProjectsTableData', this.userId)
    }
  },
  computed: {
    ...mapGetters('site_config', ['timezone']),
    ...mapState('user_data', [
      'userId',
      'userIsAuthenticated'
    ]),

    user () {
      return this.$auth.user
    }
  }
}
</script>

<style scoped lang="scss">
@import "@/style/_responsive.scss";

.site-projects-wrapper {
  min-height: calc(100vh - #{$top-bottom-height});
  padding: 1em;
  width: calc(100% - 2em);
  margin: 2em 3em;

  /* One column now. The grid existed to stand the form beside the tables; with
     the form in a dialog there is only one thing left to place, and a grid
     whose other area is always empty just leaves a gap where it used to be. */
  display: block;

  @include desktop {
    padding-left: 80px;
  }
}

.tables-head {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1em;
}

.create-project-form {
  margin-bottom: 3em;
}
.projects-events-tables {
  display: flex;
  flex-direction: column;

  @include fullhd {
    margin-top: 4em;
  }
}

.time-display {
  font-size: 1.3em;
}
</style>
