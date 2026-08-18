import axios from 'axios'
import Vue from 'vue'

import { statusAgeDisplay, STALE_AGE_MS } from './getters/status_utils'
import helpers from '../../../utils/helpers'

import enclosure_getters from './getters/enclosure_getters'
import weather_getters from './getters/weather_getters'
import forecast_getters from './getters/forecast_getters'
import mount_getters from './getters/mount_getters'
import telescope_getters from './getters/telescope_getters'
import camera_getters from './getters/camera_getters'
import filter_wheel_getters from './getters/filter_wheel_getters'
import focuser_getters from './getters/focuser_getters'
import rotator_getters from './getters/rotator_getters'
import screen_getters from './getters/screen_getters'
import sequencer_getters from './getters/sequencer_getters'
import selector_getters from './getters/selector_getters'
import wema_settings_getters from './getters/wema_settings_getters'
import obs_settings_getters from './getters/obs_settings_getters'
import accumulated_getters from './getters/accumulated_getters'

const hasKey = (obj, key) => { return Object.keys(obj).includes(key) }

const state = {
  site: 'no site',
  status: {},
  timestamp: '',
  now: Date.now(),
  site_open_status: {},
  stale_age_ms: STALE_AGE_MS,

  weather: {},
  enclosure: {},
  siteOwmReports: {},
  forecast: [],
  daily_forecast: [],

  screen: {},
  focuser: {},
  camera: {},
  telescope: {},
  mount: {},
  rotator: {},
  filter_wheel: {},
  sequencer: {},
  selector: {},

  obs_settings: {},
  wema_settings: {}
}

