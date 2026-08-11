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
import { makeIcon } from './mapHelpers'
import helpers from '@/utils/helpers'

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
      // Markers have to be tracked to be removable: a redraw that cannot
      // clear its predecessors just stacks another set on top.
      siteMarkers: [],

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
      this.siteMarkers.push(marker)
    },

    // Remove every site marker drawn so far. The spiderfier keeps its own
    // list, so it has to be told as well or it goes on managing markers that
    // are no longer on the map.
    clearSiteMarkers () {
      this.siteMarkers.forEach(marker => {
        if (this.oms && typeof this.oms.removeMarker === 'function') {
          this.oms.removeMarker(marker)
        }
        marker.setMap(null)
      })
      this.siteMarkers = []
      this.infoWindows.forEach(w => w.close())
      this.infoWindows = []
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
        // AdvancedMarkerElement only renders on a map that has a Map ID, so
        // this is not optional -- and Google rejects `styles` whenever a mapId
        // is present, logging it on every load. Styling therefore lives in the
        // Cloud console against the Map ID; the palette in google-styles.js is
        // kept as the thing to recreate there. DEMO_MAP_ID is the unstyled
        // development fallback.
        mapId: process.env.VUE_APP_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
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
        // Group only markers that actually overlap. This is not a clusterer:
        // it keeps every marker in place and replaces each icon with a '+', so
        // a group of two shows two plus glyphs, not one combined symbol. At
        // 35px it caught sites merely in the same region -- ARO and DPO are
        // 300km apart, 15px at zoom 3 -- and both lost their labels. 12px is
        // narrower than the icon, so grouping now means genuine overlap.
        nearbyDistance: 12
      })
      this.oms = oms

      const iw = new google.maps.InfoWindow()
      this.iw = iw

      function iwClose () { iw.close() }
      google.maps.event.addListener(this.map, 'click', iwClose)

      // One implementation, called from both places, so the two cannot draw
      // different markers for the same site.
      //
      // Deferred to the map's first 'idle': the spiderfier throws if a marker
      // is added before then, since it cannot tell what overlaps until the map
      // has a viewport. If the map is already idle this fires immediately.
      google.maps.event.addListenerOnce(this.map, 'idle', () => {
        this.redrawMapSites()
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

    // Reposition the sun to its current position
    updateSunPosition () {
      const sun_pos = { lat: nite.getSunPosition().lat(), lng: nite.getSunPosition().lng() }
      this.sunMapMarker.position = sun_pos
    },

    /** How the roof reads in the popup: open, or shut with the reason why.
     *
     * shutter_status and enclosure_is_open can disagree -- MRC-17 reports a
     * 'Closed' shutter while enclosure_is_open is true -- so the shutter wins,
     * matching what the site status footer shows. A roof shut for daytime or
     * manual mode is expected rather than a fault, so only a weather closure
     * is drawn in red.
     */
    roofState (enclosure) {
      const open = helpers.enclosureIsOpen(enclosure)
      if (open === null) return { text: '-', color: '#999999' }
      if (open) return { text: 'Open', color: 'greenyellow' }

      const reasons = { bad_weather: 'bad weather', daytime: 'daytime', manual: 'manual' }
      const reason = reasons[enclosure.shut_reason]
      return {
        text: reason ? `Shut &mdash; ${reason}` : 'Shut',
        // Exactly the marker palette below, so the word and the site's dot are
        // the same colour. all_sites_status_color picks the matching token.
        color: enclosure.shut_reason === 'bad_weather' ? '#cd0000' : '#dd9c00'
      }
    },

    renderSiteContent (name, sitecode, openStatus) {
      const weather_status_not_stale = openStatus?.weather?.status_age_s < 300

      // Weather and roof readings only mean anything while the site is
      // reporting, so an offline site shows the one row and nothing stale.
      const rows = [
        ['Status', weather_status_not_stale
          ? { text: 'Online', color: 'greenyellow' }
          : { text: 'Offline', color: 'red' }]
      ]

      if (weather_status_not_stale) {
        rows.push(['Weather', openStatus.wx_ok
          ? { text: 'ok', color: 'greenyellow' }
          : { text: 'poor', color: 'red' }])
        rows.push(['Safety', this.roofState(openStatus.enclosure_status)])
      }

      // One row per key/value pair, built from a single list so the two columns
      // cannot drift out of step as rows are added.
      const weather_status = `
        <div class="status-entry">
          <div class="col">
            ${rows.map(([label]) => `<div class="key">${label}</div>`).join('')}
          </div>
          <div class="col">
            ${rows.map(([, value]) => `<div class="val"><span style="color:${value.color}">${value.text}</span></div>`).join('')}
          </div>
        </div>
        `

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
      Colours come from all_sites_status_color, which is shared with the navbar
      dropdown and the quick site switcher so a site's dot means one thing
      everywhere. Its rule:

        nothing reporting                     -> grey
        some subsystems stale                 -> yellow
        all fresh, roof open                  -> green
        all fresh, roof shut for bad weather  -> red
        all fresh, roof shut otherwise        -> yellow

      The shut colours match what roofState writes the word "Shut" in.
      (This comment previously described a wx_ok rule the getter never had.)
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

      // The spiderfier is set up by initMap and is what renders the site code
      // into the icon, so there is nothing to draw before it exists.
      if (!this.oms) { return }

      this.clearSiteMarkers()

      // For each site, draw a marker with a popup (on click) to visit the site.
      this.mapSites().forEach(site => {
        this.addMarkerWithData({
          lat: site.latitude,
          lng: site.longitude,
          rgb: this.getSiteMapColor(site.site),
          content: this.renderSiteContent(site.name, site.site, this.site_open_status[site.site]),
          name: site.site.toUpperCase()
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
