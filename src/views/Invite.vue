<template>
  <div class="invite">
    <SiteNavbar />
    <div class="container">
      <div class="invite-card">
        <img
          class="invite-logo"
          :src="`${publicPath}img/logos/PTR-logo-asterism.svg`"
          alt="Photon Ranch"
        >

        <div v-if="state === 'verifying'">
          <h1 class="title is-4">
            Accepting your invitation
          </h1>
          <b-loading
            :is-full-page="false"
            active
          />
          <p class="invite-lead">
            One moment.
          </p>
        </div>

        <div v-else-if="state === 'done'">
          <h1 class="title is-4">
            Welcome to Photon Ranch
          </h1>
          <p class="invite-lead">
            Your account is ready. Taking you in.
          </p>
        </div>

        <div v-else-if="state === 'missing'">
          <h1 class="title is-4">
            This link is incomplete
          </h1>
          <p class="invite-lead">
            An invitation link carries a token, and this one arrived without
            it. That usually means the address was copied by hand, or an email
            client shortened it. Open the link from the invitation email
            directly.
          </p>
          <b-button
            tag="router-link"
            to="/login"
            type="is-primary"
          >
            Sign in instead
          </b-button>
        </div>

        <div v-else>
          <h1 class="title is-4">
            This invitation could not be accepted
          </h1>
          <!-- The provider's own words. An invitation that has expired, been
               used already, or belongs to another address are different
               problems with different fixes, and paraphrasing them into one
               message helps nobody. -->
          <p
            v-if="error"
            class="invite-error"
          >
            {{ error }}
          </p>
          <p class="invite-lead">
            Invitations expire. If yours has, ask for a new one; if you already
            accepted it, simply sign in.
          </p>
          <b-button
            tag="router-link"
            to="/login"
            type="is-primary"
          >
            Sign in
          </b-button>
        </div>

        <p class="invite-legal">
          By accepting an invitation you accept our
          <router-link to="/info/terms">
            Terms of Service
          </router-link>
          and
          <router-link to="/info/privacy">
            Privacy Statement
          </router-link>.
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import SiteNavbar from '@/components/SiteNavbar'
import { getInstance } from '@/auth'

export default {
  name: 'Invite',
  components: { SiteNavbar },

  computed: {
    /* public/ is copied verbatim, so webpack never rewrites these URLs.
     * A leading slash resolves at the host root, which is not this app
     * once it is served under a base such as /ptr/. */
    publicPath () {
      return process.env.BASE_URL
    }
  },

  data () {
    return {
      state: 'verifying',
      error: ''
    }
  },

  async mounted () {
    /* Descope sends an invitation as a magic link, and puts the token in `t`.
     * `token` is accepted too because the parameter name is configurable per
     * project and a link that lands here without being understood is a dead
     * end for someone who did nothing wrong. */
    const token = this.$route.query.t || this.$route.query.token
    if (!token) {
      this.state = 'missing'
      return
    }

    try {
      const auth = getInstance()
      const sdk = await auth.ensureClient()
      const res = await sdk.magicLink.verify(token)

      // The SDK reports failure in the response rather than by throwing, so a
      // bare await would look like success on a rejected token.
      if (res && res.ok === false) {
        this.state = 'failed'
        this.error = (res.error && (res.error.errorDescription || res.error.errorMessage)) || ''
        return
      }

      await auth.refreshState()
      this.state = 'done'
      this.$store.dispatch('user_data/newUserLogin', auth.user)

      // Straight in, rather than leaving someone on a success page to find
      // their own way.
      setTimeout(() => { this.$router.replace('/') }, 1200)
    } catch (e) {
      this.state = 'failed'
      this.error = (e && e.message) || ''
      // eslint-disable-next-line no-console
      console.error('[invite] verification failed', e)
    }
  }
}
</script>

<style lang="scss" scoped>
.invite-card {
  position: relative;
  max-width: 30rem;
  margin: 3rem auto;
  padding: 2rem;
  text-align: center;
  min-height: 16rem;
}

.invite-logo {
  display: block;
  width: 220px;
  max-width: 70%;
  margin: 0 auto 1.5rem;
}

.invite-lead {
  margin: 1rem 0 1.5rem;
  opacity: 0.85;
}

.invite-error {
  margin-bottom: 0.75rem;
  color: #ff5252;
}

.invite-legal {
  margin-top: 2rem;
  font-size: 0.85em;
  opacity: 0.75;
}
</style>
