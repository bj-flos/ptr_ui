<template>
  <div class="apply">
    <SiteNavbar />
    <div class="container">
      <!-- Once an application is in, the form is replaced rather than left on
           screen with a notice above it: leaving the fields editable invites a
           second submission of the same application. -->
      <div
        v-if="submitted"
        class="apply-card"
      >
        <h1 class="title is-4">
          Application received
        </h1>
        <p class="apply-lead">
          Thank you, {{ form.first_name }}. We have your application and will
          reply to <strong>{{ form.email }}</strong> once it has been reviewed.
        </p>
        <router-link to="/">
          Back to the map
        </router-link>
      </div>

      <form
        v-else
        class="apply-card"
        novalidate
        @submit.prevent="submit"
      >
        <h1 class="title is-4">
          Apply for access
        </h1>
        <p class="apply-lead">
          Tell us how to reach you and we will be in touch about an observing
          account. Fields marked <span class="req">*</span> are required; the
          rest help us place you on a telescope that suits you.
        </p>

        <h2 class="section-heading">
          About you
        </h2>

        <div class="columns">
          <div class="column">
            <b-field
              label="First name *"
              :type="errors.first_name ? 'is-danger' : ''"
              :message="errors.first_name"
            >
              <b-input
                v-model.trim="form.first_name"
                maxlength="60"
                :has-counter="false"
                autocomplete="given-name"
              />
            </b-field>
          </div>
          <div class="column">
            <b-field
              label="Last name *"
              :type="errors.last_name ? 'is-danger' : ''"
              :message="errors.last_name"
            >
              <b-input
                v-model.trim="form.last_name"
                maxlength="60"
                :has-counter="false"
                autocomplete="family-name"
              />
            </b-field>
          </div>
        </div>

        <div class="columns">
          <div class="column">
            <b-field
              label="Email *"
              :type="errors.email ? 'is-danger' : ''"
              :message="errors.email"
            >
              <!-- type="email" for the mobile keyboard only. The browser's own
                   validation is off (novalidate on the form) so that every
                   message on this page comes from one place. -->
              <b-input
                v-model.trim="form.email"
                type="email"
                maxlength="120"
                :has-counter="false"
                autocomplete="email"
              />
            </b-field>
          </div>
          <div class="column">
            <b-field
              label="Phone *"
              :type="errors.phone ? 'is-danger' : ''"
              :message="errors.phone"
            >
              <b-input
                v-model.trim="form.phone"
                maxlength="30"
                :has-counter="false"
                autocomplete="tel"
              />
            </b-field>
          </div>
        </div>

        <h2 class="section-heading">
          Where you are
          <span class="optional">optional</span>
        </h2>

        <b-field label="Address">
          <b-input
            v-model.trim="form.address"
            maxlength="120"
            :has-counter="false"
            autocomplete="street-address"
          />
        </b-field>

        <div class="columns">
          <div class="column is-5">
            <b-field label="City">
              <b-input
                v-model.trim="form.city"
                maxlength="80"
                :has-counter="false"
                autocomplete="address-level2"
              />
            </b-field>
          </div>
          <div class="column is-4">
            <b-field label="State">
              <b-select
                v-model="form.state"
                placeholder="Select"
                expanded
              >
                <option
                  v-for="s in states"
                  :key="s.abbr"
                  :value="s.abbr"
                >
                  {{ s.name }}
                </option>
              </b-select>
            </b-field>
          </div>
          <div class="column is-3">
            <b-field
              label="ZIP"
              :type="errors.zip ? 'is-danger' : ''"
              :message="errors.zip"
            >
              <b-input
                v-model.trim="form.zip"
                maxlength="10"
                :has-counter="false"
                autocomplete="postal-code"
              />
            </b-field>
          </div>
        </div>

        <div class="columns">
          <div class="column is-3">
            <b-field
              label="Age"
              :type="errors.age ? 'is-danger' : ''"
              :message="errors.age"
            >
              <b-input
                v-model.trim="form.age"
                maxlength="3"
                :has-counter="false"
              />
            </b-field>
          </div>
        </div>

        <h2 class="section-heading">
          If you are a student
          <span class="optional">optional</span>
        </h2>

        <div class="columns">
          <div class="column is-8">
            <b-field label="School">
              <b-input
                v-model.trim="form.school"
                maxlength="120"
                :has-counter="false"
              />
            </b-field>
          </div>
          <div class="column is-4">
            <b-field label="Grade">
              <b-input
                v-model.trim="form.grade"
                maxlength="20"
                :has-counter="false"
              />
            </b-field>
          </div>
        </div>

        <b-field label="Do you belong to BEWiSE?">
          <b-select
            v-model="form.bewise"
            placeholder="Select"
          >
            <option value="yes">
              Yes
            </option>
            <option value="no">
              No
            </option>
          </b-select>
        </b-field>

        <div class="columns">
          <div class="column">
            <b-field
              label="Parent phone"
              :type="errors.parent_phone ? 'is-danger' : ''"
              :message="errors.parent_phone"
            >
              <b-input
                v-model.trim="form.parent_phone"
                maxlength="30"
                :has-counter="false"
              />
            </b-field>
          </div>
          <div class="column">
            <b-field
              label="Parent email"
              :type="errors.parent_email ? 'is-danger' : ''"
              :message="errors.parent_email"
            >
              <b-input
                v-model.trim="form.parent_email"
                type="email"
                maxlength="120"
                :has-counter="false"
              />
            </b-field>
          </div>
        </div>

        <!-- The submit failure goes here, next to the button that caused it,
             rather than at the top of a form long enough to scroll. -->
        <p
          v-if="submitError"
          class="apply-error"
        >
          {{ submitError }}
        </p>

        <b-button
          type="is-primary"
          size="is-medium"
          native-type="submit"
          :loading="sending"
          class="apply-button"
        >
          Apply for Access
        </b-button>
      </form>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import SiteNavbar from '@/components/SiteNavbar'

