<template>
  <div class="login">
    <SiteNavbar />
    <div class="container">
      <div class="login-card">
        <h1 class="title is-4">
          Sign in to Photon Ranch
        </h1>
        <p class="login-lead">
          Observing accounts are held with our identity provider. You will be
          taken there to sign in, then returned here.
        </p>

        <b-button
          type="is-primary"
          size="is-medium"
          :loading="starting"
          class="login-button"
          @click="signIn"
        >
          Continue to sign in
        </b-button>

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

.login-button {
  min-width: 14rem;
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
