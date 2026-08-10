import ReconnectingWebSocket from 'reconnecting-websocket'
import topic_handlers from './topic_handlers'
import store from '../store'
class Datastreamer {
  constructor (site) {
    this.primary_websocket = ''
    this.wema_websocket = ''
    this.site = site
    // An unknown site code reaches here from a stale URL. Falling back to the
    // site itself keeps the constructor from throwing in Site.vue's created
    // hook, which would blank the page before anything rendered.
    const config = store.state.site_config.global_config[this.site]
    if (!config) {
      console.warn(`Datastreamer: no config for site '${this.site}'`)
    }
    this.wema = config ? config.wema_name : this.site
    this.open_connections()
  }

  showCurrentSites () {
    console.log('Main site: ', this.site)
    console.log('Wema site: ', this.wema)
  }

  openPrimaryConnection () {
    const primary_datastreamurl = 'wss://datastream.photonranch.org/dev' +
      `?site=${encodeURIComponent(this.site)}`
    this.primary_websocket = new ReconnectingWebSocket(primary_datastreamurl)
    this.primary_websocket.onmessage = this.handle_msg
  }

  openWemaConnection () {
    // don't open a duplicate connection if the site is a wema
    if (this.wema == this.site) {
      return
    }
    const wema_datastreamurl = 'wss://datastream.photonranch.org/dev' +
      `?site=${encodeURIComponent(this.wema)}`
    this.wema_websocket = new ReconnectingWebSocket(wema_datastreamurl)
    this.wema_websocket.onmessage = this.handle_msg
  }

  open_connections () {
    this.close_wema()
    this.close_primary()
    this.openPrimaryConnection()
    this.openWemaConnection()
  }

  handle_msg (msg) {
    const payload = JSON.parse(msg.data)

    if (payload.topic == 'sitestatus') {
      topic_handlers.status_stream_handler(payload.data)
    }
    else if (payload.topic == 'imagedata') {
      topic_handlers.new_data_stream_handler(payload.data)
    }
    else if (payload.topic == 'userstatus') {
      topic_handlers.user_status_handler(payload.data)
    }
    else if (payload.topic == 'jobs') {
      topic_handlers.jobs_handler(payload.data)
    }
    else {
      console.log('Unrecognized datastream message: ', payload.topic, payload)
    }
  }

  update_site (site) {
    this.site = site
    const updated_config = store.state.site_config.global_config[site]
    this.wema = updated_config ? updated_config.wema_name : site
    const siteIsWema = this.wema == this.site

    // Handle primary connection first
    try {
      this.primary_websocket.send(JSON.stringify({
        action: 'updatesubscribersite',
        site: this.site
      }))
    } catch {
      this.openPrimaryConnection()
    }
    // Handle wema connection
    if (siteIsWema) {
      this.close_wema()
    } else {
      try {
        this.wema_websocket.send(JSON.stringify({
          action: 'updatesubscribersite',
          site: this.wema
        }))
      } catch {
        this.openWemaConnection()
      }
    }
  }

  close () {
    this.close_wema()
    this.close_primary()
  }

  close_wema () {
    try {
      this.wema_websocket.close()
    } catch {
      // probably didn't close because it wasn't open in the first place.
    }
  }

  close_primary () {
    try {
      this.primary_websocket.close()
    } catch {
      // probably didn't close because it wasn't open in the first place.
    }
  }
}

export default Datastreamer
