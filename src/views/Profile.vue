<template>
  <div>
    <SiteNavbar />
    <div class="container profile">
      <div class="columns">
        <!-- Left: the few things worth reading at a glance. -->
        <div class="column is-5">
          <div
            v-if="user.picture"
            class="avatar"
          >
            <b-image
              :src="user.picture"
              alt=""
              ratio="1by1"
              :rounded="true"
              :lazy="false"
            />
          </div>

          <dl class="facts">
            <dt>Name:</dt>
            <dd>{{ displayName || notGiven }}</dd>

            <dt>Email:</dt>
            <dd>{{ user.email || notGiven }}</dd>

            <dt>Login Methods:</dt>
            <dd>
              <!-- Indicators, not controls: these describe how the account can
                   be signed into, and nothing here can change that. -->
              <b-checkbox
                :value="hasEmailLogin"
                disabled
              >
                Email
              </b-checkbox>
              <b-checkbox
                :value="hasGoogleLogin"
                disabled
              >
                Google
              </b-checkbox>
              <p
                v-if="!loginIds.length"
                class="caveat"
              >
                No loginIds on this token; read from the subject claim instead.
              </p>
            </dd>

            <dt>Joined:</dt>
            <dd>{{ joined || notGiven }}</dd>
          </dl>
        </div>

        <!-- Right: everything, for when the summary is not enough. -->
        <div class="column is-7">
          <p class="json-label">
            Account record
          </p>
          <pre class="json">{{ userJson }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * What the identity provider says about the signed-in account.
 *
 * The summary on the left is the part anyone actually reads; the record on the
 * right is there because the summary is a reading of it, and someone checking
 * why a login behaves oddly needs the thing itself.
 */
import SiteNavbar from '@/components/SiteNavbar'
import { mapState, mapGetters } from 'vuex'

export default {
  name: 'Profile',
  components: { SiteNavbar },

  data () {
    return {
      notGiven: 'not provided'
    }
  },

  computed: {
    ...mapState('user_data', ['userEmail']),
    ...mapGetters('user_data', ['userFullName']),

    user () {
      return (this.$auth && this.$auth.user) || {}
    },

    userJson () {
      return JSON.stringify(this.user, null, 2)
    },

    displayName () {
      return this.user.name || this.userFullName || this.user.nickname || ''
    },

    /* Descope lists every identifier an account can sign in with here. It is
       not an OIDC claim, so a token that does not carry it leaves this empty
       and the two checkboxes fall back to the subject. */
    loginIds () {
      const ids = this.user.loginIds
      return Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : []
    },

    hasEmailLogin () {
      const email = (this.user.email || this.userEmail || '').toLowerCase()
      if (this.loginIds.length) {
        return !!email && this.loginIds.some(id => id.toLowerCase() === email)
      }
      // Without loginIds, an account that is not federated signed in with one.
      return !!email && !this.subjectIsGoogle
    },

    hasGoogleLogin () {
      if (this.loginIds.length) {
        return this.loginIds.some(id => id.toLowerCase().startsWith('google-'))
      }
      return this.subjectIsGoogle
    },

    subjectIsGoogle () {
      return typeof this.user.sub === 'string' && this.user.sub.startsWith('google-')
    },

    /* The date only. createdTime arrives as seconds on some connections and
       milliseconds on others, and as an ISO string on a third, so each is
       handled rather than guessed at: a number small enough to be seconds is
       treated as seconds. */
    joined () {
      const raw = this.user.createdTime ?? this.user.created_at ?? this.user.createdAt
      if (raw === undefined || raw === null || raw === '') return ''

      let date
      if (typeof raw === 'number') {
        date = new Date(raw < 1e12 ? raw * 1000 : raw)
      } else {
        const asNumber = Number(raw)
        date = isFinite(asNumber) && raw !== ''
          ? new Date(asNumber < 1e12 ? asNumber * 1000 : asNumber)
          : new Date(raw)
      }
      if (isNaN(date.getTime())) return ''

      const pad = n => String(n).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    }
  }
}
</script>

<style lang="scss" scoped>
.profile {
  padding: 2rem 1rem 3rem;
}

.avatar {
  width: 140px;
  margin-bottom: 1.5rem;
}

/* A two-column list rather than a table: the labels are short and fixed, and a
   table draws rules nobody needs around four rows. */
.facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.6rem 1rem;
  align-items: start;
}

.facts dt {
  font-weight: 700;
  white-space: nowrap;
}

.facts dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.caveat {
  font-size: 0.75rem;
  opacity: 0.6;
  margin-top: 0.35rem;
}

.json-label {
  font-weight: 700;
  margin-bottom: 0.5rem;
}

/* Scrolls in both directions: the record is deep, and a long token value has
   no sensible place to wrap. */
.json {
  max-height: 28rem;
  overflow: auto;
  font-size: 0.75rem;
  line-height: 1.45;
  padding: 0.75rem;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

@media (max-width: 768px) {
  .json {
    max-height: 18rem;
  }
}
</style>
