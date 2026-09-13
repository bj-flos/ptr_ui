<template>
  <section>
    <b-field horizontal>
      <template #label>
        <TrashCheckIcon
          v-if="selected_project.project_priority === 'low_priority'"
          pix-size="45"
          style="margin-top: 5px;"
        />
        <b-icon
          v-if="selected_project.project_priority === 'time_critical'"
          icon="timer"
          class="time-critical-icon"
          size="is-large"
          style="margin-top: 5px;"
        />
      </template>
      <p class="is-family-secondary is-size-2 has-text-weight-bold">
        {{ isNewEvent ? 'New Reservation' : 'Modify Reservation' }}
      </p>
    </b-field>
    <b-field
      horizontal
      label="User"
    >
      <p class="is-family-primary">
        {{ creatorDisplay }}
      </p>
    </b-field>

    <b-field
      horizontal
      label="Observatory"
    >
      <p class="is-family-primary">
        {{ eventDetails.resourceId }}
      </p>
    </b-field>

    <b-field
      horizontal
      label="Event Name"
    >
      <b-input
        ref="title_input"
        v-model="title"
        placeholder="Add a name for your reservation"
        required
        validation-message="Please include a name for your reservation"
      >
        {{ title }}
      </b-input>
    </b-field>

    <hr>

    <b-tabs
      v-model="reservation_type_tabs"
      type="is-boxed"
    >
      <!-- Project Session Tab -->
      <b-tab-item
        v-if="showsTab('project')"
        label="Project Session"
        value="project"
      >
        <!-- The date sits beside the time rather than above both as a single
             "Night of", which could not show a booking whose end fell on the
             following day -- and that is exactly how a 25-hour reservation once
             passed for a one-hour one. -->
        <b-field
          horizontal
          :label="`Start Time (${tzLabel})`"
        >
          <b-field grouped>
            <b-select v-model="startStr">
              <option
                v-for="t in startTimeOptions"
                :key="t.sort"
                :value="t.iso"
              >
                {{ t.hhmm }}
              </option>
            </b-select>
            <b-datepicker
              v-model="startDate"
              class="date-field"
              :date-formatter="formatDate"
              position="is-bottom-right"
            />
          </b-field>
        </b-field>

        <b-field
          horizontal
          :label="`End Time (${tzLabel})`"
        >
          <b-field grouped>
            <b-select v-model="endStr">
              <option
                v-for="t in endTimeOptions"
                :key="t.sort"
                :value="t.iso"
              >
                {{ t.hhmm }}
              </option>
            </b-select>
            <b-datepicker
              v-model="endDate"
              class="date-field"
              :date-formatter="formatDate"
              position="is-bottom-right"
            />
          </b-field>
        </b-field>

        <b-field horizontal>
          {{ eventDuration }}
        </b-field>

        <hr>

        <b-field
          horizontal
          label="Project"
        >
          <div class="project-display">
            <strong>{{ projectsDisplayName }}</strong>
            <span
              v-if="selected_project.project_name !== 'none' && userCanChangeProjectSelected"
              class="clear-project-icon"
              @click="resetProject"
            >
              <b-icon
                icon="close"
                size="is-small"
                custom-class="is-clickable"
              />
            </span>
          </div>
        </b-field>
        <b-field
          horizontal
          label=""
        >
          <div style="display:flex">
            <b-autocomplete
              v-model="projectSearchQuery"
              group-field="group"
              group-options="projects"
              open-on-focus
              style="width: 250px;"
              clearable
              :data="filteredProjects"
              :disabled="!userCanChangeProjectSelected"
              placeholder="...search projects"
              @select="onProjectSelect"
            >
              <template #empty>
                No projects found
              </template>
              <template #default="props">
                <div style="display:flex; justify-content: space-between; gap: 2em;">
                  <span>{{ props.option.project_name }}</span>
                  <span>
                    <TrashCheckIcon
                      v-if="props.option.project_priority === 'low_priority'"
                      class="low-priority-icon"
                    />
                    <b-icon
                      v-if="props.option.project_priority === 'time_critical'"
                      icon="timer"
                      class="time-critical-icon"
                    />
                  </span>
                </div>
              </template>
            </b-autocomplete>
          </div>
        </b-field>

        <hr>
        <b-field
          v-if="userIsAdmin"
          horizontal
        >
          <b-checkbox
            v-model="show_everyones_projects"
            class="pl-3"
            style="color: #aaa; margin-bottom: 1em;"
          >
            [admin] show everyone's projects
          </b-checkbox>
        </b-field>

        <b-field
          label="Note"
          horizontal
        >
          <b-input
            v-model="reservation_note"
            :maxlength="max_fits_header_length"
          />
        </b-field>
      </b-tab-item>

      <!-- Real Time Session Tab -->
      <b-tab-item
        v-if="showsTab('realtime')"
        label="Real Time Session"
        value="realtime"
      >
        <b-field
          horizontal
          :label="`Start Time (${tzLabel})`"
        >
          <b-field grouped>
            <b-select v-model="startStr">
              <option
                v-for="t in startTimeOptions"
                :key="t.sort"
                :value="t.iso"
              >
                {{ t.hhmm }}
              </option>
            </b-select>
            <b-datepicker
              v-model="startDate"
              class="date-field"
              :date-formatter="formatDate"
              position="is-bottom-right"
            />
          </b-field>
        </b-field>
        <b-field
          horizontal
          label="Duration"
        >
          <b-field>
            <b-radio-button
              v-model="real_time_session_duration"
              type="is-primary is-outlined"
              :focused="false"
              :native-value="30"
            >
              30 min
            </b-radio-button>
            <b-radio-button
              v-model="real_time_session_duration"
              type="is-primary is-outlined"
              :focused="false"
              :native-value="45"
            >
              45 min
            </b-radio-button>
            <b-radio-button
              v-model="real_time_session_duration"
              type="is-primary is-outlined"
              :focused="false"
              :native-value="60"
            >
              60 min
            </b-radio-button>
          </b-field>
        </b-field>
      </b-tab-item>

      <!-- Maintenance Window Tab: only ever shown for an enclosure. What is
           scheduled here closes every telescope the wema houses, which is why
           it is stored against the wema and not copied onto each of them. -->
      <b-tab-item
        v-if="showsTab('maintenance')"
        label="Maintenance Window"
        value="maintenance"
      >
        <p class="maintenance-note">
          This reserves {{ site }} and every telescope it houses. Nobody else
          will be able to book time inside it.
        </p>

        <b-field
          horizontal
          :label="`Start Time (${tzLabel})`"
        >
          <b-field grouped>
            <b-select v-model="startStr">
              <option
                v-for="t in startTimeOptions"
                :key="t.sort"
                :value="t.iso"
              >
                {{ t.hhmm }}
              </option>
            </b-select>
            <b-datepicker
              v-model="startDate"
              class="date-field"
              :date-formatter="formatDate"
              position="is-bottom-right"
            />
          </b-field>
        </b-field>

        <b-field
          horizontal
          :label="`End Time (${tzLabel})`"
        >
          <b-field grouped>
            <b-select v-model="endStr">
              <option
                v-for="t in endTimeOptions"
                :key="t.sort"
                :value="t.iso"
              >
                {{ t.hhmm }}
              </option>
            </b-select>
            <b-datepicker
              v-model="endDate"
              class="date-field"
              :date-formatter="formatDate"
              position="is-bottom-right"
            />
          </b-field>
        </b-field>

        <b-field horizontal>
          {{ eventDuration }}
        </b-field>

        <b-field
          label="Comment"
          horizontal
        >
          <b-input
            v-model="reservation_note"
            :maxlength="max_fits_header_length"
            placeholder="What the window is for"
          />
        </b-field>
      </b-tab-item>
    </b-tabs>

    <hr>

    <b-field horizontal>
      <b-field>
        <div class="level">
          <div class="level-left">
            <button
              v-if="isNewEvent"
              class="button is-info r-margin"
              :class="{ 'is-loading': submitIsLoading }"
              :disabled="!userIsAuthenticated"
              @click="handleSubmit"
            >
              submit
            </button>

            <button
              v-if="!isNewEvent"
              class="button is-info r-margin"
              :class="{ 'is-loading': modifyIsLoading }"
              :disabled="!userCanModify"
              @click="handleModify"
            >
              modify event
            </button>

            <button
              class="button is-grey r-margin"
              @click="$emit('cancel')"
            >
              cancel
            </button>
          </div>

          <div class="level-right">
            <button
              v-if="!isNewEvent && !lowPriorityEvent"
              class="button level-item is-danger"
              :class="{ 'is-loading': deleteIsLoading }"
              :disabled="!userCanModify"
              @click="handleDelete"
            >
              remove event
            </button>
          </div>
        </div>
      </b-field>
    </b-field>

    <b-field horizontal>
      <p
        v-if="!userIsAuthenticated"
        class="login-warning"
      >
        Note: you must be authenticated to create and modify events.
      </p>
      <div />
    </b-field>

    <hr>

    <div
      v-if="lowPriorityEvent"
      style="border: 1px solid green; display: flex; padding: 1em; gap: 1em;"
    >
      <p class="low-priority-message">
        The creator of this event has specified that it is OK to remove this event if you'd like to observe during this time.
      </p>
      <button
        v-if="!isNewEvent && lowPriorityEvent"
        :disabled="!userIsAuthenticated"
        class="button level-item is-success"
        :class="{ 'is-loading': deleteIsLoading }"
        @click="handleDelete"
      >
        remove event
      </button>
    </div>
  </section>
