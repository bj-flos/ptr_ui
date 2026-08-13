<template>
  <b-navbar
    type="is-dark"
    wrapper-class="container"
  >
    <template slot="brand">
      <b-navbar-item
        tag="router-link"
        class="menu-title"
        :to="{ path: '/' }"
      >
        <!-- The lambda alone on a narrow screen; the full lockup once there
             is room for it. One image rather than the old arrangement of text
             spans plus a separate lambda, so the wordmark cannot drift out of
             step with the one the README shows. -->
        <img
          class="brand-lambda is-hidden-tablet ml-1 mr-2"
          src="/img/logos/PTR-lambda.png"
          alt="Photon Ranch on Asterism"
        >
        <img
          class="brand-lockup is-hidden-mobile"
          src="/img/logos/PTR-logo-asterism.png"
          alt="Photon Ranch on Asterism"
        >
        <span
          v-if="selected_site!=''"
          style="margin: 0;"
          class="subtitle site-hint"
        >>&nbsp;{{ selected_site.toUpperCase() }}</span>
      </b-navbar-item>
    </template>

    <template slot="start">
      <b-navbar-item
        tag="router-link"
        :to="{ path: '/about' }"
      >
        About
      </b-navbar-item>
      <!-- <b-navbar-item
        tag="router-link"
        :to="{ path: '/resources' }"
      >
        Resources
      </b-navbar-item> -->
      <!-- Note: the affiliates page will be used to entice observatory owners to join PTR.
                 Keeping this here as a placeholder until we have content.
            <b-navbar-item tag="router-link" :to="{ path: '/affiliates' }">
              Affiliates
            </b-navbar-item-->
    </template>

    <template slot="end">
      <b-navbar-item
        tag="div"
        class="is-flex is-align-items-center"
      >
        <div
          v-if="userIsAuthenticated"
          class="navbar-item has-dropdown is-hoverable is-dark"
        >
          <!-- Greeting before the avatar, and hidden on touch: the navbar is
               locked to 75px and "Welcome back Alexandra" is several times
               wider than the nickname it replaced. -->
          <div class="navbar-link">
            <!-- given_name, not the nickname: the nickname is usually an email
                 local part. Used exactly as stored -- reshaping it turns "BJ"
                 into "Bj". Not every connection collects given_name, so the
                 name is simply omitted when it is missing. -->
            <p class="greeting is-hidden-touch">
              Welcome back{{ userGivenName ? ' ' + userGivenName : '' }}
            </p>
            <div style="width:8px" />
            <img
              :src="profileUrl"
              width="25"
              height="25"
              style="border-radius: 50%;"
              referrerpolicy="no-referrer"
            >
          </div>

          <div class="navbar-dropdown">
            <router-link
              to="/profile"
              class="navbar-item"
            >
              Profile
            </router-link>
            <!-- The route is guarded by authGuard's requiresRole check, so a
                 non-admin following this only got a "Requires admin role"
                 toast. Offering it at all advertised a door they cannot open. -->
            <router-link
              v-if="userIsAdmin"
              to="/adminonly"
              class="navbar-item"
            >
              Admins Only
            </router-link>
            <hr class="navbar-divider">
            <a
              class="navbar-item has-link"
              @click="logout"
            >Log out</a>
          </div>
        </div>

        <div
          v-else
          class="navbar-item not-authenticated"
        >
          <!-- show apply and login when not authenticated -->
          <b-tooltip
            label="Under Development"
            position="is-bottom"
            type="is-black"
          >
            <b-button
              class="button"
              disabled
            >
              apply
            </b-button>
          </b-tooltip>
          <b-button
            v-if="!userIsAuthenticated"
            class="button"
            @click="login"
          >
            Log in
          </b-button>
        </div>

        <b-tooltip
          v-if="showCautionButton"
          label="Action needed on your account"
          position="is-bottom"
          type="is-dark"
          class="mr-2"
        >
          <b-button
            size="is-large"
            icon-left="alert"
            type="is-text"
            style="color: #f1b70e;"
            @click="showGoogleWarningMessage"
          />
        </b-tooltip>
      </b-navbar-item>
    </template>
  </b-navbar>
</template>

<script>
import { mapState, mapMutations } from 'vuex'
import { user_mixin } from '@/mixins/user_mixin'

export default {
  name: 'SiteNavbar',
  mixins: [
    user_mixin
  ],
  computed: {
    ...mapState('sitestatus', ['site_open_status', 'stale_age_ms']),
    ...mapState('site_config', [
      'selected_site'
    ]),
    ...mapState('user_data', [
      'userIsAuthenticated',
      'userIsAdmin',
      'userId',
      'profileUrl',
      'isGoogleFederatedAccount',
      'googleWarningDismissed'
    ]),

    showCautionButton () {
      return this.userIsAuthenticated && this.isGoogleFederatedAccount
    }

  },
  // The sites dropdown used to be the thing that refreshed open status on every
  // page that shows the navbar; it is gone, and the markers on the home page now
  // depend on that status, so the navbar has to ask for it itself.
  mounted () {
    this.updateSiteStatus()
  },
  methods: {
    ...mapMutations('user_data', {
      setGoogleWarningDismissed: 'googleWarningDismissed'
    }),

    updateSiteStatus () {
      this.$store.dispatch('sitestatus/getSiteOpenStatus')
    },

    showGoogleWarningMessage () {
      this.setGoogleWarningDismissed(false)
    }
  }
}
</script>

<style lang="scss" scoped>
@import "@/style/_variables.scss";
/* The lockup stacks three rows -- wordmark, rule, ASTERISM -- into the height
   of the bar, so it has to take nearly all of the 75px or the type inside ends
   up smaller than the menu beside it. */
.brand-lockup {
  height: 64px;
  width: auto;
  /* Bulma clamps any img inside a navbar-item to 1.75rem, which squashed this
     to 26px however tall it was asked to be. */
  max-height: none;
}

.brand-lambda {
  height: 40px;
  width: auto;
  max-height: none;
}

.menu-title {
  display:flex;
  align-items:center;
  //font: 30px "Share Tech Mono", monospace;
  margin-right: 2em;
  height: 75px;
}
.site-hint {
  padding-left: 1em;
  color: $grey-light;
  font: 20px "Share Tech Mono", monospace;
}
/* Height goes on .navbar, not on `nav`. As an element selector the old rule
   lost to Bulma's own .navbar, so the bar sat at Bulma's 60px while the brand
   block inside it stayed 75px -- the logo hung 15px below the bar and, with the
   z-index below, painted over whatever came next. That used to be the map,
   where it went unnoticed; it now covers the top of the filter buttons.
   75px is the height the rest of the navbar CSS already assumes. */
.navbar {
  height: 75px;
  min-height: 75px;
  border-radius: 0;
  z-index:31; /* so the navbar doesn't cover fullscreen modals */
}

.not-authenticated {
  display: flex;
  gap: 1em;
}

/* The navbar is a fixed 75px, so the greeting must never wrap. */
.greeting {
  white-space: nowrap;
}

</style>