const getters = {

  site: state => state.site,
  now: state => state.now,
  owmReport: (state, getters, rootState, rootGetters) => {
    const wema_name = rootGetters['site_config/wema_name']
    if (wema_name) {
      return JSON.parse(state.siteOwmReports[wema_name].report)
    }
  },

  /**
   *  Site operational status:
   *    operational: recieving all status (weather, enclosure device), none are stale
   *    technical difficulty: recieving some but not all status
   *    offline: all status is stale
   */
  site_is_online: (state, getters) => {
    const stale_age_s = STALE_AGE_MS / 1000
    if (
      getters.weather_status_age < stale_age_s &&
      getters.enclosure_status_age < stale_age_s &&
      getters.device_status_age < stale_age_s
    ) {
      return true
    }
    // (getters.device_status_age * 1000) < STALE_AGE_MS
  },

  /**
   *  Site operational status for obs platforms:
   *    operational: recieving all status (weather, enclosure, device), none are stale
   *    technical difficulty: recieving some but not all status
   *    offline: all status is stale
   *  Site operational status for wemas:
   *    operational: recieving enclosure status
   *    offline: enclosure status is stale
   */
  site_operational_status (state, getters, rootState, rootGetters) {
    const stale_age_s = STALE_AGE_MS / 1000
    const device_not_stale = getters.device_status_age < stale_age_s
    const enclosure_not_stale = getters.enclosure_status_age < stale_age_s
    const weather_not_stale = getters.weather_status_age < stale_age_s

    // A single word cannot say which subsystem stopped reporting or why, so
    // carry the evidence alongside it for the UI to reveal on demand.
    const age = s => (Number.isFinite(s) ? Math.round(s) + 's ago' : 'never')
    const enclosure_message = (() => {
      let m = getters.enclosure_state?.enclosure_message
      while (m && typeof m === 'object') { m = m.val }
      return m && m !== '-' ? m : null
    })()
    const details = [
      { label: 'device status', value: age(getters.device_status_age), stale: !device_not_stale },
      { label: 'enclosure status', value: age(getters.enclosure_status_age), stale: !enclosure_not_stale },
      { label: 'weather status', value: age(getters.weather_status_age), stale: !weather_not_stale },
      { label: 'considered stale after', value: Math.round(stale_age_s) + 's', stale: false }
    ]
    if (enclosure_message) {
      details.push({ label: 'enclosure reported', value: enclosure_message, stale: true })
    }

    // First handle WEMA sites
    // if (rootState.site_config.global_config[rootState.site_config.selected_site].instance_type == 'wema') {
    if (rootGetters['site_config/site_is_wema']) {
      // enclosure and weather both online
      if (enclosure_not_stale && weather_not_stale) {
        return {
          text: 'operational',
          colorClass: 'is-green',
          details
        }
      // enclosure and weather both stale
      } else if (!enclosure_not_stale && !weather_not_stale) {
        return {
          text: 'offline',
          colorClass: 'is-grey',
          details
        }
      // enclosure is stale
      } else if (!enclosure_not_stale && weather_not_stale) {
        return {
          text: 'enclosure not reporting',
          colorClass: 'is-yellow',
          details
        }
      // weather is stale
      } else if (enclosure_not_stale && !weather_not_stale) {
        return {
          text: 'weather not reporting',
          colorClass: 'is-yellow',
          details
        }
      }
    }

    // non-wema sites below:

    // if all status is stale: OFFLINE
    if (!device_not_stale && !enclosure_not_stale) {
      return {
        text: 'offline',
        colorClass: 'is-grey',
        details
      }
    }

    // if some of the status is stale: Technical Difficulty
    if (!device_not_stale || !enclosure_not_stale) {
      return {
        text: 'technical difficulty',
        colorClass: 'is-yellow',
        details
      }
    }

    // if all status reporting and enclosure is open: Operational
    const enclosure_is_open = getters.enclosure_open_status.val.toLowerCase() == 'open'
    if (device_not_stale && enclosure_not_stale) {
      if (enclosure_is_open) {
        return {
          text: 'operational',
          colorClass: 'is-green',
          details
        }
      } else {
        return {
          text: 'enclosure closed',
          colorClass: 'is-blue',
          details
        }
      }
    }
  },

  all_sites_status_color (state, getters, rootState) {
    const site_status_colors = {}
    const status_age_max = STALE_AGE_MS / 1000
    for (const site in state.site_open_status) {
      const enclosure_not_stale = state.site_open_status[site]?.enclosure?.status_age_s < status_age_max
      const weather_not_stale = state.site_open_status[site]?.weather?.status_age_s < status_age_max
      const device_not_stale = state.site_open_status[site]?.device?.status_age_s < status_age_max
      const site_is_wema = rootState.site_config.global_config[site]?.instance_type == 'wema'
      let color = ''

      // A site reporting nothing is grey, not red: we do not know its state
      // rather than knowing it is bad. Red is kept for a real fault -- a roof
      // shut by weather. Partially stale stays yellow, since some of it is
      // still talking to us.
      if (site_is_wema) {
        if (enclosure_not_stale && weather_not_stale) {
          color = 'status-green'
        } else if (!enclosure_not_stale && !weather_not_stale) {
          color = 'status-grey'
        } else {
          color = 'status-yellow'
        }
      }

      if (!site_is_wema) {
        if (enclosure_not_stale && device_not_stale) {
          color = 'status-green'
        } else if (!enclosure_not_stale && !device_not_stale) {
          color = 'status-grey'
        } else {
          color = 'status-yellow'
        }
      }

      // A site that is reporting but shut should read as shut, in the same
      // colour the world map popup writes the word "Shut" in, rather than a
      // plain green "everything is fresh" dot. Only downgrades from green:
      // staleness wins, since a site that is not reporting says nothing
      // trustworthy about its roof.
      if (color === 'status-green') {
        // The wema hosts the roof, so an observatory inherits its wema's
        // enclosure rather than reporting one of its own. A simulated obs
        // otherwise claims a roof state its own site contradicts: ECO-17 read
        // "Sim. Open" while ECO reported the real roof shut, so the pulldown
        // and the map marker for one physical roof disagreed. Falls back to the
        // site's own reading, so an observatory with no wema peer still counts.
        const wema_name = rootState.site_config.global_config[site]?.wema_name
        const inherited = (!site_is_wema && wema_name)
          ? state.site_open_status[wema_name]?.enclosure_status
          : null
        const enclosure = inherited || state.site_open_status[site]?.enclosure_status

        // enclosureIsOpen is shared with the map popup so the dot and the word
        // "Shut" cannot disagree about what open means.
        if (helpers.enclosureIsOpen(enclosure) === false) {
          color = enclosure.shut_reason === 'bad_weather' ? 'status-red' : 'status-yellow'
        }
      }

      site_status_colors[site] = color
    }
    return site_status_colors
  },

  weather_status_age: state => (state.now - state.weather_timestamp) / 1000 || Infinity,
  enclosure_status_age: state => (state.now - state.enclosure_timestamp) / 1000 || Infinity,
  device_status_age: state => (state.now - state.device_timestamp) / 1000 || Infinity,
  forecast_status_age: state => (state.now - state.forecast_timestamp) / 1000 || Infinity,
  obs_settings_status_age: state => (state.now - state.obs_settings_timestamp) / 1000 || Infinity,
  wema_settings_status_age: state => (state.now - state.wema_settings_timestamp) / 1000 || Infinity,

  weather_status_age_display: (state, getters) => statusAgeDisplay(getters.weather_status_age),
  enclosure_status_age_display: (state, getters) => statusAgeDisplay(getters.enclosure_status_age),
  device_status_age_display: (state, getters) => statusAgeDisplay(getters.device_status_age),
  forecast_status_age_display: (state, getters) => statusAgeDisplay(getters.forecast_status_age),
  wema_settings_status_age_display: (state, getters) => statusAgeDisplay(getters.wema_settings_status_age),
  obs_settings_status_age_display: (state, getters) => statusAgeDisplay(getters.obs_settings_status_age),

  ...weather_getters,
  ...forecast_getters,
  ...enclosure_getters,
  ...mount_getters,
  ...telescope_getters,
  ...camera_getters,
  ...filter_wheel_getters,
  ...focuser_getters,
  ...rotator_getters,
  ...screen_getters,
  ...sequencer_getters,
  ...selector_getters,
  ...wema_settings_getters,
  ...obs_settings_getters,
  ...accumulated_getters
}

