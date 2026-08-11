<template>
  <canvas
    :id="canvas_id"
    ref="canvas"
    :width="width+'px'"
    :height="height+'px'"
    :class="{ 'mouse-in-sky': mouse_in_sky }"
    class="interaction-layer-canvas"
  />
</template>

<script>
export default {
  name: 'InteractionCanvas',
  props: {
    canvas_id: {
      type: String,
      default: 'interaction-canvas'
    },
    width: {
      type: Number,
      default: 200
    },
    height: {
      type: Number,
      default: 200
    },
    user_crosshairs: {
      type: Array,
      default: () => [-1, -1], // render offscreen
      validator: val => {
        const correct_size = val.length == 2
        const all_elements_are_numbers = val.every(i => {
          return typeof i === 'number'
        })
        return correct_size && all_elements_are_numbers
      }
    },
    telescope_crosshairs: {
      type: Array,
      default: () => [-1, -1], // render offscreen
      validator: val => {
        const correct_size = val.length == 2
        const all_elements_are_numbers = val.every(i => {
          return typeof i === 'number'
        })
        return correct_size && all_elements_are_numbers
      }
    },
    // Four corners of the camera field of view, in relative coordinates, plus
    // whether they are the camera's true angular size or have been enlarged to
    // stay visible. Null hides the box.
    // { corners: [[x,y], [x,y], [x,y], [x,y]], to_scale: Boolean }
    telescope_fov: {
      type: Object,
      default: null,
      validator: val => {
        if (val === null) { return true }
        return Array.isArray(val.corners) &&
          val.corners.length == 4 &&
          val.corners.every(c => Array.isArray(c) && c.length == 2 && c.every(i => typeof i === 'number'))
      }
    },
    // This changes the cursor style if the mouse is in the sky 'circle'.
    mouse_in_sky: {
      type: Boolean,
      default: false
    }
  },

  mounted () {
    this.canvas = this.$refs.canvas
    this.ctx = this.canvas.getContext('2d')
    const that = this

    // Send click / drag events to parent component
    this.canvas.addEventListener('mousedown', function (e) {
      mousemove(e)
      this.addEventListener('mousemove', mousemove)
      this.addEventListener('mouseup', mouseup)
      function mousemove (e) {
        that.$emit('i_mousedown', [e.offsetX, e.offsetY])
      }
      function mouseup () {
        this.removeEventListener('mousemove', mousemove)
        this.removeEventListener('mouseup', mouseup)
      }
    })

    // Send wheel events to the parent, which zooms the sky chart. This layer
    // covers the celestial canvas, so d3-celestial would never see the wheel
    // itself; the chart drives zoom through Celestial.zoomBy() instead.
    this.canvas.addEventListener('wheel', function (e) {
      e.preventDefault()
      that.$emit('i_wheel', Math.sign(e.deltaY))
    }, { passive: false })

    // Send mouse position to parent.
    this.canvas.addEventListener('mouseover', function (e) {
      this.addEventListener('mousemove', mousemove)
      this.addEventListener('mouseout', mouseout)
      function mousemove (e) {
        that.$emit('i_mouseover', [e.offsetX, e.offsetY])
      }
      function mouseout () {
        this.removeEventListener('mousemove', mousemove)
        this.removeEventListener('mouseout', mouseout)
      }
    })

    this.redraw_all()
  },

  watch: {
    user_crosshairs () {
      this.redraw_all()
    },

    telescope_crosshairs () {
      this.redraw_all()
    },

    telescope_fov () {
      this.redraw_all()
    },

    // Since map is fixed proportionally, no need to check height change
    width () {
      // Wait until the canvas has resized (and reset) before drawing
      this.$nextTick(this.redraw_all)
    }
  },

  computed: {
    // Convert relative coordinates to raw pixel coordinates
    user_xy_pixels () {
      return [
        this.user_crosshairs[0] * this.width,
        this.user_crosshairs[1] * this.height
      ]
    },

    // Convert relative coordinates to raw pixel coordinates
    telescope_xy_pixels () {
      return [
        this.telescope_crosshairs[0] * this.width,
        this.telescope_crosshairs[1] * this.height
      ]
    }
  },

  methods: {
    redraw_all () {
      this.clear_canvas()
      this.draw_user_crosshairs()
      // Drawn before the reticle so the crosshair stays on top of the box.
      this.draw_telescope_fov()
      this.draw_telescope_crosshairs()
    },

    // Outline of the camera's field of view, centered on the telescope reticle.
    // Solid when the box is the camera's true angular size; dashed when it has
    // been enlarged to stay visible, so an enlarged box never reads as a
    // measurement.
    draw_telescope_fov () {
      if (this.telescope_fov === null) { return }
      const corners = this.telescope_fov.corners.map(
        ([x, y]) => [x * this.width, y * this.height]
      )
      this.ctx.strokeStyle = 'greenyellow'
      this.ctx.lineWidth = 1
      if (!this.telescope_fov.to_scale) { this.ctx.setLineDash([4, 3]) }
      this.ctx.beginPath()
      this.ctx.moveTo(corners[0][0], corners[0][1])
      corners.slice(1).forEach(([x, y]) => this.ctx.lineTo(x, y))
      this.ctx.closePath()
      this.ctx.stroke()
      // The context is shared with the crosshairs, which must stay solid.
      this.ctx.setLineDash([])
    },

    draw_user_crosshairs () {
      if (this.user_crosshairs.every(i => i == -1)) { return }
      const [x, y] = this.user_xy_pixels
      const r = 18
      const r2 = 4
      this.ctx.strokeStyle = '#df2437'
      this.ctx.lineWidth = 1.5
      this.ctx.beginPath()
      this.ctx.moveTo(x, y - r)
      this.ctx.lineTo(x, y - r2)
      this.ctx.moveTo(x, y + r)
      this.ctx.lineTo(x, y + r2)
      this.ctx.moveTo(x - r, y)
      this.ctx.lineTo(x - r2, y)
      this.ctx.moveTo(x + r, y)
      this.ctx.lineTo(x + r2, y)
      this.ctx.closePath()
      this.ctx.stroke()
    },

    draw_telescope_crosshairs () {
      if (this.telescope_crosshairs.every(i => i == -1)) { return }
      const [x, y] = this.telescope_xy_pixels
      const size = 220
      const s = Math.sqrt(size)
      const r = s / 2
      this.ctx.strokeStyle = 'greenyellow'
      this.ctx.lineWidth = 1.5
      this.ctx.beginPath()
      this.ctx.moveTo(x, y - s)
      this.ctx.lineTo(x, y + s)
      this.ctx.moveTo(x - s, y)
      this.ctx.lineTo(x + s, y)
      this.ctx.closePath()
      this.ctx.stroke()
      this.ctx.beginPath()
      this.ctx.moveTo(x, y)
      this.ctx.arc(x, y, r, 0, 2 * Math.PI)
      this.ctx.closePath()
      this.ctx.stroke()
    },

    clear_canvas () {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }
  }
}
</script>

<style lang="scss" scoped>

/* Lots of !important tags to override default d3-celestial styles */
.interaction-layer-canvas {
    position: absolute !important;
    top: 0;
    left: 0;
    z-index: 1 !important;
    cursor: unset !important;
}

.mouse-in-sky:hover {
    cursor: crosshair !important
}
</style>
