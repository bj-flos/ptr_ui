<template>
  <div style="z-index: 1;">
    <div
      :id="mapName"
      class="google-map"
    />

    <!-- Rendered here, hidden, so it is a normal component with normal
         reactivity; showCard hands this element to the InfoWindow, which moves
         it into its own DOM. The host is what is hidden, not the card, so the
         card is visible once Google has taken it. -->
    <div
      ref="cardHost"
      class="card-host"
    >
      <SiteInfoCard
        ref="card"
        :site="activeSite"
        @use-telescope="$emit('use-telescope', $event)"
        @card-enter="onCardEnter"
        @card-leave="scheduleCardClose"
      />
    </div>
  </div>
</template>

<script>
import nite from './nite-overlay'
import { mapState, mapGetters, mapActions } from 'vuex'
import { makeIcon } from './mapHelpers'
import { siteIsDark } from '@/utils/site_darkness'
import SiteInfoCard from './SiteInfoCard'

// How long the card survives after the pointer leaves a marker. The InfoWindow
// is not a child of the marker -- Google renders it in an overlay pane above --
// so moving the pointer from marker to card fires the marker's mouseout on the
// way. Closing immediately would make the button impossible to click.
const HOVER_CLOSE_MS = 250

// The dark set changes on the order of hours, so this only has to be often
// enough that a student does not notice the lag. Each tick only redraws if the
// marker set actually changed.
const DARK_RECHECK_MS = 60000

// Long enough that crossing a cluster of markers does not fire a request per
// marker, short enough that a student who stopped on one barely notices.
const SCHEDULE_DEBOUNCE_MS = 300

