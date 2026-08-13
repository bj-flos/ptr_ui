import Vue from 'vue'
import createAuth0Client from '@auth0/auth0-spa-js'

/** Define a default action to perform after authentication */
const DEFAULT_REDIRECT_CALLBACK = () =>
  window.history.replaceState({}, document.title, window.location.pathname)

let instance

/** Returns the current instance of the SDK */
export const getInstance = () => instance

/** Creates an instance of the Auth0 SDK. If one has already been created, it returns that instance */
export const useAuth0 = ({
  onRedirectCallback = DEFAULT_REDIRECT_CALLBACK,
  redirectUri = window.location.origin,
  ...options
}) => {
  if (instance) return instance

  // Held here so both the startup build and any later retry use exactly the
  // same configuration.
  const clientOptions = {
    domain: options.domain,
    client_id: options.clientId,
    ...(options.audience ? { audience: options.audience } : {}),
    redirect_uri: redirectUri,
    // The startup silent /authorize runs in a hidden iframe, and a request
    // Auth0 refuses never posts a message back -- the SDK just waits out its
    // timeout, 60 seconds by default, with the app unmounted behind it. Ten is
    // long enough for a real round trip and short enough that a misconfigured
    // tenant costs a pause rather than what looks like a dead page.
    authorizeTimeoutInSeconds: 10
  }

  // The 'instance' is simply a Vue object
  instance = new Vue({
    data () {
      return {
        loading: true,
        isAuthenticated: false,
        user: {},
        auth0Client: null,
        popupOpen: false,
        error: null
      }
    },
    methods: {
      /**
       * The SDK client, built on demand.
       *
       * Startup construction can fail -- Auth0 unreachable, or a tenant that
       * rejects the silent check -- and it used to leave auth0Client null while
       * every method below dereferenced it, so a click on Log in produced
       * "Cannot read properties of null" rather than anything a user could act
       * on. Retrying here also means a failure that was only temporary is over
       * as soon as someone tries again, with no reload.
       */
      async ensureClient () {
        if (!this.auth0Client) {
          this.auth0Client = await createAuth0Client(clientOptions)
        }
        return this.auth0Client
      },
      /** Authenticates the user using a popup window */
      async loginWithPopup (o) {
        this.popupOpen = true

        try {
          const client = await this.ensureClient()
          await client.loginWithPopup(o)
          this.user = await client.getUser()
          this.isAuthenticated = true
        } catch (e) {
          this.error = e
          // eslint-disable-next-line no-console
          console.error('[auth] Login failed.', e)
        } finally {
          this.popupOpen = false
        }
      },
      /** Handles the callback when logging in using a redirect */
      async handleRedirectCallback () {
        this.loading = true
        try {
          const client = await this.ensureClient()
          await client.handleRedirectCallback()
          this.user = await client.getUser()
          this.isAuthenticated = true
        } catch (e) {
          this.error = e
        } finally {
          this.loading = false
        }
      },
      /** Authenticates the user using the redirect method */
      async loginWithRedirect (o) {
        return (await this.ensureClient()).loginWithRedirect(o)
      },
      /** Returns all the claims present in the ID token */
      async getIdTokenClaims (o) {
        return (await this.ensureClient()).getIdTokenClaims(o)
      },
      /** Returns the access token. If the token is invalid or missing, a new one is retrieved */
      async getTokenSilently (o) {
        return (await this.ensureClient()).getTokenSilently(o)
      },
      /** Gets the access token using a popup window */

      async getTokenWithPopup (o) {
        return (await this.ensureClient()).getTokenWithPopup(o)
      },
      /** Logs the user out and removes their session on the authorization server */
      async logout (o) {
        return (await this.ensureClient()).logout(o)
      }
    },
    /** Use this lifecycle method to instantiate the SDK client */
    async created () {
      // createAuth0Client is inside the try on purpose. It fires a silent
      // prompt=none /authorize on startup, and Auth0 answers 403 whenever the
      // redirect_uri is not a registered callback for the tenant. Left
      // uncaught, that rejection escaped created() and `loading` stayed true
      // for good -- main.js waits on it before mounting, so the whole app was
      // a blank page with nothing in the console. An unreachable or
      // misconfigured Auth0 must leave the app usable and signed out, not
      // dead.
      try {
        // Create a new instance of the SDK client using members of the given options object
        await this.ensureClient()

        // If the user is returning to the app after authentication..
        if (
          window.location.search.includes('code=') &&
          window.location.search.includes('state=')
        ) {
          // handle the redirect and retrieve tokens
          const { appState } = await this.auth0Client.handleRedirectCallback()

          // Notify subscribers that the redirect callback has happened, passing the appState
          // (useful for retrieving any pre-authentication state)
          onRedirectCallback(appState)
        }
      } catch (e) {
        this.error = e
        // eslint-disable-next-line no-console
        console.error('[auth] Auth0 initialisation failed; continuing signed out.', e)
      } finally {
        // Initialize our internal authentication state. Guarded because the
        // client is null when the step above threw.
        if (this.auth0Client) {
          try {
            this.isAuthenticated = await this.auth0Client.isAuthenticated()
            this.user = await this.auth0Client.getUser()
          } catch (e) {
            this.error = e
          }
        }
        // Always released, whatever happened, or nothing downstream mounts.
        this.loading = false
      }
    }
  })

  return instance
}

// Create a simple Vue plugin to expose the wrapper object throughout the application
export const Auth0Plugin = {
  install (Vue, options) {
    Vue.prototype.$auth = useAuth0(options)
  }
}