/* Abbreviations are what a mailing address wants, and the full name is what
   reads properly in a select. DC is included: people live there. */
const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'],
  ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'],
  ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'],
  ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'],
  ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
  ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'],
  ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'], ['WY', 'Wyoming']
].map(([abbr, name]) => ({ abbr, name }))

/* Deliberately loose: one @, something either side, a dot in the domain. A
   stricter pattern rejects addresses that exist, and the address is confirmed
   by replying to it anyway. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default {
  name: 'Apply',
  components: { SiteNavbar },

  data () {
    return {
      states: US_STATES,
      sending: false,
      submitted: false,
      submitError: '',
      errors: {},
      form: {
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        age: '',
        school: '',
        grade: '',
        bewise: '',
        parent_phone: '',
        parent_email: ''
      }
    }
  },

  computed: {
    /* Empty unless a deployment supplies it, which is the same convention as
       every other endpoint in this app -- see store/modules/api_endpoints.js. */
    endpoint () {
      return this.$store.state.api_endpoints.applications_endpoint
    }
  },

  methods: {
    /* Digits only, so that (619) 555-0143, 619-555-0143 and 6195550143 are all
       accepted. 10 digits is a US number, and anything shorter is a typo rather
       than a foreign number, which would be longer. */
    phoneLooksReal (value) {
      return value.replace(/\D/g, '').length >= 10
    },

    validate () {
      const e = {}
      const f = this.form

      if (!f.first_name) e.first_name = 'Please give your first name.'
      if (!f.last_name) e.last_name = 'Please give your last name.'

      if (!f.email) e.email = 'Please give an email address.'
      else if (!EMAIL.test(f.email)) e.email = 'That does not look like an email address.'

      if (!f.phone) e.phone = 'Please give a phone number.'
      else if (!this.phoneLooksReal(f.phone)) e.phone = 'Please give a full phone number, including area code.'

      /* The optional fields are only checked when filled in: an empty one is a
         choice, not a mistake. */
      if (f.zip && !/^\d{5}(-\d{4})?$/.test(f.zip)) e.zip = 'Use 12345 or 12345-6789.'

      if (f.age) {
        const age = Number(f.age)
        if (!Number.isInteger(age) || age < 1 || age > 120) e.age = 'Please give an age in years.'
      }

      if (f.parent_phone && !this.phoneLooksReal(f.parent_phone)) {
        e.parent_phone = 'Please give a full phone number, including area code.'
      }
      if (f.parent_email && !EMAIL.test(f.parent_email)) {
        e.parent_email = 'That does not look like an email address.'
      }

      this.errors = e
      return Object.keys(e).length === 0
    },

    async submit () {
      this.submitError = ''
      if (!this.validate()) {
        /* Send the page to the first problem. A long form can put the failing
           field off screen, and a button that appears to do nothing reads as a
           broken button. */
        this.$nextTick(() => {
          const field = this.$el.querySelector('.is-danger')
          if (field && field.scrollIntoView) {
            field.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        })
        return
      }

      /* No endpoint configured means applications have nowhere to go. Saying so
         is the honest outcome: a confirmation screen here would tell someone
         their application was received when nothing had been sent. */
      if (!this.endpoint) {
        this.submitError = 'Applications are not being accepted online just yet. ' +
          'Please email us and we will set up your account by hand.'
        return
      }

      this.sending = true
      try {
        await axios.post(this.endpoint, this.form, {
          headers: { 'Content-Type': 'application/json;charset=UTF-8' }
        })
        this.submitted = true
      } catch (err) {
        this.submitError = 'We could not send your application. Please try again in a moment.'
        // eslint-disable-next-line no-console
        console.error('[apply] submission failed', err)
      } finally {
        this.sending = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
/* Wider than the sign-in card: this one holds paired fields, and at the 30rem
   the login card uses every column would wrap to its own row. */
.apply-card {
  max-width: 48rem;
  margin: 3rem auto;
  padding: 0 1rem 4rem;
}

.apply-lead {
  margin-bottom: 2rem;
  opacity: 0.85;
}

.section-heading {
  margin: 2rem 0 1rem;
  font-size: 1.1rem;
  font-weight: 700;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  padding-bottom: 0.35rem;
}

/* The word, not a second asterisk: "optional" against a heading is read once,
   where a symbol has to be looked up against the legend at the top. */
.optional {
  font-size: 0.75rem;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.6;
  margin-left: 0.5rem;
}

.req {
  color: #ff5252;
}

.apply-error {
  margin: 1.5rem 0 0;
  color: #ff5252;
}

.apply-button {
  margin-top: 1.5rem;
  min-width: 14rem;
}

/* Bulma collapses the columns to one field per row on a phone; the negative
   margin it uses for the gutter is what needs undoing, so the first field
   lines up with the headings above it. */
.columns {
  margin-left: 0;
  margin-right: 0;
}
</style>