export default {
  name: 'TheWorldMap',
  components: { SiteInfoCard },
  props: {
    name: { type: String, required: true },
    // Show only telescopes where the sun is far enough down to observe.
    darkOnly: { type: Boolean, default: false },
    // Show only telescopes nobody currently holds a reservation on.
    bookableOnly: { type: Boolean, default: false }
  },
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

      // The site the card is currently describing.
      activeSite: null,
      // A clicked card stays put; a hovered one closes on its own.
      cardPinned: false,
      hoverCloseTimer: null,
      // Which sites were drawn last, so the dark recheck can skip a redraw that
      // would change nothing -- and in doing so close the open card.
      lastMarkerKey: '',

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
    clearInterval(this.darkRecheckInterval)
    clearTimeout(this.hoverCloseTimer)
    clearTimeout(this.scheduleFetchTimer)

    if (this.iw) {
      this.iw.close()
      google.maps.event.clearInstanceListeners(this.iw)
    }
    this.siteMarkers.forEach(marker => google.maps.event.clearInstanceListeners(marker))
  },

  watch: {
    all_sites_real () {
      this.redrawMapSites()
    },
    darkOnly () {
      this.redrawMapSites()
    },
    // Unlike the dark filter, this one cannot be answered locally: it needs
    // every site's schedule, so the whole set is fetched before redrawing.
    // Redrawing first would briefly show every telescope as bookable.
    async bookableOnly (on) {
      if (!on) {
        this.redrawMapSites()
        return
      }
      this.$emit('loading', true)
      try {
        await Promise.all(this.candidateSites().map(site => this.fetchUpcomingEvents(site.site)))
      } finally {
        this.$emit('loading', false)
      }
      this.redrawMapSites()
    },
    site_open_status () {
      // this.initMap()
    }
  },

  methods: {
    // These were spread into `computed`, where Vue treated each mapped action
    // as a getter -- so `await this.getSiteOpenStatus` (no parens) happened to
    // dispatch, once, and then cached forever. Actions belong here.
    ...mapActions('sitestatus', ['getSiteOpenStatus']),
    ...mapActions('calendar', ['fetchUpcomingEvents']),

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
      const site = markerData.site

      google.maps.event.addListener(marker, 'spider_format', function (status) {
        const markerStatus = OverlappingMarkerSpiderfier.markerStatus
        const showName = status == markerStatus.UNSPIDERFIABLE || status == markerStatus.SPIDERFIED
        const showPlus = status == markerStatus.SPIDERFIABLE
        const sizeCoefficient = showName ? 1.5 : 1.5

        // Remembered so hover can skip a '+' marker: it stands for several
        // telescopes stacked on one point, and the card would have to pick one
        // of them arbitrarily. Clicking still fans them out.
        marker._spiderfiable = showPlus

        marker.setIcon({
          url: makeIcon(markerData.rgb, white,
            showPlus ? white : false,
            showName ? markerData.name : false),
          scaledSize: new google.maps.Size(23 * sizeCoefficient, 32 * sizeCoefficient) // makes SVG icons work in IE
        })

        // Prevent users from repositioning markers
        marker.setDraggable(false)
      })

      // The spiderfier binds click itself and only listens for
      // 'position_changed' and 'visible_changed', so plain mouseover/mouseout
      // are free to add here without it interfering.
      marker.addListener('mouseover', () => {
        if (marker._spiderfiable) return
        this.showCard(site, marker, false)
      })
      marker.addListener('mouseout', () => this.scheduleCardClose())

      this.oms.addMarker(marker, e => {
        this.showCard(site, marker, true)
      })
      this.siteMarkers.push(marker)
    },

    /**
     * Show the card for a site, anchored to its marker.
     *
     * `pinned` marks a deliberate click, which keeps the card open until the
     * user dismisses it. Hover leaves it unpinned so it closes itself.
     */
    async showCard (site, marker, pinned) {
      clearTimeout(this.hoverCloseTimer)
      if (pinned) this.cardPinned = true

      // Kick off the schedule lookup but do not wait for it: the card should
      // appear the instant the pointer arrives and fill in the "next free" line
      // when the answer comes back.
      this.requestSchedule(site)

      // Already anchored here: re-running setContent/open would make the card
      // visibly flash every time the pointer jitters on one marker. The content
      // still updates, because it is the same element either way.
      const sameAnchor = this.iw.getAnchor() === marker
      this.activeSite = site
      if (sameAnchor) return

      // Let Vue render the new site before handing the node over. Rendering is
      // async, so without this Google is given -- and measures -- a card that
      // has not been filled in yet.
      await this.$nextTick()
      if (!this.$refs.card) return

      this.iw.setContent(this.$refs.card.$el)
      this.iw.open(this.map, marker)
    },

    onCardEnter () {
      clearTimeout(this.hoverCloseTimer)
    },

    /**
     * Ask for a site's schedule, once the pointer has settled.
     *
     * Sweeping across a spiderfied group fires mouseover on every marker on the
     * way, so this waits to see whether the student actually stopped on one.
     * The store adds a TTL cache and an in-flight guard behind it.
     */
    requestSchedule (site) {
      if (!site) return
      clearTimeout(this.scheduleFetchTimer)
      this.scheduleFetchTimer = setTimeout(() => {
        this.fetchUpcomingEvents(site.site)
      }, SCHEDULE_DEBOUNCE_MS)
    },

    // Unknown counts as bookable -- see the isBookableNow getter.
    siteIsBookableNow (site) {
      return this.isBookableNow(site)
    },

    scheduleCardClose () {
      if (this.cardPinned) return
      clearTimeout(this.hoverCloseTimer)
      this.hoverCloseTimer = setTimeout(() => this.iw.close(), HOVER_CLOSE_MS)
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

    // The sites to draw: one marker per telescope.
    //
    // Previously one per wema, which reads oddly under a button that says "Use
    // this Telescope" -- and a wema hosting several observatories gave that
    // button no correct answer. Observatories inherit their wema's coordinates,
    // so co-located telescopes stack on one point; that is what the spiderfier
    // is for, and clicking the '+' fans them out.
    //
    // A wema with no observatory of its own would vanish here, so it is kept:
    // it is the only marker that site would ever get.
    //
    // Sites absent from /allopenstatus are no longer filtered out -- a
    // telescope we have no status for is still a telescope, drawn grey and
    // labelled Unknown. See getSiteMapColor for the fallback that makes that
    // safe.
    // Every telescope, before the toolbar filters are applied. Split out so the
    // bookable fan-out can ask about all of them rather than only the ones that
    // happen to survive the filter it is about to feed.
    candidateSites () {
      const all = this.all_sites_real
      const wemas_with_obs = new Set(
        all.filter(s => s.instance_type !== 'wema').map(s => s.wema_name))

      return all.filter(s =>
        s.instance_type !== 'wema' || !wemas_with_obs.has(s.site))
    },

    mapSites () {
      let sites = this.candidateSites()

      if (this.darkOnly) {
        const now = new Date()
        sites = sites.filter(s => siteIsDark(s, now))
      }
      if (this.bookableOnly) {
        sites = sites.filter(s => this.siteIsBookableNow(s))
      }
      return sites
    },

    async initMap () {
      await this.getSiteOpenStatus()
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

      const iw = new google.maps.InfoWindow({ maxWidth: 300 })
      this.iw = iw

      const unpin = () => { this.cardPinned = false }
      function iwClose () { iw.close() }
      google.maps.event.addListener(this.map, 'click', () => { unpin(); iwClose() })
      iw.addListener('closeclick', unpin)

      // One implementation, called from both places, so the two cannot draw
      // different markers for the same site.
      //
      // Deferred to the map's first 'idle': the spiderfier throws if a marker
      // is added before then, since it cannot tell what overlaps until the map
      // has a viewport. If the map is already idle this fires immediately.
      google.maps.event.addListenerOnce(this.map, 'idle', () => {
        this.redrawMapSites()
      })

      // Sites cross the darkness threshold as the night moves. Deliberately not
      // folded into the 10s sun/terminator intervals above: a redraw clears
      // every marker, which closes the open card and collapses any spiderfied
      // group. This one only redraws when the marker set actually changed, and
      // never while the user is reading a pinned card.
      this.darkRecheckInterval = setInterval(() => {
        if (!this.darkOnly || this.cardPinned) return
        const key = this.mapSites().map(s => s.site).sort().join(',')
        if (key !== this.lastMarkerKey) this.redrawMapSites()
      }, DARK_RECHECK_MS)
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

    /*
      Colours come from all_sites_status_color, which is shared with the navbar
      dropdown and the quick site switcher so a site's dot means one thing
      everywhere. Its rule:

        nothing reporting (offline)           -> grey
        some subsystems stale                 -> yellow
        all fresh, roof open                  -> green
        all fresh, roof shut for bad weather  -> red
        all fresh, roof shut otherwise        -> yellow

      Grey is "we do not know", not "bad": a site that has stopped reporting
      tells us nothing about its roof or weather. Red is reserved for a fault
      we can actually see. The shut colours match what the card writes the word
      "Shut" in (see utils/site_availability.js).

      Markers are per observatory now, and an observatory inherits its wema's
      roof, so a simulated obs reporting an open roof under a wema reporting the
      real one shut will differ from the sites pulldown, which colours each
      record on its own.

      The grey fallback is load-bearing: all_sites_status_color only has keys
      for sites present in /allopenstatus, and the map no longer filters the
      others out. Without it an unknown site yields undefined, makeIcon throws
      inside the draw loop, and NO markers render at all.
    */
    getSiteMapColor (site) {
      const colors = {
        'status-yellow': { r: 221, g: 156, b: 0 },
        'status-red': { r: 205, g: 0, b: 0 },
        'status-green': { r: 53, g: 154, b: 34 },
        'status-grey': { r: 100, g: 100, b: 100 }
      }
      return colors[this.all_sites_status_color[site]] || colors['status-grey']
    },

    async redrawMapSites () {
      // Can be triggered by the all_sites_real watcher before initMap has run,
      // which with an async Maps API means google.maps may not exist yet.
      if (!this.map) { return }

      // The spiderfier is set up by initMap and is what renders the site code
      // into the icon, so there is nothing to draw before it exists.
      if (!this.oms) { return }

      this.clearSiteMarkers()

      const sites = this.mapSites()

      // For each site, draw a marker whose card opens on hover or click.
      // The whole site record is passed through rather than a pre-rendered
      // string: the card is a component now and reads what it needs itself.
      sites.forEach(site => {
        this.addMarkerWithData({
          lat: site.latitude,
          lng: site.longitude,
          rgb: this.getSiteMapColor(site.site),
          site,
          name: site.site.toUpperCase()
        })
      })

      this.lastMarkerKey = sites.map(s => s.site).sort().join(',')
    }

  },

  computed: {
    ...mapState('site_config', ['test_sites']),
    ...mapGetters('site_config', ['all_sites_real']),
    ...mapState('sitestatus', ['site_open_status']),
    ...mapGetters('sitestatus', ['all_sites_status_color']),
    ...mapGetters('calendar', ['isBookableNow'])
  }
}
</script>

<style lang="scss" scoped>
/* Only the host is hidden. The card itself carries no display rule, so it shows
   normally once the InfoWindow has moved it out of here. */
.card-host {
  display: none;
}

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
