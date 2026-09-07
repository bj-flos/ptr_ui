import { runtimeConfig } from '@/runtime_config'
import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
// import './registerServiceWorker'

import LoadScript from 'vue-plugin-load-script'

import Buefy from 'buefy'
import './style/buefy-styles.scss'

import JsonViewer from 'vue-json-viewer'

// Import the Auth0 configuration and plugin
import authConfig from '../auth_config.json'
import { Auth0Plugin, getInstance } from './auth'

// A tenant set in .env.local fully overrides auth_config.json, so a local or
// dev tenant can be used without editing tracked config. With no env vars set,
// the checked-in photonranch tenant is used exactly as before.
const envDomain = runtimeConfig('VUE_APP_AUTH0_DOMAIN', process.env.VUE_APP_AUTH0_DOMAIN)
const domain = envDomain || authConfig.domain
const clientId = envDomain ? runtimeConfig('VUE_APP_AUTH0_CLIENT_ID', process.env.VUE_APP_AUTH0_CLIENT_ID) : authConfig.clientId
const audience = envDomain ? runtimeConfig('VUE_APP_AUTH0_AUDIENCE', process.env.VUE_APP_AUTH0_AUDIENCE) : authConfig.audience
// The app is served under BASE_URL (publicPath — '/ptr/' when reached through
// the nina-scheduler nginx), so the callback has to carry that base too: a bare
// origin sends Auth0 back to '/', which is the NINA GUI rather than this app.
// Deriving it from the live origin keeps every entry point working (the direct
// ts.net dev URL and the proxied one) without pinning a hostname here — but each
// resulting URL must still be registered as an Allowed Callback URL in the
// Auth0 tenant. VUE_APP_AUTH0_REDIRECT_URI overrides it outright.
const redirectUri =
  runtimeConfig('VUE_APP_AUTH0_REDIRECT_URI', process.env.VUE_APP_AUTH0_REDIRECT_URI) ||
  window.location.origin + process.env.BASE_URL

// Hide the 'you are running in development mode!' warning in the console.
Vue.config.productionTip = false

Vue.use(JsonViewer)
Vue.use(LoadScript)
Vue.use(Buefy)
Vue.use(Auth0Plugin, {
  domain,
  clientId,
  redirectUri,
  // Omitted entirely when unset — an unregistered audience makes Auth0 reject
  // the authorize request with "Service not found".
  ...(audience ? { audience } : {}),
  onRedirectCallback: appState => {
    // router paths are relative to BASE_URL, so the raw pathname has to have the
    // base stripped before it is pushed — otherwise the base is applied twice
    // and '/ptr/foo' becomes '/ptr/ptr/foo'.
    const base = process.env.BASE_URL || '/'
    const pathname = window.location.pathname
    const relativePath = pathname.startsWith(base)
      ? '/' + pathname.slice(base.length)
      : pathname
    router.push(
      appState && appState.targetUrl
        ? appState.targetUrl
        : relativePath
    )
  }
})

async function initAuth () {
  const authService = getInstance()
  if (authService.loading) {
    await new Promise(resolve => {
      authService.$watch('loading', loading => {
        if (loading === false) {
          resolve()
        }
      })
    })
  }
  if (authService.isAuthenticated) {
    store.dispatch('user_data/newUserLogin', authService.user)
  }
}

// Load the config for all sites
store.dispatch('site_config/update_config').then(() => {
  // Use config to set defaults for script settings
  store.dispatch('scriptSettings/setAllDefaults')
  // Keep the config current without needing a page reload
  store.dispatch('site_config/startConfigRefresh')
  // Chck for auth configuration and then mount the Vue app
  initAuth().then(() => {
    new Vue({
      router,
      store,
      render: h => h(App)
    }).$mount('#app')
  })
})
