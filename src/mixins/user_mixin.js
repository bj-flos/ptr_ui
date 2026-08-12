import { mapState } from 'vuex'
export const user_mixin = {

  computed: {
    ...mapState('user_data', [
      'userIsAuthenticated',
      'userIsAdmin',
      'userId',
      'userName',
      'userNickname',
      'userEmail',
      'profileUrl'
    ]),

    /* userName is the Auth0 nickname, which for most accounts is the local part
       of an email address -- "bj.kowalski", not "BJ". Greeting a grade-school
       student with that reads badly, so take the first token and capitalise it.
       Returns '' when there is nothing usable; callers drop the name entirely
       rather than greeting an empty string. */
    firstName () {
      const local = (this.userName || '').split('@')[0]
      const first = local.split(/[._\-\s]+/).filter(Boolean)[0] || ''
      return first ? first.charAt(0).toUpperCase() + first.slice(1) : ''
    }
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
    login () {
      this.$auth.loginWithPopup().then(() => {
        this.$store.dispatch('user_data/newUserLogin', this.$auth.user)
      })
    },
    logout () {
      // save the path we will redirect back to after logout is complete
      window.localStorage.setItem('ptr_logout_redirect_path', this.$router.currentRoute.fullPath)

      // update vuex
      this.$store.dispatch('user_data/logoutUser')

      this.$auth.logout({
        returnTo: `${window.location.origin}/logout`
      })
    }
  }
}
