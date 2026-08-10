<template>
  <div style="z-index: 1;">
    <div
      :id="mapName"
      class="google-map"
    />
  </div>
</template>

<script>
import nite from './nite-overlay'
import { mapState, mapGetters, mapActions } from 'vuex'
import google_map_styles from './google-styles'
import { makeIcon } from './mapHelpers'

export default {
  name: 'TheWorldMap',
  props: ['name'],
  data: function () {
    return {

      global_config: {},

      // The google map object
      map: '',

      mapName: this.name + '-map',
      infoWindows: [],

      iw: '', // infoWindow
      oms: '', // OverlappingMarkerSpiderfier

      // The marker depicting the sun's position
      sunMapMarker: ''
    }
  },
  async mounted () {
    this.global_config = this.$store.state.site_config.global_config
    // The Maps API is loaded with loading=async, so google.maps may not exist
    // yet. index.html resolves this promise from the loader callback.
    if (window.googleMapsReady) { await window.googleMapsReady }
    this.initMap()
  },
  beforeDestroy () {
    // Remove the looping intervals that update the sun and daylight regions on the map.
    clearInterval(this.updateTwilightInterval)
    clearInterval(this.updateSunInterval)
  },

  watch: {
    all_sites_real () {
      this.redrawMapSites()
    },
    site_open_status () {
      // this.initMap()
    }
  },

  methods: {

    // NB still google.maps.Marker, deliberately. OverlappingMarkerSpiderfier
    // 1.0.3 calls marker.setMap() and listens for 'position_changed' and
    // 'visible_changed', none of which AdvancedMarkerElement provides, so this
    // path cannot move until the spiderfier is replaced.
    addMarkerWithData (markerData) {
      const white = { r: 255, g: 255, b: 255 }
      const marker = new google.maps.Marker({
        position: markerData,
        draggable: true
      })

      google.maps.event.addListener(marker, 'spider_format', function (status) {
        const markerStatus = OverlappingMarkerSpiderfier.markerStatus
        const showName = status == markerStatus.UNSPIDERFIABLE || status == markerStatus.SPIDERFIED
        const showPlus = status == markerStatus.SPIDERFIABLE
        const sizeCoefficient = showName ? 1.5 : 1.5

        marker.setIcon({
          url: makeIcon(markerData.rgb, white,
            showPlus ? white : false,
            showName ? markerData.name : false),
          scaledSize: new google.maps.Size(23 * sizeCoefficient, 32 * sizeCoefficient) // makes SVG icons work in IE
        })

        // Prevent users from repositioning markers
        marker.setDraggable(false)
      })
      this.oms.addMarker(marker, e => {
        this.iw.setContent(markerData.content)
        this.iw.open(this.map, marker)
      })
    },

    // The sites to draw: one marker per wema, not per observatory.
    //
    // A wema hosts the roof and weather for any number of observatories, and
    // they inherit its coordinates -- so a marker per obs stacks them all on
    // one point and labels it with an arbitrary member of the set. A site with
    // no wema peer still gets a marker, so nothing is silently dropped.
    //
    // Both draw paths use this. They used to filter separately and disagreed:
    // initMap kept the observatories, redrawMapSites kept the wemas.
    mapSites () {
      const known = Object.keys(this.site_open_status)
      const sites = this.all_sites_real.filter(site => known.includes(site.site))
      const wema_names = new Set(sites.map(s => s.wema_name))
      return sites.filter(s =>
        s.instance_type === 'wema' || !wema_names.has(s.wema_name) || s.site === s.wema_name)
    },

    async initMap () {
      await this.getSiteOpenStatus
      const sun_pos = { lat: nite.calculatePositionOfSun().lat(), lng: nite.calculatePositionOfSun().lng() }
      const map_center_latitude = 15 // puts sites at a more visibly comfortable location
      // One world is 256 * 2^zoom px wide, so zoom 3 is exactly 2048px. The
      // container is capped to match in Home.vue: any space the world does not
      // cover gets filled with repeat copies, and markers only ever attach to
      // one of them. minZoom keeps that invariant when the user zooms.
      const mapElement = document.getElementById(this.mapName)
      this.map = new google.maps.Map(mapElement, {
        zoom: 3,
        minZoom: 3,
        center: new google.maps.LatLng(map_center_latitude, sun_pos.lng + 180),
        // AdvancedMarkerElement only renders on a map that has a Map ID.
        // NB supplying one makes Google ignore the `styles` option below in
        // favour of cloud styling attached to the Map ID, so the palette in
        // google-styles.js has to be recreated against the ID in the Cloud
        // console. DEMO_MAP_ID is the unstyled development fallback.
        mapId: process.env.VUE_APP_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
        styles: google_map_styles,
        // Keeps panning inside a single world; on its own this does not stop
        // the repeats, which is what the capped container width is for.
        restriction: {
          latLngBounds: { north: 85, south: -85, west: -180, east: 180 },
          strictBounds: false
        }
      })

      // Draw the daylight regions, and update every few seconds.
      nite.init(this.map)
      this.updateTwilightInterval = setInterval(function () { nite.refresh() }, 10000) // every 10s

      // Get position of the sun and display on map, and update every few seconds.
      this.drawSunMarker()
      this.updateSunInterval = setInterval(this.updateSunPosition, 10000)

      const oms = new OverlappingMarkerSpiderfier(this.map, {
        markersWontMove: true,
        markersWontHide: true,
        keepSpiderfied: true,
        circleFootSeparation: 35,
        nearbyDistance: 35
      })
      this.oms = oms

      const iw = new google.maps.InfoWindow()
      this.iw = iw

      function iwClose () { iw.close() }
      google.maps.event.addListener(this.map, 'click', iwClose)

      // Consolidate additional data used to render sites to the map
      this.mapSites().forEach(site => {
        const markerData = {
          lat: site.latitude,
          lng: site.longitude,
          rgb: this.getSiteMapColor(site.site),
          content: this.renderSiteContent(site.name, site.site, this.site_open_status[site.site]),
          name: site.site.toUpperCase()
        }

        this.addMarkerWithData(markerData)
      })
    },

    // Draw the sun for the first time
    drawSunMarker () {
      const sun_pos = { lat: nite.getSunPosition().lat(), lng: nite.getSunPosition().lng() }
      this.sunMapMarker = new google.maps.marker.AdvancedMarkerElement({
        position: sun_pos,
        content: this.makeSunElement(),
        title: 'Sun',
        map: this.map
      })
    },

    // AdvancedMarkerElement takes a DOM node instead of a SymbolPath icon.
    // Reproduces the previous circle: radius 8 (so 16px across), gold at 0.7,
    // with a 3px gold stroke at 0.8.
    makeSunElement () {
      const el = document.createElement('div')
      el.style.cssText = [
        'width: 16px',
        'height: 16px',
        'border-radius: 50%',
        'background: rgba(255, 215, 0, 0.7)',
        'border: 3px solid rgba(255, 215, 0, 0.8)',
        'box-sizing: content-box'
      ].join(';')
      return el
    },

    // Site dot, matching the SVG the spiderfied markers use.
    makeSiteElement (rgb, title) {
      const img = document.createElement('img')
      img.src = makeIcon(rgb, { r: 255, g: 255, b: 255 })
      img.width = 23
      img.height = 32
      img.alt = title || ''
      return img
    },

    // Reposition the sun to its current position
    updateSunPosition () {
      const sun_pos = { lat: nite.getSunPosition().lat(), lng: nite.getSunPosition().lng() }
      this.sunMapMarker.position = sun_pos
    },

    renderSiteContent (name, sitecode, openStatus) {
      const weather_status_not_stale = openStatus?.weather?.status_age_s < 300

      let weather_status = `
        <div class="status-entry">
            <div class="col">
              <div class="key">Status</div>
            </div>
            <div class="col">
              <div class="val">
                <span style="color:${weather_status_not_stale ? 'greenyellow' : 'red'}">
                ${weather_status_not_stale ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
        </div>
        `

      if (weather_status_not_stale) {
        weather_status = `
          <div class="status-entry">
              <div class="col">
                <div class="key">Status</div>
                <div class="key">Weather:</div>
              </div>
              <div class="col">
                <div class="val">
                  <span style="color:${weather_status_not_stale ? 'greenyellow' : 'red'}">
                  ${weather_status_not_stale ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div class="val">
                  <span style="color:${openStatus.wx_ok ? 'greenyellow' : 'red'}">
                  ${openStatus.wx_ok ? 'ok' : 'poor'}
                  </span>
                </div>
            </div>
        `
      }

      const style = `
        <style>
          .status-entry {
            font-weight: normal;
            display:flex;
            flex-direction:row;
            flex-wrap:wrap;
            width: 100%;
            margin-top: 1em;
            align-items: center;
          }
          .col {
              flex-direction: column;
              width:50%;
          }
          .status-entry .key {
            color:black;
            padding: 4px 8px;
            white-space: nowrap;
            margin-bottom: 3px;
            text-align: right;
            flex-grow:1;
            height: 2em;
          }
          .status-entry .val{
            color: greenyellow;
            background-color: black;
            padding: 4px 8px;
            margin-bottom: 3px;
            white-space: nowrap;
            flex-grow:1;
            height: 2em;
          }
          .site-title {
            color: blue;
          }
        </style>
        `

      const contentString = `

          ${style}

          <div class="" style="max-width: 200px; background-color:white; border-color: white;">
            <div class="">
              <div class="">
                <div style="padding-bottom: 4px; border-bottom: 1px solid black;">
                  <p class="title is-5" style="color: black;">${name}</p>
                  <p class="subtitle is-6" style="color: #333;">site code: ${sitecode}</p>
                </div>
              </div>

              ${weather_status}

              <div class="">
                <a class="button is-success" href="site/${sitecode}/home" style="font-weight: bold; margin-top: 1em;">View this site!</a>
              </div>
            </div>
          </div>`
      return contentString
    },

    /*
      Strategy:
        if weather status is recent and wx_ok is true: green dot
        if weather status is recent and wx_ok is false: red dot
        otherwise: grey dot
    */
    getSiteMapColor (site) {
      const colors = {
        'status-yellow': { r: 221, g: 156, b: 0 },
        'status-red': { r: 205, g: 0, b: 0 },
        'status-green': { r: 53, g: 154, b: 34 },
        'status-grey': { r: 100, g: 100, b: 100 }
      }
      return colors[this.all_sites_status_color[site]]
    },

    async redrawMapSites () {
      // Can be triggered by the all_sites_real watcher before initMap has run,
      // which with an async Maps API means google.maps may not exist yet.
      if (!this.map) { return }

      // For each site, draw a marker with a popup (on click) to visit the site.
      this.mapSites().forEach(site => {
        const icon_color = this.getSiteMapColor(site.site)

        // NB getSiteMapColor returns an {r,g,b} object, so the previous
        // `${icon_color}-dot.png` URL interpolated to '[object Object]-dot.png'
        // and 404'd. Use the same SVG the other markers use.
        const marker = new google.maps.marker.AdvancedMarkerElement({
          position: { lat: site.latitude, lng: site.longitude },
          map: this.map,
          content: this.makeSiteElement(icon_color, site.name),
          title: site.name,
          gmpClickable: true
        })
        const siteInfoWindow = new google.maps.InfoWindow({
          content: this.renderSiteContent(site.name, site.site, this.site_open_status[site.site])
        })
        this.infoWindows.push(siteInfoWindow)
        marker.addListener('click', () => {
          this.infoWindows.map(x => x.close())
          // Advanced markers anchor by option object rather than (map, marker).
          siteInfoWindow.open({ anchor: marker, map: this.map })
        })
      })
    }

  },

  computed: {
    ...mapState('site_config', ['test_sites']),
    ...mapGetters('site_config', ['all_sites_real']),
    ...mapState('sitestatus', ['site_open_status']),
    ...mapActions('sitestatus', ['getSiteOpenStatus']),
    ...mapGetters('sitestatus', ['all_sites_status_color'])
  }
}
</script>

<style lang="scss" scoped>
.google-map {
    min-width: 50px;
    min-height: 50px;
    width: 100%;
    height: 100%;
    background-color: grey;
    max-height: 90vh;
    z-index: 1;
}
</style>
