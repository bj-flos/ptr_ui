/**
 *  This module stores state related to development tools.
 */

// initial state
const state = {
  /* Every endpoint comes from the environment; see .env.local.

    The fallbacks are empty on purpose. An unset variable then resolves to a
    same-origin relative URL, which fails locally and visibly, rather than
    silently sending this development build's traffic to LCO production.
    */

  active_api: process.env.VUE_APP_ACTIVE_API || '', // prod

  jobs_api: process.env.VUE_APP_JOBS_API || '', // prod

  calendar_api: process.env.VUE_APP_CALENDAR_API || '', // prod

  projects_endpoint: process.env.VUE_APP_PROJECTS_ENDPOINT || '', // prod

  logs_endpoint: process.env.VUE_APP_LOGS_ENDPOINT || '', // prod

  quickanalysis_endpoint: process.env.VUE_APP_QUICKANALYSIS_ENDPOINT || '',
  // quickanalysis_endpoint: 'http://localhost:5000',

  status_endpoint: process.env.VUE_APP_STATUS_ENDPOINT || '' // prod
}

// getters
const getters = {
  api: state => state.active_api
}

// actions
const actions = {
  set_active_api ({ commit }, api_name) {
    commit('active_api', api_name)
  }
}

// mutations
const mutations = {
  active_api (state, api_name) {
    state.active_api = api_name
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations

}
