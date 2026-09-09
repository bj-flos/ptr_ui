import Vue from 'vue'
import createSdk from '@descope/web-js-sdk'
import { APP_METADATA_CLAIM } from './claims'

/**
 * Descope, behind the shape the app already expects.
 *
 * The app talks to `$auth` -- user, isAuthenticated, loading, getTokenSilently,
 * loginWithPopup, logout -- in twenty-odd places, and none of them care which
 * identity provider is behind it. So the provider changed and the surface did
 * not: this file is the whole of the difference between Auth0 and Descope.
 *
 * Descope's Vue SDK is not usable here -- it peer-depends on vue >= 3 and this
 * is Vue 2.7 with vue-router 3, the same wall @auth0/auth0-vue hit. The
 * framework-agnostic @descope/web-js-sdk has no such constraint, which is what
 * @auth0/auth0-spa-js was doing in this plugin before it.
 *
 * OIDC rather than flows: `oidcConfig` gives loginWithRedirect and a callback
 * to finish, which is what the previous plugin was built around. A flow widget
 * would mean rebuilding the login UX as well as changing the provider.
 *
 * ROLES. claims.js reads roles from a namespaced claim -- `<namespace>app_metadata`
 * -- because that is where the Auth0 Action put them. Descope carries roles in
 * the session JWT instead, so this plugin reads them with getJwtRoles and
 * presents them under that same claim key. claims.js, the router guard, the
 * admin checks and every consumer are untouched, and the claim stays the one
 * place roles are read from.
 */

/** Define a default action to perform after authentication */
const DEFAULT_REDIRECT_CALLBACK = () =>
  window.history.replaceState({}, document.title, window.location.pathname)

let instance

/** Returns the current instance of the SDK */
export const getInstance = () => instance

/** Roles from the session token, as an array, never throwing. */
function rolesFromToken (sdk) {
  try {
    const token = sdk.getSessionToken()
    if (!token) { return [] }
    const roles = sdk.getJwtRoles(token)
    return Array.isArray(roles) ? roles : []
  } catch (e) {
    // A token we cannot read is a user with no roles, not a broken page.
    return []
  }
}

/**
 * The Descope user, shaped as the app's consumers expect.
 *
 * `sub` because the stores key on user.sub; the namespaced claim because
 * claims.js looks there for roles. Everything else is passed through.
 */
function shapeUser (me, sdk) {
  const details = (me && me.data) || me || {}
  const email = details.email || ''
  return {
    ...details,
    sub: details.userId || details.sub || '',
    name: details.name || email,
    nickname: details.name || email.split('@')[0],
    // Descope spells these givenName/familyName; the store and the greeting
    // read the OIDC given_name/family_name. Without the mapping the navbar
    // says "Welcome back" to nobody in particular.
    given_name: details.givenName || '',
    family_name: details.familyName || '',
    email,
    picture: details.picture,
    [APP_METADATA_CLAIM]: { roles: rolesFromToken(sdk) }
  }
}