const mutations = {
  site (state, val) { state.site = val },

  // latest_status_timestamp_ms(state, time) { state.timestamp = time },

  latest_device_timestamp_ms (state, time) { state.device_timestamp = time },
  latest_weather_timestamp_ms (state, time) { state.weather_timestamp = time },
  latest_enclosure_timestamp_ms (state, time) { state.enclosure_timestamp = time },
  latest_forecast_timestamp_ms (state, time) { state.forecast_timestamp = time },
  latest_wema_settings_timestamp_ms (state, time) { state.wema_settings_timestamp = time },
  latest_obs_settings_timestamp_ms (state, time) { state.obs_settings_timestamp = time },

  updateLocalClock (state, time) { state.now = time },

  siteOpenStatus (state, val) { state.site_open_status = val },

  new_weather_status (state, status) {
    state.weather = status.observing_conditions
  },
  new_forecast_status (state, status) {
    state.forecast = status?.forecast || []
  },
  new_daily_forecast_status (state, status) {
    state.daily_forecast = status?.forecast_daily || []
  },
  new_enclosure_status (state, status) {
    state.enclosure = status.enclosure
  },
  new_device_status (state, status) {
    const device_types = [
      'screen',
      'focuser',
      'camera',
      'telescope',
      'mount',
      'rotator',
      'filter_wheel',
      'sequencer',
      'selector'
    ]
    // Set the status for each device-type
    device_types.forEach(device_type => {
      if (hasKey(status, device_type) && status[device_type] != null) {
        state[device_type] = status[device_type]
      }
    })
  },
  new_wema_settings_status (state, status) {
    state.wema_settings = status.wema_settings
  },
  new_obs_settings_status (state, status) {
    state.obs_settings = status.obs_settings
  },

  storeNewOwmReport (state, { wema_name, newReport, publishedAt }) {
    // Vue.set: wema names are added as sites are visited, and a plain
    // assignment leaves a new key non-reactive, so the panel would keep
    // rendering whatever it read first.
    Vue.set(state.siteOwmReports, wema_name, { report: newReport, publishedAt })
  },

  status (state, status) {
    state.status = status
    const device_types = [
      // 'observing_conditions',
      // 'enclosure',
      'screen',
      'focuser',
      'camera',
      'telescope',
      'mount',
      'rotator',
      'filter_wheel',
      'sequencer',
      'selector'
    ]

    // Set the status for each device-type
    device_types.forEach(device_type => {
      if (hasKey(status, device_type) && status[device_type] != null) {
        state[device_type] = status[device_type]
      }
    })
  },

  resetStatus (state) {
    const device_types = [
      'weather',
      'enclosure',
      'screen',
      'focuser',
      'camera',
      'telescope',
      'mount',
      'rotator',
      'filter_wheel',
      'sequencer',
      'selector'
    ]
    device_types.forEach(device_type => {
      state[device_type] = {}
    })

    state.forecast = []
  }
}

