import { mapState } from 'vuex'
export const user_mixin = {

  computed: {
    ...mapState('user_data', [
      'userIsAuthenticated',
      'userIsAdmin',
      'userId',
      'userName',
      'userNickname',
      'userGivenName',
      'userEmail',
      'profileUrl'
    ])
  },

  methods: {
    async getAuthRequestHeader () {
      let token
      try {
        token = await this.$auth.getTokenSilently()
      } catch (err) {
        console.warn('Did not acquire the needed token. Stopping request.')

        // small popup notification
        this.$buefy.toast.open({
          duration: 5000,
          message: "Oops! You aren't authorized to do that.",
          position: 'is-bottom',
          type: 'is-danger'
        })
      }
      return {
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'Authorization': `Bearer ${token}`
        }
      }
    },
    /* Sign-in starts on our own page, which carries the logo and the terms
     * being accepted, and hands off to the provider from there. Going straight
     * to the provider would mean a user never sees either. */
    login () {
      const current = this.$router.currentRoute.fullPath
      if (current === '/login') { return }
      this.$router.push({ path: '/login', query: { redirect: current } })
    },
    logout () {
      // save the path we will redirect back to after logout is complete
      window.localStorage.setItem('ptr_logout_redirect_path', this.$router.currentRoute.fullPath)

      // update vuex
      this.$store.dispatch('user_data/logoutUser')

      this.$auth.logout({
        // BASE_URL (publicPath) already ends in a slash. Without it the return
        // lands on the parent host's /logout, which is not this app when it is
        // served under /ptr/. Register the resulting URL as an Allowed Logout
        // URL in the Auth0 tenant.
        returnTo: `${window.location.origin}${process.env.BASE_URL}logout`
      })
    }
  }
}