/** Creates the auth wrapper. If one already exists, returns it. */
export const useAuth = ({
  onRedirectCallback = DEFAULT_REDIRECT_CALLBACK,
  redirectUri = window.location.origin,
  ...options
}) => {
  if (instance) return instance

  // Held here so both the startup build and any later retry use exactly the
  // same configuration.
  const sdkOptions = {
    projectId: options.projectId,
    // getSessionToken() reads from storage, so the token has to be persisted;
    // without this every call for a bearer token comes back empty.
    persistTokens: true,
    autoRefresh: true,
    oidcConfig: {
      redirectUri,
      ...(options.applicationId ? { applicationId: options.applicationId } : {}),
      ...(options.scope ? { scope: options.scope } : {})
    }
  }

  instance = new Vue({
    data () {
      return {
        loading: true,
        isAuthenticated: false,
        user: {},
        sdk: null,
        popupOpen: false,
        error: null
      }
    },
    methods: {
      /**
       * The SDK client, built on demand.
       *
       * Construction can fail -- Descope unreachable, a project id that is not
       * one -- and leaving it null while every method below dereferences it
       * turns a click on Log in into "Cannot read properties of null" rather
       * than something a user can act on. Building here also means a failure
       * that was only temporary is over as soon as someone tries again, with
       * no reload.
       */
      async ensureClient () {
        if (!this.sdk) {
          this.sdk = createSdk(sdkOptions)
        }
        return this.sdk
      },

      /**
       * Pull user and authentication state out of the SDK.
       *
       * Authentication is decided by whether the provider will tell us who the
       * user is, NOT by whether a session token can be read from browser
       * storage. A project configured to keep the session in a cookie hands
       * the browser nothing to read -- the SDK's own README says so -- and
       * judging by the token made a signed-in user look signed out: the app
       * mounted with no session, and the route guard sent anyone clicking
       * Profile back to the provider they had just come from.
       */
      async refreshState () {
        const sdk = await this.ensureClient()
        try {
          const me = await sdk.me()
          // The SDK reports failure in the response rather than by throwing,
          // so an unchecked await reads a rejection as a signed-in user.
          if (!me || me.ok === false || !me.data) {
            this.isAuthenticated = false
            this.user = {}
            return
          }
          this.user = shapeUser(me, sdk)
          this.isAuthenticated = true
        } catch (e) {
          this.error = e
          this.isAuthenticated = false
          this.user = {}
        }
      },

      /**
       * Start a login.
       *
       * Named for the popup the Auth0 plugin used, because that is what the
       * call sites say. Descope's OIDC login is a redirect -- there is no
       * popup equivalent -- so this leaves the page. The name is kept rather
       * than changed in eight call sites for a difference the user does not
       * see.
       */
      async loginWithPopup (o) {
        return this.loginWithRedirect(o)
      },

      /** Authenticates the user by redirecting to Descope */
      async loginWithRedirect (o) {
        try {
          const sdk = await this.ensureClient()
          return await sdk.oidc.loginWithRedirect({
            redirect_uri: redirectUri,
            ...(o || {})
          })
        } catch (e) {
          this.error = e
          // eslint-disable-next-line no-console
          console.error('[auth] Login failed.', e)
        }
      },

      /** Handles the return from Descope after a login */
      async handleRedirectCallback () {
        this.loading = true
        try {
          const sdk = await this.ensureClient()
          await sdk.oidc.finishLogin()
          await this.refreshState()
        } catch (e) {
          this.error = e
        } finally {
          this.loading = false
        }
      },

      /** The claims on the logged-in user */
      async getIdTokenClaims () {
        return this.user
      },

      /**
       * The session token, refreshed if it has expired.
       *
       * autoRefresh keeps it current while the tab is open; the explicit
       * refresh covers a tab that was asleep past the expiry.
       */
      async getTokenSilently () {
        const sdk = await this.ensureClient()
        let token = sdk.getSessionToken()
        if (!token) {
          try {
            await sdk.refresh()
          } catch (e) {
            this.error = e
          }
          token = sdk.getSessionToken()
        }
        return token
      },

      /** No popup in an OIDC redirect flow; same token, same source. */
      async getTokenWithPopup () {
        return this.getTokenSilently()
      },

      /** Ends the session, then returns where the caller asked */
      async logout (o) {
        const sdk = await this.ensureClient()
        try {
          await sdk.oidc.logout()
        } catch (e) {
          this.error = e
        }
        this.isAuthenticated = false
        this.user = {}
        const returnTo = o && o.returnTo
        if (returnTo) {
          window.location.assign(returnTo)
        }
      }
    },

    async created () {
      // All of it inside the try. A provider that is unreachable or
      // misconfigured must leave the app usable and signed out, not dead:
      // main.js waits on `loading` before mounting, so an escaping rejection
      // here is a blank page with nothing in the console.
      try {
        const sdk = await this.ensureClient()

        // State changes can arrive from a background refresh as well as from a
        // login, so the app follows the SDK rather than polling it.
        //
        // The signal is a reason to re-ask, NOT the answer. It reports whether
        // the SDK can read a session token, which is the test refreshState was
        // changed to stop trusting: assigning it here put that verdict back,
        // and a background refresh reporting false overwrote the true that
        // me() had established. The page still looked signed in -- userIsAdmin
        // lives in the store and nothing flips it -- so the next guarded route
        // was where it surfaced, sending anyone clicking Profile to Descope.
        sdk.onIsAuthenticatedChange(async () => {
          await this.refreshState()
        })
        sdk.onUserChange(() => { this.refreshState() })

        // Only acts when the URL carries the code and state Descope sends
        // back, so it is safe on an ordinary page load.
        const finished = await sdk.oidc.finishLoginIfNeed()
        if (finished) {
          onRedirectCallback()
        }

        await this.refreshState()
      } catch (e) {
        this.error = e
        // eslint-disable-next-line no-console
        console.error('[auth] Descope initialisation failed; continuing signed out.', e)
      } finally {
        // Always released, whatever happened, or nothing downstream mounts.
        this.loading = false
      }
    }
  })

  return instance
}

/** Exposes the wrapper as $auth throughout the application */
export const AuthPlugin = {
  install (Vue, options) {
    Vue.prototype.$auth = useAuth(options)
  }
}

// The name main.js has used since this was an Auth0 plugin. Kept so the
// provider change is contained to this file.
export const Auth0Plugin = AuthPlugin
export const useAuth0 = useAuth
