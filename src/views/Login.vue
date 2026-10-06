<template>
  <div class="login">
    <SiteNavbar />
    <div class="container">
      <div class="login-card">
        <h1 class="title is-4">
          Sign in to Photon Ranch
        </h1>
        <p class="login-lead">
          Observing accounts are held with our identity provider. Choosing
          <strong>Use Credentials</strong> takes you there to sign in, then
          returns you here. Guests can look around without an account, but
          cannot book time or operate a telescope.
        </p>

        <div class="login-choices">
          <b-button
            type="is-primary"
            size="is-medium"
            :loading="starting"
            expanded
            class="login-button"
            @click="signIn"
          >
            Use Credentials
          </b-button>

          <!-- No account needed, and nothing is granted by it: see
               user_data's isGuest. Second, because an account is the path
               that actually leads anywhere. -->
          <b-button
            size="is-medium"
            expanded
            class="login-button"
            @click="continueAsGuest"
          >
            Login as Guest
          </b-button>
        </div>

        <p
          v-if="error"
          class="login-error"
        >
          {{ error }}
        </p>

        <!-- Linked from here rather than only from a footer: this is the page
             where someone decides whether to hand over an identity, so it is
             where the terms they are agreeing to belong. -->
        <p class="login-legal">
          By signing in you accept our
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

export default {
  name: 'Login',
  components: { SiteNavbar },

  data () {
    return {
      starting: false,
      error: ''
    }
  },

  created () {
    /* Someone already signed in has no business here. Sent back where they
     * came from, or home when they arrived directly. */
    if (this.$auth && this.$auth.isAuthenticated) {
      this.$router.replace(this.returnPath())
    }
  },

  methods: {
    /* Where to land after signing in. Stored before leaving for the provider,
     * because the round trip loses the route otherwise -- arriving back at the
     * home page having asked for a site page is a small thing that reads as a
     * bug. */
    returnPath () {
      const stored = window.localStorage.getItem('ptr_login_redirect_path')
      return stored && stored !== '/login' ? stored : '/'
    },

    /* A guest is not signed in and gains nothing -- the flag only changes
       what the home page shows. Home is the destination rather than the
       stored redirect: the welcome belongs over the map, and a guest sent
       straight to the page they were bounced from would be sent back again
       by the same guard. */
    continueAsGuest () {
      this.$store.commit('user_data/isGuest', true)
      this.$store.commit('user_data/guestWelcomeDismissed', false)
      this.$router.push('/')
    },

    async signIn () {
      this.starting = true
      this.error = ''
      try {
        const from = this.$route.query.redirect || this.returnPath()
        window.localStorage.setItem('ptr_login_redirect_path', from)
        await this.$auth.loginWithRedirect()
      } catch (e) {
        // Leaving the page is the success case, so anything caught here means
        // the redirect never happened and the user is owed an explanation
        // rather than a button that did nothing.
        this.starting = false
        this.error = 'Could not reach the sign-in service. Please try again.'
        // eslint-disable-next-line no-console
        console.error('[login] redirect failed', e)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.login-card {
  max-width: 30rem;
  margin: 3rem auto;
  padding: 2rem;
  text-align: center;
}

.login-lead {
  margin-bottom: 1.5rem;
  opacity: 0.85;
}

/* Stacked rather than side by side: the two are not equal choices, and a row
   would read as though they were. Credentials first, in the reading path. */
.login-choices {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  align-items: center;
}

.login-button {
  min-width: 14rem;
  /* expanded on the buttons makes them fill this, so cap it rather than let
     them stretch to the card. */
  max-width: 18rem;
}

.login-error {
  margin-top: 1rem;
  color: #ff5252;
}

.login-legal {
  margin-top: 2rem;
  font-size: 0.85em;
  opacity: 0.75;
}
</style>
