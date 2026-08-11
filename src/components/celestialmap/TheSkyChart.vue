<template>
  <div class="skychart-frame">
    <div id="celestial-map">
      <interaction-canvas
        v-if="skychartCreated"
        ref="interaction"
        :width="celestial_canvas_width"
        :height="celestial_canvas_height"
        :user_crosshairs="user_crosshairs"
        :telescope_crosshairs="telescope_crosshairs"
        :telescope_fov="telescope_fov"
        :show_telescope="show_reticle"
        :show_target="show_target_marker"
        :mouse_in_sky="mouse_in_sky"
        @i_mousedown="handle_mousedown"
        @i_mouseup="handle_mouseup"
        @i_mousemove="handle_mousemove"
        @i_mouseover="handle_mouseover"
        @i_wheel="handle_wheel"
      />
    </div>

    <!-- Kept outside #celestial-map so a Celestial reload, which empties that
         element, cannot take the controls with it. -->
    <div
      v-if="skychartCreated"
      class="chart-controls"
    >
      <!-- Each marker can be hidden independently, so the field of view can be
           read on its own: at low zoom the box is almost exactly the size of
           the reticle drawn on top of it. -->
      <div class="control-group">
        <button
          type="button"
          class="chart-button is-fov"
          :class="{ 'is-off': !showCameraFov }"
          :aria-pressed="String(showCameraFov)"
          :title="showCameraFov ? 'Hide camera field of view' : 'Show camera field of view'"
          @click="$emit('toggle-camera-fov', !showCameraFov)"
        >
          &#9645;
        </button>
        <button
          type="button"
          class="chart-button is-reticle"
          :class="{ 'is-off': !show_reticle }"
          :aria-pressed="String(show_reticle)"
          :title="show_reticle ? 'Hide telescope pointing' : 'Show telescope pointing'"
          @click="show_reticle = !show_reticle"
        >
          &#8982;
        </button>
        <button
          type="button"
          class="chart-button is-target"
          :class="{ 'is-off': !show_target_marker }"
          :aria-pressed="String(show_target_marker)"
          :title="show_target_marker ? 'Hide selected target' : 'Show selected target'"
          @click="show_target_marker = !show_target_marker"
        >
          +
        </button>
      </div>

      <div class="control-group">
        <button
          type="button"
          class="chart-button"
          title="Zoom in"
          :disabled="!can_zoom_in"
          @click="zoom_in"
        >
          +
        </button>
        <button
          type="button"
          class="chart-button"
          title="Zoom out"
          :disabled="!can_zoom_out"
          @click="zoom_out"
        >
          &minus;
        </button>
        <button
          type="button"
          class="zoom-readout"
          title="Reset zoom"
          :disabled="!can_zoom_out"
          @click="zoom_reset"
        >
          {{ zoom_label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import InteractionCanvas from '@/components/celestialmap/InteractionCanvas'
import celestial from 'd3-celestial'
import add_custom_data from '@/components/celestialmap/add_custom_data'
import { base_config, star_catalogues } from '@/components/celestialmap/skymap_config'
import helpers from '@/utils/helpers'
import { mapGetters } from 'vuex'

const Celestial = celestial.Celestial()

// Zoom applied per button click or wheel notch.
const ZOOM_STEP = 1.5

// How long to gather zoom input before applying it. A wheel spin arrives as a
// burst of notches and each apply costs a chart redraw, so they are collapsed
// into one.
const ZOOM_COALESCE_MS = 80

// Smallest the camera field of view box may be drawn, in pixels. The all-sky
// view is roughly 4px per degree, so a sub-degree camera would otherwise be a
// speck smaller than the reticle it sits inside. A box below this is enlarged
// to it and drawn dashed, so an enlarged box is never mistaken for a measurement.
const MIN_FOV_BOX_PX = 14

// How far to place the probe points used to measure the local north and east
// directions on screen. Small enough that the map barely curves over it, large
// enough that the projected offset is well clear of pixel rounding.
const PROBE_DEGREES = 0.5

export default {
  name: 'TheSkyChart',
  components: { InteractionCanvas },
  props: {
    showStars: {
      type: Boolean,
      default: true
    },
    showGalaxies: {
      type: Boolean,
      default: true
    },
    showNebula: {
      type: Boolean,
      default: true
    },
    showGlobularClusters: {
      type: Boolean,
      default: true
    },
    showOpenClusters: {
      type: Boolean,
      default: true
    },
    showMoon: {
      type: Boolean,
      default: true
    },
    showSun: {
      type: Boolean,
      default: true
    },
    showMilkyWay: {
      type: Boolean,
      default: true
    },
    showPlanets: {
      type: Boolean,
      default: true
    },

    starMagMin: {
      type: Number,
      default: 5
    },
    starMagMax: {
      type: Number,
      default: 0
    },
    galaxyMagMin: {
      type: Number,
      default: 10
    },
    galaxyMagMax: {
      type: Number,
      default: 0
    },
    nebulaMagMin: {
      type: Number,
      default: 10
    },
    nebulaMagMax: {
      type: Number,
      default: 0
    },
    globularClusterMagMin: {
      type: Number,
      default: 10
    },
    globularClusterMagMax: {
      type: Number,
      default: 0
    },
    openClusterMagMin: {
      type: Number,
      default: 10
    },
    openClusterMagMax: {
      type: Number,
      default: 0
    },

    showAirmassCircle: {
      type: Boolean,
      default: true
    },
    // Off by default: the box is only meaningful once zoomed in far enough to
    // read it, so showing it on load would put a permanent speck on the
    // reticle for users who never asked for it.
    showCameraFov: {
      type: Boolean,
      default: false
    },
    // Used only to notice that the user moved to another observatory, which
    // resets the chart controls.
    sitecode: {
      type: String,
      default: ''
    },
    degAboveHorizon: {
      type: Number,
      default: 30
    },

    use_custom_date_location: {
      type: Boolean,
      default: false
    },
    show_live_chart: {
      type: Boolean,
      default: true
    },
    date: {
      type: Date,
      required: false
    },
    location: {
      type: Array,
      default: () => [0, 0]
    }
  },
  data () {
    return {
      // Used to make sure the interaction layer starts up after the main sky chart is loaded
      skychartCreated: false,

      // These values are used to keep the interaction canvas size identical
      celestial_canvas_width: 200,
      celestial_canvas_height: 200,

      // These are the pixel coordinate values for drawing to the interaction canvas
      user_crosshairs: [-1, -1],
      telescope_crosshairs: [-1, -1],

      // Camera field of view outline around the telescope reticle, or null when
      // it is switched off or the camera size is unknown.
      telescope_fov: null,

      // Which markers the overlay draws. Toggled from the chart controls so the
      // field of view can be looked at on its own.
      show_reticle: true,
      show_target_marker: true,

      // The zoom the user asked for, as a multiple of the all-sky scale, and
      // the authority on what the chart should be showing. Several things
      // rebuild the projection at the configured zoom rather than the current
      // one -- a window resize is the common one -- so the level is reapplied
      // on every redraw rather than assumed to have stuck.
      desired_zoom: 1,
      zoom_level: 1,
      restoring_zoom: false,

      // What the map is centred on: 'zenith' for the all-sky view, 'telescope'
      // once zoomed in, plus the [ra, dec] it was last centred on. See
      // follow_target().
      following: 'zenith',
      followed_center: null,
      zoom_apply_queued: false,
      star_catalogue: star_catalogues.shallow,

      // Whether or not the mouse is hovering over the sky part of the map.
      mouse_in_sky: false,
      airmassCircleIsHovered: false,

      resize_observer: ''
    }
  },

  mounted () {
    const config = base_config

    config.stars.show = this.showStars
    config.stars.limit = this.starMagMin
    config.mw.show = this.showMilkyWay
    config.planets.which = this.planetsList

    Celestial.customData = {
      stars: {
        show: this.showStars,
        minMagnitude: this.starMagMin,
        maxMagnitude: this.starMagMax
      },
      galaxies: {
        show: this.showGalaxies,
        minMagnitude: this.galaxyMagMin,
        maxMagnitude: this.galaxyMagMax
      },
      nebula: {
        show: this.showNebula,
        minMagnitude: this.nebulaMagMin,
        maxMagnitude: this.nebulaMagMax
      },
      globularClusters: {
        show: this.showGlobularClusters,
        minMagnitude: this.globularClusterMagMin,
        maxMagnitude: this.globularClusterMagMax
      },
      openClusters: {
        show: this.showOpenClusters,
        minMagnitude: this.openClusterMagMin,
        maxMagnitude: this.openClusterMagMax
      },
      airmassCircle: {
        show: this.showAirmassCircle,
        degAboveHorizon: this.degAboveHorizon,
        isHovered: this.airmassCircleIsHovered
      }
    }

    // Add custom data to display on the map
    const custom_data_path = ['/data/all_objects.json', '/data/galactic_points.json']
    add_custom_data(Celestial, config, custom_data_path)
    // add_custom_data(Celestial, config, galactic_data_path);

    // Load the configuration and display the map
    Celestial.display(config)

    // Set the location to display
    Celestial.location([this.site_latitude, this.site_longitude])

    // This toggles the v-if in the interaction layer canvas.
    // We need to make sure the map canvas is loaded first, otherwise
    // it will load using the interaction canvas element.
    this.skychartCreated = true

    // Get the d3-celestial canvas element. To distinguish from our interaction canvas,
    // get the canvas without an ID.
    const canvas_list = document.getElementById('celestial-map').querySelectorAll('canvas')
    const celestial_canvas = Array.from(canvas_list).find(e => e.id == '')

    // Update the values that are fed into the interaction layer to match the sky chart
    this.celestial_canvas_width = celestial_canvas.width
    this.celestial_canvas_height = celestial_canvas.height

    // Add a resize observer to the skychart to keep the interaction layer size synced
    this.resize_observer = new ResizeObserver(elements => {
      for (const element of elements) {
        const content_rect = element.contentRect
        this.celestial_canvas_width = content_rect.width
        this.celestial_canvas_height = content_rect.height
        this.redraw_interaction_layer()
      }
    })
    this.resize_observer.observe(celestial_canvas)

    // Update everything the interaction layer draws whenever the underlying map
    // is redrawn. This must be a single registration: addCallback keeps one
    // function rather than a list, so registering the two crosshair updates
    // separately meant the second quietly replaced the first and the telescope
    // reticle was never refreshed on redraw. Redraws include zoom, which is
    // what keeps the overlay pinned to the chart while zooming.
    Celestial.addCallback(this.redraw_overlays)

    this.redraw_overlays()

    // Update the center of the map every minute
    this.updateMapCenterInterval = setInterval(this.rotate, 6000)
  },

  beforeDestroy () {
    this.resize_observer.disconnect()
    clearInterval(this.updateMapCenterInterval)
    clearTimeout(this.zoom_apply_timer)
  },

  methods: {

    /** The following few handler methods deal with data coming from the interaction layer */
    handle_mousedown (e) {
      const map_coords = Celestial.mapProjection.invert(e)

      // If the click fell within the visible horizon (not outside the map)
      if (Celestial.clip(map_coords)) {
        this.user_crosshairs = this.pix_to_relative(e) // update the visible interaction layer
        // Save the selected ra/dec
        map_coords[0] = helpers.degree2hour(map_coords[0])
        this.$store.commit('command_params/mount_ra', map_coords[0].toFixed(4))
        this.$store.commit('command_params/mount_dec', map_coords[1].toFixed(4))
      }
    },
    handle_mouseup (e) { },
    handle_mousemove (e) { },
    handle_mouseover (e) { // Determine whether the mouse is inside the map or not
      const map_coords = Celestial.mapProjection.invert(e)
      this.mouse_in_sky = !!Celestial.clip(map_coords) // !! converts 0 or 1 to boolean

      // Check and store the state of whether the user is hovering over the airmass circle
      const zenith = Celestial.zenith()
      const zenithXY = Celestial.mapProjection(zenith)
      const horizonXY = Celestial.mapProjection([zenith[0], zenith[1] - (90 - this.degAboveHorizon)]) // get a point on the horizon
      const circleRadius = Math.abs(zenithXY[1] - horizonXY[1])
      const radiusToCenter = Math.sqrt((e[0] - zenithXY[0]) ** 2 + (e[1] - zenithXY[1]) ** 2)
      const tolerance = 7 // how many pixels away should register as a hover event
      this.airmassCircleIsHovered = (tolerance >= Math.abs(radiusToCenter - circleRadius))
    },

    handle_wheel (direction) {
      if (direction < 0) { this.zoom_in() } else { this.zoom_out() }
    },

    rotate () {
      if (this.use_custom_date_location) return
      Celestial.date(new Date())
    },

    /** Everything the interaction layer draws, refreshed together.
     *
     * The field of view is recomputed first so the crosshair updates that
     * follow redraw the layer with a box that is already current.
     */
    redraw_overlays () {
      this.restore_zoom()
      this.compute_telescope_fov()
      this.update_telescope_crosshairs()
      this.update_user_crosshairs()
    },

    /** Put the projection back to the zoom the user asked for.
     *
     * Celestial.resize() rebuilds the projection at the zoom level in the
     * config rather than the current one, and d3-celestial listens for window
     * resizes itself, so the chart can drop back to all-sky without the
     * component being told. Every path that does this ends in a redraw, and
     * this runs from the redraw callback, so reconciling here covers all of
     * them rather than chasing each one. Without it the readout keeps claiming
     * a zoom the chart is no longer at.
     */
    restore_zoom () {
      if (this.restoring_zoom) return
      const actual = Celestial.zoomBy()
      if (Number.isFinite(actual) && Math.abs(actual - this.desired_zoom) > 0.001) {
        this.restoring_zoom = true
        Celestial.zoomBy(this.desired_zoom / actual)
        this.restoring_zoom = false
      }
      this.zoom_level = Celestial.zoomBy()
    },

    /** Zoom about the center of the map, which is the zenith.
     *
     * d3-celestial's own zoom handlers are unused: they bind to the celestial
     * canvas, which the interaction layer covers, so they would never see the
     * events; and their drag gesture rotates the map, which the zenith
     * re-centre on the rotate interval would immediately undo.
     */
    /** Ask for a zoom level, applying it at most once per frame.
     *
     * A full chart redraw costs 150-300ms -- that is d3-celestial's own
     * rendering, not ours, and it went unnoticed while the map only redrew
     * every six seconds. Zoom makes redraws interactive, so applying every
     * wheel notch or repeated click as it arrives queues seconds of blocking
     * work and locks the tab. Bursts are coalesced into a single apply; the
     * readout still updates immediately so the control stays responsive.
     *
     * A timer rather than requestAnimationFrame: rAF does not fire while the
     * tab is in the background, which left the guard below latched on and
     * zooming dead until the component remounted. The guard is cleared in a
     * finally so a throw cannot strand it either.
     */
    set_zoom (target) {
      this.desired_zoom = Math.min(Math.max(target, 1), base_config.zoomextend)
      this.zoom_level = this.desired_zoom
      if (this.zoom_apply_queued) return
      this.zoom_apply_queued = true
      this.zoom_apply_timer = setTimeout(() => {
        try {
          this.restore_zoom()
          this.follow_target()
          this.sync_star_catalogue()
          this.redraw_overlays()
        } finally {
          this.zoom_apply_queued = false
        }
      }, ZOOM_COALESCE_MS)
    },

    /** Keep what is being inspected in view while zoomed in.
     *
     * Following the zenith is right for an all-sky view but wrong once zoomed:
     * the telescope is usually tens of degrees from the zenith, so past about
     * 1.6x the reticle -- and the field of view box drawn on it -- left the
     * canvas entirely, which defeats the point of zooming in to look at it.
     * Above 1x the map follows the mount instead, and returns to the zenith on
     * zooming back out.
     *
     * Handing d3-celestial follow: 'center' also stops the six-second tick
     * fighting this: its re-centre only fires while follow is 'zenith'.
     *
     * Sites with no mount status, WEMAs among them, keep following the zenith,
     * since there is no pointing to follow.
     */
    follow_target () {
      const ra = helpers.hour2degree(parseFloat(this.mount_pointing_ra.val))
      const dec = parseFloat(this.mount_pointing_dec.val)
      const can_follow = Number.isFinite(ra) && Number.isFinite(dec)

      if (this.desired_zoom > 1 && can_follow) {
        // Re-centring redraws the whole chart, so skip it when the centre has
        // not actually moved -- otherwise every zoom step pays for a rotation
        // to where the map already is.
        const centred = this.followed_center
        if (this.following === 'telescope' && centred && centred[0] === ra && centred[1] === dec) return
        this.following = 'telescope'
        this.followed_center = [ra, dec]
        Celestial.rotate({ follow: 'center', center: [ra, dec, 0] })
      } else if (this.following !== 'zenith') {
        this.following = 'zenith'
        this.followed_center = null
        Celestial.rotate({ follow: 'zenith', center: Celestial.zenith() })
      }
    },

    zoom_in () {
      this.set_zoom(this.desired_zoom * ZOOM_STEP)
    },

    zoom_out () {
      this.set_zoom(this.desired_zoom / ZOOM_STEP)
    },

    zoom_reset () {
      this.set_zoom(1)
    },

    /** Put the chart controls back to their defaults.
     *
     * Called on moving to another observatory. The zoom, what the map is
     * following and which markers are hidden are all judgements about the site
     * you were just looking at, and carrying them silently to the next one
     * leaves it zoomed into an unrelated patch of sky with markers missing.
     */
    reset_controls () {
      this.show_reticle = true
      this.show_target_marker = true
      this.$emit('toggle-camera-fov', false)
      this.zoom_reset()
    },

    /** Swap the star catalogue to match the zoom level.
     *
     * The naked-eye catalogue leaves a zoomed-in view looking empty, but the
     * deeper one is 6.3MB against 759KB, so it is not fetched until the zoom
     * justifies it. The two thresholds are deliberately apart: a single one
     * would reload the map every time the user crossed it.
     */
    sync_star_catalogue () {
      let wanted = this.star_catalogue
      if (this.desired_zoom >= star_catalogues.zoom_in_above) {
        wanted = star_catalogues.deep
      } else if (this.desired_zoom < star_catalogues.zoom_out_below) {
        wanted = star_catalogues.shallow
      }
      if (wanted === this.star_catalogue) return

      this.star_catalogue = wanted
      // Only the data file is passed. Celestial merges config key by key, so
      // the magnitude limit the user set in the sidebar survives the reload.
      Celestial.reload({ stars: { data: wanted } })
    },

    /** A point PROBE_DEGREES away along a bearing, measured east of north.
     *
     * The standard destination-point formula. Worth the trigonometry over the
     * usual shortcut of offsetting RA by distance/cos(dec): that shortcut
     * misstates the angular distance it actually covers as dec grows, by a
     * factor of five at dec 89.8, which squashes the box, and it divides by
     * zero at the pole. This is exact everywhere, and going over the pole comes
     * back with the right answer rather than needing a special case.
     */
    sky_offset (ra, dec, bearing) {
      const ra_rad = helpers.deg2rad(ra)
      const dec_rad = helpers.deg2rad(dec)
      const bearing_rad = helpers.deg2rad(bearing)
      const distance_rad = helpers.deg2rad(PROBE_DEGREES)

      const sin_new_dec = Math.sin(dec_rad) * Math.cos(distance_rad) +
        Math.cos(dec_rad) * Math.sin(distance_rad) * Math.cos(bearing_rad)
      const new_ra = ra_rad + Math.atan2(
        Math.sin(bearing_rad) * Math.sin(distance_rad) * Math.cos(dec_rad),
        Math.cos(distance_rad) - Math.sin(dec_rad) * sin_new_dec
      )
      return [helpers.rad2deg(new_ra), helpers.rad2deg(Math.asin(sin_new_dec))]
    },

    /** Screen direction and scale of one degree, measured off the projection.
     *
     * Returns the unit vector from a point toward its probe, in pixels, plus
     * how many pixels a degree spans along it.
     */
    projected_axis (center, probe) {
      if (!center || !probe) return null
      const dx = probe[0] - center[0]
      const dy = probe[1] - center[1]
      const length = Math.sqrt(dx * dx + dy * dy)
      if (!Number.isFinite(length) || length === 0) return null
      return {
        axis: [dx / length, dy / length],
        px_per_degree: length / PROBE_DEGREES
      }
    },

    /** Corners of the camera's field of view, for the interaction layer.
     *
     * The map is centered on the zenith, so screen-up is north along only one
     * meridian and the pixels per degree varies across the chart. Rather than
     * assume either, both are measured by projecting a probe a known angle from
     * the telescope and reading back the pixel offset -- the same trick
     * drawAirmassCircle uses in add_custom_data.js. Taking both axes from the
     * projection also gets the parity right, so the box cannot come out
     * mirrored, and reading the live projection means it picks up the current
     * zoom without being told about it.
     */
    compute_telescope_fov () {
      this.telescope_fov = null
      if (!this.showCameraFov) return

      const width_degrees = this.camera_width_degrees
      const height_degrees = this.camera_height_degrees
      if (!width_degrees || !height_degrees) return

      const ra = helpers.hour2degree(parseFloat(this.mount_pointing_ra.val))
      const dec = parseFloat(this.mount_pointing_dec.val)
      if (!Number.isFinite(ra) || !Number.isFinite(dec)) return
      if (!Celestial.clip([ra, dec])) return

      const center = Celestial.mapProjection([ra, dec])
      const north = this.projected_axis(center, Celestial.mapProjection(this.sky_offset(ra, dec, 0)))
      const east = this.projected_axis(center, Celestial.mapProjection(this.sky_offset(ra, dec, 90)))
      if (north === null || east === null) return

      let half_width = (width_degrees / 2) * east.px_per_degree
      let half_height = (height_degrees / 2) * north.px_per_degree

      // Enlarge a box too small to see, scaling both axes by the same factor so
      // the shape still reports the sensor's real aspect ratio even though the
      // size no longer reports its real extent.
      const longest_side = Math.max(half_width, half_height) * 2
      const to_scale = longest_side >= MIN_FOV_BOX_PX
      if (!to_scale) {
        const growth = MIN_FOV_BOX_PX / longest_side
        half_width *= growth
        half_height *= growth
      }

      // Turn the sky frame into the camera frame.
      const position_angle = helpers.deg2rad(this.rotator_position_angle ?? 0)
      const cos_pa = Math.cos(position_angle)
      const sin_pa = Math.sin(position_angle)
      const camera_x = [
        east.axis[0] * cos_pa + north.axis[0] * sin_pa,
        east.axis[1] * cos_pa + north.axis[1] * sin_pa
      ]
      const camera_y = [
        north.axis[0] * cos_pa - east.axis[0] * sin_pa,
        north.axis[1] * cos_pa - east.axis[1] * sin_pa
      ]

      const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([sx, sy]) => this.pix_to_relative([
        center[0] + sx * half_width * camera_x[0] + sy * half_height * camera_y[0],
        center[1] + sx * half_width * camera_x[1] + sy * half_height * camera_y[1]
      ]))

      this.telescope_fov = { corners, to_scale }
    },

    // Transform x,y array in raw pixels to relative coordinates (vals in [0,1])
    // For example: in a 200px square, this function transforms [40, 50] to [0.2, 0.25].
    // Used when sending click coordinates (pixels) to the interaction canvas (relative).
    pix_to_relative (raw_xy_array) {
      return [raw_xy_array[0] / this.celestial_canvas_width,
        raw_xy_array[1] / this.celestial_canvas_height]
    },

    // If the interaction layer has mounted, call its 'redraw' method.
    // This updates the crosshairs displayed on the map
    redraw_interaction_layer () {
      if (Object.keys(this.$refs).includes('interaction')) {
        this.$refs.interaction.redraw_all()
      }
    },

    // Update the telescope crosshair position
    update_telescope_crosshairs () {
      const t_coords = [helpers.hour2degree(this.mount_pointing_ra.val), this.mount_pointing_dec.val] // from status mixin
      const pixel_coords = Celestial.mapProjection(t_coords)
      if (Celestial.clip(t_coords)) {
        this.telescope_crosshairs = this.pix_to_relative(pixel_coords)
      } else { // don't render if not in visible map
        this.telescope_crosshairs = [-1, -1]
      }
      this.redraw_interaction_layer()
    },

    // Update the user crosshair position
    update_user_crosshairs () {
      const user_coords = ([helpers.hour2degree(this.ra_user_input), this.dec_user_input])
      const pixel_coords = Celestial.mapProjection(user_coords)
      if (Celestial.clip(user_coords)) {
        this.user_crosshairs = this.pix_to_relative(pixel_coords)
      } else {
        this.user_crosshairs = [-1, -1]
      }
      this.redraw_interaction_layer()
    },

    update_date_location () {
      Celestial.location(this.location)
      Celestial.date(this.date)
    }

  },

  watch: {
    sitecode () { this.reset_controls() },

    show_live_chart () {
      if (this.show_live_chart) {
        Celestial.location(this.site_latitude, this.site_longitude)
        Celestial.date(new Date())
      }
    },
    use_custom_date_location () {
      if (!this.use_custom_date_location) return
      this.update_date_location()
    },
    date () {
      if (!this.use_custom_date_location) return
      this.update_date_location()
    },
    location () {
      this.update_date_location()
    },

    // Update the chart if the mount pointing has changed. While zoomed in the
    // map is centred on the mount, so it has to track a slew as well.
    mount_pointing_ra () { this.follow_target(); this.update_telescope_crosshairs(); this.compute_telescope_fov() },
    mount_pointing_dec () { this.follow_target(); this.update_telescope_crosshairs(); this.compute_telescope_fov() },

    // The camera footprint also moves when the instrument, its orientation, or
    // the user's preference changes, none of which redraw the chart itself.
    showCameraFov () { this.compute_telescope_fov() },
    camera_width_degrees () { this.compute_telescope_fov() },
    camera_height_degrees () { this.compute_telescope_fov() },
    rotator_position_angle () { this.compute_telescope_fov() },

    // Update the chart if the mount command coordinates are changed
    ra_user_input () { this.update_user_crosshairs() },
    dec_user_input () { this.update_user_crosshairs() },

    site_latitude () { this.rotate() },
    site_longitude () { this.rotate() },

    showStars () {
      Celestial.apply({ stars: { show: this.showStars } })
      Celestial.customData.stars.show = this.showStars
      Celestial.redraw()
    },
    showGalaxies () {
      Celestial.customData.galaxies.show = this.showGalaxies
      Celestial.redraw()
    },
    showNebula () {
      Celestial.customData.nebula.show = this.showNebula
      Celestial.redraw()
    },
    showGlobularClusters () {
      Celestial.customData.globularClusters.show = this.showGlobularClusters
      Celestial.redraw()
    },
    showOpenClusters () {
      Celestial.customData.openClusters.show = this.showOpenClusters
      Celestial.redraw()
    },
    showMoon () {
      Celestial.reload({ planets: { which: this.planetsList } })
    },
    showSun () {
      Celestial.reload({ planets: { which: this.planetsList } })
    },
    showPlanets () {
      Celestial.reload({ planets: { which: this.planetsList } })
    },
    showMilkyWay () {
      Celestial.apply({ mw: { show: this.showMilkyWay } })
    },
    starMagMin () {
      Celestial.apply({ stars: { limit: this.starMagMin } })
      Celestial.customData.stars.minMagnitude = this.starMagMin
      Celestial.redraw()
    },
    starMagMax () {
      Celestial.customData.stars.maxMagnitude = this.starMagMax
      Celestial.redraw()
    },
    galaxyMagMin () {
      Celestial.customData.galaxies.minMagnitude = this.galaxyMagMin
      Celestial.redraw()
    },
    galaxyMagMax () {
      Celestial.customData.galaxies.maxMagnitude = this.galaxyMagMax
      Celestial.redraw()
    },
    nebulaMagMin () {
      Celestial.customData.nebula.minMagnitude = this.nebulaMagMin
      Celestial.redraw()
    },
    nebulaMagMax () {
      Celestial.customData.nebula.maxMagnitude = this.nebulaMagMax
      Celestial.redraw()
    },
    globularClusterMagMin () {
      Celestial.customData.globularClusters.minMagnitude = this.globularClusterMagMin
      Celestial.redraw()
    },
    globularClusterMagMax () {
      Celestial.customData.globularClusters.maxMagnitude = this.globularClusterMagMax
      Celestial.redraw()
    },
    openClusterMagMin () {
      Celestial.customData.openClusters.minMagnitude = this.openClusterMagMin
      Celestial.redraw()
    },
    openClusterMagMax () {
      Celestial.customData.openClusters.maxMagnitude = this.openClusterMagMax
      Celestial.redraw()
    },
    showAirmassCircle () {
      Celestial.customData.airmassCircle.show = this.showAirmassCircle
      Celestial.redraw()
    },
    degAboveHorizon () {
      Celestial.customData.airmassCircle.degAboveHorizon = this.degAboveHorizon
      Celestial.redraw()
    },
    airmassCircleIsHovered () {
      Celestial.customData.airmassCircle.isHovered = this.airmassCircleIsHovered
      Celestial.redraw()
    }

  },

  computed: {

    zoom_label () {
      return `${this.zoom_level.toFixed(1)}×`
    },

    // Compared with a small tolerance: zoomBy clamps to the extent, so the
    // reported level lands fractionally off the limit rather than on it.
    can_zoom_in () {
      return this.zoom_level < base_config.zoomextend - 0.01
    },

    can_zoom_out () {
      return this.zoom_level > 1.01
    },

    // list of planets to display
    planetsList () {
      let planets = []

      if (this.showPlanets) {
        planets = ['mer', 'ven', 'ter', 'mar', 'jup', 'sat', 'ura', 'nep']
      }
      if (this.showSun) {
        planets.push('sol')
      }
      if (this.showMoon) {
        planets.push('lun')
      }
      return planets
    },
    ...mapGetters('site_config', [
      'site_latitude',
      'site_longitude',
      'camera_width_degrees',
      'camera_height_degrees'
    ]),

    // Mount pointing status (from the status mixin), but with clearer names
    ...mapGetters('sitestatus', {
      mount_pointing_ra: 'ra',
      mount_pointing_dec: 'dec',
      // The raw number, not the formatted rotator_position used by the status
      // footer, since the footprint is rotated by it.
      rotator_position_angle: 'rotator_position_angle'
    }),

    // User-provided coordinates that would be sent in a telescope goto command.
    // They can be typed into the command field, or updated by clicking on the sky chart or aladin.
    ...mapGetters('command_params', {
      ra_user_input: 'mount_ra',
      dec_user_input: 'mount_dec'
    })
  }
}
</script>

<style lang="scss" scoped>

.skychart-frame {
    position: relative;
}

.chart-controls {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2; // above the interaction layer, which is z-index 1
    display: flex;
    gap: 4px;
    align-items: flex-start;
}

.control-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.chart-button,
.zoom-readout {
    background: rgba(8, 15, 23, 0.75);
    border: 1px solid #4a5a6a;
    border-radius: 3px;
    color: #cfd8e0;
    cursor: pointer;
    font-family: inherit;
    line-height: 1;
    padding: 0;

    // Border only: the marker toggles carry their own colour, and recolouring
    // them on hover would break the mapping to what they draw.
    &:hover:not(:disabled) {
        border-color: greenyellow;
    }

    &:focus-visible {
        outline: 1px solid greenyellow;
        outline-offset: 1px;
    }

    &:disabled {
        cursor: default;
        opacity: 0.4;
    }
}

.chart-button {
    font-size: 1.1rem;
    height: 26px;
    width: 26px;
}

// The marker toggles carry the colour of the thing they draw, so the mapping
// to what is on the chart needs no label. Off is drawn as a dimmed outline.
.is-fov,
.is-reticle {
    color: greenyellow;
}

.is-target {
    color: #df2437;
}

.chart-button.is-off {
    color: #6d7883;

    &:hover {
        color: #cfd8e0;
    }
}

.zoom-readout {
    font-size: 0.65rem;
    font-variant-numeric: tabular-nums;
    padding: 4px 0;
    width: 26px;
}

</style>