const actions = {

  // Get and update the 'open' status of all sites. Used for the global map site indicators.
  async getSiteOpenStatus ({ commit, rootState }) {
    const url = rootState.api_endpoints.status_endpoint + '/allopenstatus'
    const response = await axios.get(url)
    commit('siteOpenStatus', response.data)
    return response.data
  },

  // Get a single status object for a site. Used to initialize values when loading a new site.
  async getLatestStatus ({ state, commit, dispatch, rootState }) {
    const current_site = rootState.site_config.selected_site

    // Get this separately because the wema settings aren't included in the `complete_status` endpoint
    dispatch('getLatestWemaSettings')
    dispatch('getLatestForecast')
    dispatch('getLatestDailyForecast')

    // Clear the existing status if we load a new site
    if (state.site != current_site) {
      dispatch('clearStatus')
    }

    const url = rootState.api_endpoints.status_endpoint + `/${current_site}/complete_status`
    const response = await axios.get(url)

    // If the site has no status available, commit a default empty status to the store
    if (Object.keys(response.data).includes('status')) {
      const status = response.data.status

      // Set the status ages
      commit('latest_device_timestamp_ms', response.data.status_age_timestamps_ms.device)
      commit('latest_weather_timestamp_ms', response.data.status_age_timestamps_ms.weather)
      commit('latest_forecast_timestamp_ms', response.data.status_age_timestamps_ms.forecast)
      commit('latest_enclosure_timestamp_ms', response.data.status_age_timestamps_ms.enclosure)

      // Set the status content
      commit('new_device_status', status)
      commit('new_weather_status', status)
      commit('new_forecast_status', status)
      commit('new_enclosure_status', status)
      commit('new_obs_settings_status', status)

      commit('site', current_site)

      dispatch('getLatestForecast')
      dispatch('getLatestDailyForecast')
    } else {
      console.warn(`Status not available for ${current_site}.`)
    }
  },

  getLatestObsSettings ({ state, commit, rootState, rootGetters }) {
    const wema_name = rootGetters['site_config/wema_name']
    if (wema_name) {
      const url = rootState.api_endpoints.status_endpoint + `/${wema_name}/obs_settings`
      axios.get(url).then(response => {
        commit('latest_obs_settings_timestamp_ms', response.data.server_timestamp_ms)
        commit('new_obs_settings_status', response.data.status)
      }).catch(e => {
        console.log(e)
      })
    }
  },
  getLatestWemaSettings ({ state, commit, rootState, rootGetters }) {
    const wema_name = rootGetters['site_config/wema_name']
    if (wema_name) {
      const url = rootState.api_endpoints.status_endpoint + `/${wema_name}/wema_settings`
      axios.get(url).then(response => {
        commit('latest_wema_settings_timestamp_ms', response.data.server_timestamp_ms)
        commit('new_wema_settings_status', response.data.status)
      }).catch(e => {
        console.log(e)
      })
    }
  },

  getLatestForecast ({ state, commit, rootState, rootGetters }) {
    const wema_name = rootGetters['site_config/wema_name']
    if (wema_name) {
      const url = rootState.api_endpoints.status_endpoint + `/${wema_name}/forecast`
      axios.get(url).then(response => {
        commit('latest_forecast_timestamp_ms', response.data.server_timestamp_ms)
        commit('new_forecast_status', response.data.status)
      }).catch(e => {
        console.log(e)
      })
    }
  },

  /* The daily forecast, on its own lane because the hourly series only
   * reaches a couple of days and the week view needs the rest. */
  getLatestDailyForecast ({ commit, rootState, rootGetters }) {
    const wema_name = rootGetters['site_config/wema_name']
    if (!wema_name) { return }
    const url = rootState.api_endpoints.status_endpoint + `/${wema_name}/forecast_daily`
    axios.get(url).then(response => {
      commit('new_daily_forecast_status', response.data.status)
    }).catch(e => {
      // A site that has not published one yet is not an error; the calendar
      // simply draws what hourly coverage it has.
      console.log(e)
    })
  },

  /* Replace the stored report whenever the wema has published a newer one.
   *
   * This used to skip the request entirely for an hour after the last one.
   * Because the store is persisted, that hour survived reloads: a site could
   * publish a new report and every refresh would still show the old one until
   * the window elapsed. Comparing what the wema published, rather than how
   * long ago we asked, means the panel updates as soon as there is something
   * new and never re-renders on an unchanged report. */
  getLatestOwmReport ({ commit, rootState, rootGetters, state }) {
    const wema_name = rootGetters['site_config/wema_name']
    if (!wema_name) { return Promise.resolve() }

    const url = rootState.api_endpoints.status_endpoint + `/${wema_name}/owm_report`
    return axios.get(url).then(response => {
      const publishedAt = response.data?.server_timestamp_ms ?? 0
      // Entries stored before this change carry no publishedAt, so the first
      // response after an upgrade always wins and the stale one is replaced.
      const cached = state.siteOwmReports[wema_name]
      if (!cached || publishedAt > (cached.publishedAt ?? 0)) {
        commit('storeNewOwmReport', { wema_name, newReport: response.data.status.owm_report, publishedAt })
      }
    }).catch(e => {
      console.log(e)
    })
  },

  // Reset to empty values. Used for sites without any status available.
  clearStatus ({ commit }) {
    // commit('status',empty_status)
    commit('resetStatus')
    commit('latest_weather_timestamp_ms', 0)
    commit('latest_forecast_timestamp_ms', 0)
    commit('latest_enclosure_timestamp_ms', 0)
    commit('latest_device_timestamp_ms', 0)
  },

  // Keeps track of current time, used to calculate the status age.
  startClock ({ commit }) {
    setInterval(() => {
      const now = Date.now()
      commit('updateLocalClock', now)
    }, 1000)
  }

}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
}