</template>

<script>
import axios from 'axios'
import moment from 'moment'
import { mapState, mapGetters } from 'vuex'
import TrashCheckIcon from '@/components/projects/TrashCheckIcon'

export default {
  name: 'CalendarEventEditor',
  components: { TrashCheckIcon },
  props: [
    'eventDetails',
    'isNewEvent',
    // The zone the calendar that opened this is displaying. Normally the same
    // as the site_config getter below; on the home page's booking modal it is
    // the only source, because that getter follows selected_site and nothing is
    // selected there.
    'timezoneOverride',
    // When a reservation is started from one of the calendar's drag tokens the
    // kind is already chosen -- "Manual operation" is a real time session and
    // nothing else -- so the other tab is not an option to offer.
    'lockedType',
    /* Closures on this telescope's enclosure. Read-only here: they are shown
       so a booking cannot be made inside one, not so they can be changed. */
    'maintenanceWindows'
  ],

  data () {
    return {

      // Max length for a fits header string value.
      // Pos 10 to 80, including two single quotes containing the value
      max_fits_header_length: 68,

      real_time_session_duration: 30,

      /* The past-start check is armed only once the editor has finished
         loading: mounted() assigns startStr itself, and an existing booking
         that has already begun is legitimately in the past. Opening one to
         read it must not argue with the reader. */
      startGuardArmed: false,
      // Set while putting a rejected value back, so the watcher ignores its own
      // write instead of chasing it.
      revertingStart: false,
      reservation_type_tabs: 'project',

      show_everyones_projects: false,

      submitIsLoading: false,
      modifyIsLoading: false,
      deleteIsLoading: false,

      id: this.eventDetails.id,
      startStr: moment(this.eventDetails.startStr).utc().format(),
      endStr: moment(this.eventDetails.endStr).utc().format(),
      title: this.eventDetails.title,
      creator: this.eventDetails.creator,
      creator_id: this.eventDetails.creator_id,
      site: this.eventDetails.site,
      resourceId: this.eventDetails.resourceId,
      project_name_and_created: this.eventDetails.project_id,
      reservation_note: this.eventDetails.reservation_note,

      projectSearchQuery: '',
      selected_project: {
        project_name: 'none',
        created_at: ''
      }
    }
  },
  async mounted () {
    this.startStr = moment(this.eventDetails.startStr).tz(this.effectiveTimezone).format()
    this.endStr = moment(this.eventDetails.endStr).tz(this.effectiveTimezone).format()
    // A wema can only ever hold a maintenance window, whatever the drag said.
    this.reservation_type_tabs = this.siteIsWema
      ? 'maintenance'
      : this.eventDetails.reservation_type

    /* A new window opens an hour long and named for whoever is booking it.
       Whatever was dragged on the grid decided the reservation the calendar
       guessed at, which was never a maintenance window -- so its length and
       its title are not answers to this question. Both stay editable. */
    if (this.siteIsWema && this.isNewEvent) {
      this.endStr = moment(this.startStr)
        .tz(this.effectiveTimezone)
        .add(1, 'hour')
        .format()
      this.title = `Maintenance - ${this.creator}`
    }

    // Anything after this point is the reader changing the time themselves.
    this.$nextTick(() => { this.startGuardArmed = true })

    // If an admin opens an event they didn't create, we want them to be able to see the associated project.
    // So we set 'show_everyones_projects' = true
    // Note: this significantly slows down loading times, so always keep disabled by default
    // Compared by id, not by display name: `creator` holds whatever the person
    // was called when the booking was made, which is a nickname on older events
    // and a full name on newer ones.
    if (this.userIsAuthenticated && this.eventDetails.creator_id != this.userId && this.userIsAdmin) {
      this.show_everyones_projects = false
    }

    if (this.reservation_type_tabs === 'project') {
      this.selected_project = await this.getProjectFromId(this.project_name_and_created)
    }
  },

  watch: {

    /* A reservation cannot begin in the past, and nothing stops one being
       chosen: the grid scrolls back as far as anyone cares to drag, and the
       date field will take any day at all. Say so at the point it is picked,
       rather than letting it be submitted and refused later, and put the
       previous value back so the form is never holding a time it has just
       rejected. */
    startStr (next, previous) {
      if (!this.startGuardArmed) return
      if (this.revertingStart) {
        this.revertingStart = false
        return
      }
      if (!this.isNewEvent) return
      if (!previous || next === previous) return
      if (!moment(next).isBefore(moment())) return

      this.$buefy.dialog.alert({
        title: 'That start time has passed',
        message: 'A reservation cannot begin in the past. The start time has been left where it was.',
        type: 'is-danger',
        hasIcon: true,
        icon: 'alert-circle',
        ariaRole: 'alertdialog',
        ariaModal: true
      })

      this.revertingStart = true
      this.$nextTick(() => { this.startStr = previous })
    },

    project_name_and_created (newVal) {
      if (this.project_name_and_created == 'none') {
        this.selected_project = {
          project_name: 'none',
          created_at: ''
        }
      } else {
        this.selected_project = this.getProjectFromId(newVal)
      }
    },
    // Need this to prevent mysterious error "this.projectSearchQuery is undefined"
    // which breaks the autocomplete field
    projectSearchQuery (newVal) {
      if (newVal === undefined) {
        this.projectSearchQuery = ''
      }
    }

  },
  computed: {
    /* Read from the config rather than from the event: a new event carries
       whatever type the calendar guessed when it was dragged, which is never
       "maintenance". */
    siteIsWema () {
      const config = this.$store.state.site_config.global_config || {}
      return config[this.site]?.instance_type === 'wema'
    },

    ...mapState('user_data', [
      'user_projects',
      'all_projects',
      'user_projects_is_loading',
      'all_projects_is_loading',
      'userIsAuthenticated',
      'userIsAdmin',
      'userName',
      'userId'
    ]),
    ...mapGetters('site_config', [
      'timezone'
    ]),
    ...mapGetters('user_data', ['userFullName']),

    /* Every time formatted in here goes through this.
       The store getter reads global_config[selected_site], so on the home page
       -- where nothing is selected -- it is undefined, and moment's .tz() with
       an undefined zone is a *getter*: it returns undefined rather than a
       moment, and the next .format() throws. That is what broke the editor when
       it was opened from the booking modal. Guessing the reader's zone as a
       last resort keeps it from ever being undefined again. */
    /* The zone abbreviation, appended to every time label. These pickers are
       the observatory's clock on a site page and the reader's in the home
       page's booking modal, and an unlabelled "23:41" gives no way to tell
       which -- for a telescope that may be a hemisphere away. */
    tzLabel () {
      return moment().tz(this.effectiveTimezone).format('z')
    },

    effectiveTimezone () {
      const guessed = moment.tz && moment.tz.guess ? moment.tz.guess() : 'UTC'
      return this.timezoneOverride || this.timezone || guessed
    },
    // Whether the user has permission to modify the calendar event
    /* Who to credit. `creator` is whatever the person was called when the
       booking was made -- a nickname on anything created before names were
       stored, which for most accounts is an email local part. For the reader's
       own bookings the store knows better, so prefer that; there is no
       directory to look anyone else up in. */
    creatorDisplay () {
      if (this.creator_id && this.creator_id === this.userId) return this.userFullName
      return this.eventDetails.creator
    },

    userCanModify () {
      return (
        this.userIsAdmin ||
        this.lowPriorityEvent ||
        this.userId == this.creator_id
      )
    },
    lowPriorityEvent () {
      return this.selected_project.project_priority === 'low_priority'
    },
    userProjectsAtThisSite () {
      return this.user_projects.filter(p => {
        return p.project_sites.includes(this.site)
      })
    },
    userProjectsNotAtThisSite () {
      return this.user_projects.filter(p => {
        return !p.project_sites.includes(this.site)
      })
    },
    nonUserProjectsAtThisSite () {
      return this.nonUserProjects.filter(p => {
        return p.project_sites.includes(this.site)
      })
    },
    nonUserProjectsNotAtThisSite () {
      return this.nonUserProjects.filter(p => {
        return !p.project_sites.includes(this.site)
      })
    },
    nonUserProjects () {
      if (!this.show_everyones_projects) return []
      const nonUserProjects = this.all_projects.filter(p => {
        return !this.user_projects.map(up => {
          return `${up.project_name}#${up.created_at}`
        }).includes(`${p.project_name}#${p.created_at}`) })
      return nonUserProjects
    },
    projectsIsLoading () {
      if (this.show_everyones_projects) {
        return this.all_projects_is_loading
      } else {
        return this.user_projects_is_loading
      }
    },
    projectsDisplayName () {
      if (this.selected_project.project_name == 'none') {
        if (['none', 'none#'].includes(this.project_name_and_created)) {
          return '---'
        } else {
          return this.project_name_and_created.split('#')[0]
        }
      } else {
        return this.selected_project.project_name
      }
    },
    // Group projects into the four categories
    groupedProjects () {
      const groupedData = [
        {
          group: `-- My Projects (${this.site}) --`,
          projects: this.userProjectsAtThisSite || []
        },
        {
          group: '-- My Projects (other sites) --',
          projects: this.userProjectsNotAtThisSite || []
        }
      ]

      // Only add these groups if show_everyones_projects is true
      if (this.show_everyones_projects) {
        groupedData.push(
          {
            group: `-- Everyones Projects (${this.site}) --`,
            projects: this.nonUserProjectsAtThisSite || []
          },
          {
            group: '-- Everyones Projects (other sites) --',
            projects: this.nonUserProjectsNotAtThisSite || []
          }
        )
      }

      return groupedData
    },

    // Filter projects based on search query
    filteredProjects () {
      const filtered = []

      this.groupedProjects.forEach((group) => {
        // Filter projects that match the search query
        const matchingProjects = group.projects.filter((project) =>
          project.project_name.toLowerCase().includes(this.projectSearchQuery.toLowerCase())
        )

        // Only add groups that have matching projects
        if (matchingProjects.length) {
          filtered.push({
            group: group.group,
            projects: matchingProjects
          })
        }
      })

      return filtered
    },

    /* The date halves of the two fields. b-datepicker works in plain Dates
       while the values carry a zone, so these translate between the two:
       reading gives the calendar day the value falls on in the event's zone,
       writing moves the day and leaves the time alone. */
    startDate: {
      get () { return this.dateOf(this.startStr) },
      set (date) { this.startStr = this.withDate(this.startStr, date) }
    },

    endDate: {
      get () { return this.dateOf(this.endStr) },
      set (date) { this.endStr = this.withDate(this.endStr, date) }
    },
    startTimeOptions () {
      const startTimes = []
      const selectedEndTime = moment(this.endStr)
      const interval = 5 // 5 minutes
      const range = 2 // hours

      // The value in the middle of our array
      /* Anchored on the time currently chosen, not on the original selection:
         moving the date field moves startStr, and options built around the old
         selection would no longer contain it -- leaving the time select blank. */
      const middleTime = moment(this.startStr).tz(this.effectiveTimezone)
      // The first time in the array.
      const startOption = middleTime.subtract(range, 'h')

      for (let i = 0; i < 2 * range * 60 / interval; i++) {
        // make sure the user can't select negative time intervals.
        if (startOption.isBefore(selectedEndTime)) {
          startTimes.push({
            sort: i,
            iso: startOption.format(),
            hhmm: this.labelFor(startOption),
            // A snapshot: subtract() and add() below mutate this object in
            // place, so the same moment would otherwise be handed to every
            // option and end up reading as the last one.
            moment: startOption.clone()
          })
        }
        // Increment the time for the next loop.
        startOption.add(interval, 'm')
      }
      return startTimes
    },
    endTimeOptions () {
      const endTimes = []
      const selectedStartTime = moment(this.startStr)
      const interval = 5 // 5 minutes
      const range = 2 // hours

      // The value in the middle of our array
      // Anchored on the chosen end, for the reason above.
      const middleTime = moment(this.endStr).tz(this.effectiveTimezone)
      // The first time in the array.
      const endOption = middleTime.subtract(range, 'h')

      for (let i = 0; i < 2 * range * 60 / interval; i++) {
        // make sure the user can't select negative time intervals.
        if (endOption.isAfter(selectedStartTime)) {
          endTimes.push({
            sort: i,
            iso: endOption.format(),
            hhmm: this.labelFor(endOption),
            moment: endOption.clone()
          })
        }
        // Increment the time for the next loop.
        endOption.add(interval, 'm')
      }
      return endTimes
    },
    // Compute an end string from the start time and duration
    realtime_end_string () {
      return moment(this.startStr)
        .add(this.real_time_session_duration, 'm')
        .tz(this.effectiveTimezone)
        .format()
    },
    /* Total length, not the clock components of it.
       duration.hours() is the hours *part* of a duration -- for 25 hours it
       returns 1 -- so a booking that ran over a day boundary was reported here
       as "1h, 0m". With the time pickers labelled HH:mm and nothing else, a
       selection from 21:00 one evening to 22:00 the next read as a one-hour
       slot in every part of this form, and was submitted as 25 hours. */
    eventDuration () {
      const start = moment.tz(this.startStr, this.effectiveTimezone)
      const end = moment.tz(this.endStr, this.effectiveTimezone)
      const total = moment.duration(end.diff(start))
      const minutes = Math.round(total.asMinutes())
      if (minutes < 0) return '(ends before it starts)'
      const h = Math.floor(minutes / 60)
      const m = minutes % 60
      return `(${h}h, ${m}m)`
    },
    modifiedEvent () {
      const end_string = this.reservation_type_tabs == 'realtime' ? this.realtime_end_string : this.endStr
      const project_id = `${this.selected_project.project_name}#${this.selected_project.created_at}`
      const priority = this.selected_project?.project_priority || 'standard'
      const m_event = {
        id: this.id,
        startStr: this.startStr,
        endStr: end_string,
        title: this.title,
        reservation_type: this.reservation_type_tabs,
        creator: this.creator,
        creator_id: this.creator_id,
        site: this.site,
        resourceId: this.resourceId,
        reservation_note: this.reservation_note,
        origin: 'PTR',
        project_id,
        project_priority: priority
      }
      return m_event
    },
    userCanChangeProjectSelected () {
      return this.userIsAdmin || this.creator_id == this.userId
    }
  },
  methods: {
    /* HH:mm on its own cannot say which day it is, which is how a selection
       spanning midnight passed for a one-hour slot. Anything on a different
       date to the event's start gets that date spelled out beside it. */
    /* Just the clock time. The date used to be tacked onto any option that
       fell on another day, because HH:mm alone could not say which day it was
       and that is how a booking over midnight passed for a one-hour one. Each
       field now carries its own date picker, which says it plainly and in one
       place, so repeating it inside the option only made the list wider. */
    labelFor (at) {
      return at.format('HH:mm')
    },

    // The calendar day a value falls on, as a plain Date for the picker.
    dateOf (iso) {
      const at = moment(iso).tz(this.effectiveTimezone)
      return new Date(at.year(), at.month(), at.date())
    },

    // Same clock time, different day.
    withDate (iso, date) {
      if (!date) return iso
      return moment(iso).tz(this.effectiveTimezone)
        .year(date.getFullYear())
        .month(date.getMonth())
        .date(date.getDate())
        .format()
    },

    formatDate (date) {
      return date ? moment(date).format('dddd, MMMM D, YYYY') : ''
    },

    /* Which reservation tabs to offer. Both, unless the caller has already
       settled the question -- dragging "Manual operation" onto the grid says real
       time session and nothing else, so offering a Project Session tab beside
       it invites picking one the drag has already ruled out. */
    /* An enclosure has no telescope of its own to book. The only thing that
       can be scheduled against a wema is a maintenance window, and that is the
       only place one can be scheduled -- it applies to every telescope the
       enclosure houses, so it cannot belong to one of them. */
    showsTab (type) {
      if (this.siteIsWema) return type === 'maintenance'
      if (type === 'maintenance') return false
      return !this.lockedType || this.lockedType === type
    },

    /* Whether a window overlaps the times currently chosen. Touching ends do
       not count: a booking that starts exactly as a closure ends is fine. */
    conflictingWindow () {
      const start = moment(this.startStr).valueOf()
      const end = moment(this.endStr).valueOf()
      const windows = Array.isArray(this.maintenanceWindows) ? this.maintenanceWindows : []
      return windows.find(w => {
        const from = moment(w.start).valueOf()
        const to = moment(w.end).valueOf()
        return start < to && end > from
      }) || null
    },

    resetProject () {
      this.selected_project = { project_name: 'none', created_at: '' }
      this.project_name_and_created = 'none'
    },
    async getProjectFromId (id) {
      if (['none', 'none#'].includes(id)) {
        return { project_name: 'none', created_at: '' }
      }
      // First try to get the project locally.
      const project = this.all_projects.find(p => {
        return id === `${p.project_name}#${p.created_at}`
      })
      if (project) {
        return project
      }

      // If we can't find it locally, then request it from the projects server
      const url = this.$store.state.api_endpoints.projects_endpoint + '/get-project'
      const body = {
        project_name: id.split('#')[0],
        created_at: id.split('#')[1]
      }
      const response = await axios.post(url, body)
      if (response.status == 200) {
        return response.data
      } else {
        return {}
      }
    },
    onProjectSelect (project) {
      if (project) {
        this.selected_project = project
      } else {
        // Handle the "none" option if needed
        this.selected_project = { project_name: 'none' }
      }
      // Explicitly reset the search query
      this.projectSearchQuery = ''

      // this prevents the mysterious error "this.projectSearchQuery is undefined"
      this.$nextTick(() => {
        this.$forceUpdate()
      })
    },
    handleSubmit () {
      const valid_inputs = this.$refs.title_input.checkHtml5Validity()
      if (!valid_inputs) return

      /* The enclosure is shut for maintenance over this time, and the roof
         belongs to the wema rather than to any one telescope under it. Refused
         here rather than accepted and quietly unusable on the night. */
      const clash = this.conflictingWindow()
      if (clash && !this.siteIsWema) {
        const from = moment(clash.start).tz(this.effectiveTimezone).format('HH:mm')
        const to = moment(clash.end).tz(this.effectiveTimezone).format('HH:mm')
        this.$buefy.dialog.alert({
          title: 'The enclosure is closed then',
          message: clash.note
            ? `${clash.wema} has a maintenance window from ${from} to ${to}: ${clash.note}. Please choose a time outside it.`
            : `${clash.wema} has a maintenance window from ${from} to ${to}. Please choose a time outside it.`,
          type: 'is-danger',
          hasIcon: true,
          icon: 'alert-circle',
          ariaRole: 'alertdialog',
          ariaModal: true
        })
        return
      }

      this.submitIsLoading = true
      this.$emit('submit', this.modifiedEvent)
    },
    handleModify () {
      const valid_inputs = this.$refs.title_input.checkHtml5Validity()
      if (valid_inputs) {
        this.modifyIsLoading = true
        const body = {
          modifiedEvent: this.modifiedEvent,
          initialEvent: this.eventDetails
        }
        this.$emit('modify', body)
      }
    },
    handleDelete () {
      this.deleteIsLoading = true
      this.$emit('delete', this.modifiedEvent)
    }
  }
}
</script>

<style lang="scss" scoped>
.maintenance-note {
  margin-bottom: 1.25em;
  opacity: 0.8;
  font-size: 0.85rem;
}

/* Wide enough for "Wednesday, September 10, 2026" without wrapping, which is
   the longest shape the formatter produces. */
.date-field {
  min-width: 16rem;
}

@import "@/style/buefy-styles.scss";
.r-margin {
    margin-right: 1em;
}
.field-group {
    padding-right: 2em;
    padding-bottom: 1em;
}
.login-warning {
    color: #f1b70e;
}
.low-priority-message {
  color: $green;
}

.time-critical-icon {
  fill: $ptr-red;
  color: $ptr-red;
  margin-left: 1em;
}
.low-priority-icon {
  margin-left: 1em;
}
.project-display {
  display: flex;
  align-items: center;
}

.clear-project-icon {
  margin-left: 8px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.clear-project-icon:hover {
  opacity: 1;
}
</style>
