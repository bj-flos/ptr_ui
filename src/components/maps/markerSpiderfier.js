/**
 * Fan out markers that sit on top of each other, for AdvancedMarkerElement.
 *
 * This replaces OverlappingMarkerSpiderfier 1.0.3, which was loaded from a CDN
 * script tag and worked only with google.maps.Marker: it calls marker.setMap(),
 * listens for 'position_changed' and 'visible_changed', and formats icons
 * through a 'spider_format' event, none of which AdvancedMarkerElement has.
 * Marker is deprecated and the library is unmaintained -- last published 2016 --
 * so the behaviour lives here instead.
 *
 * Observatories inherit their wema's coordinates, so co-located telescopes land
 * on exactly the same point. Collapsed they show a '+'; clicking fans them onto
 * a circle with a leg drawn back to where they really are.
 *
 * What it deliberately does NOT do is cluster. Every marker stays on the map at
 * its own point, which is what lets a group of two show two '+' glyphs rather
 * than one combined symbol.
 */

const TWO_PI = Math.PI * 2

export const markerStatus = {
  UNSPIDERFIABLE: 'UNSPIDERFIABLE',
  SPIDERFIABLE: 'SPIDERFIABLE',
  SPIDERFIED: 'SPIDERFIED'
}

/* A position set as {lat, lng} comes back out of AdvancedMarkerElement as a
   LatLng, whose lat and lng are methods rather than numbers. Everything below
   works in plain numbers, so positions are normalised on the way in. */
function toLiteral (position) {
  if (!position) return null
  return {
    lat: typeof position.lat === 'function' ? position.lat() : position.lat,
    lng: typeof position.lng === 'function' ? position.lng() : position.lng
  }
}

export default class MarkerSpiderfier {
  /**
   * @param {google.maps.Map} map
   * @param {object} opts
   *   nearbyDistance       px between markers that counts as overlapping
   *   circleFootSeparation px of arc between feet of the fanned-out circle
   *   keepSpiderfied       a click on a fanned-out marker leaves the fan open
   *   legWeight/legColor   the line drawn back to the true position
   */
  constructor (map, opts = {}) {
    this.map = map
    this.nearbyDistance = opts.nearbyDistance || 20
    this.circleFootSeparation = opts.circleFootSeparation || 23
    this.keepSpiderfied = opts.keepSpiderfied || false
    this.legWeight = opts.legWeight || 1.5
    this.legColor = opts.legColor || '#ffffff'

    this.entries = []
    this.legs = []
    // The markers currently fanned out, by identity rather than by index: the
    // entry list is rebuilt on every redraw.
    this.spiderfied = new Set()

    this.listeners = [
      map.addListener('click', () => this.unspiderfy()),
      // A zoom changes what overlaps, so any open fan is stale and every
      // marker may need a different glyph.
      map.addListener('zoom_changed', () => { this.unspiderfy(); this.refresh() }),
      map.addListener('idle', () => this.refresh())
    ]
  }

  /**
   * @param {google.maps.marker.AdvancedMarkerElement} marker
   *   Its `content` must be an element the caller keeps and mutates: the click
   *   and hover listeners are bound to it, so replacing the node would drop
   *   them silently.
   * @param {object} handlers
   *   onClick(marker)          a real click, once the marker is not a '+'
   *   onFormat(status, marker) called whenever the marker's status changes
   */
  addMarker (marker, handlers = {}) {
    const entry = {
      marker,
      // Where the marker actually is. marker.position moves while fanned out,
      // so the truth has to be kept separately.
      base: toLiteral(marker.position),
      onClick: handlers.onClick,
      onFormat: handlers.onFormat,
      status: null
    }
    this.entries.push(entry)

    const el = marker.content
    if (el && el.addEventListener) {
      el.addEventListener('click', ev => {
        // Otherwise the click reaches the map, whose own handler closes the
        // card this click was meant to open.
        ev.stopPropagation()
        this.handleClick(entry)
      })
    }
    this.refresh()
    return entry
  }

  removeMarker (marker) {
    const i = this.entries.findIndex(e => e.marker === marker)
    if (i === -1) return
    this.spiderfied.delete(this.entries[i])
    this.entries.splice(i, 1)
    if (this.spiderfied.size === 0) this.clearLegs()
  }

  /** Drop every marker and listener. */
  destroy () {
    this.unspiderfy()
    this.entries = []
    this.listeners.forEach(l => l.remove && l.remove())
    this.listeners = []
  }

  // ---------------------------------------------------------------- geometry

  /* World coordinates are zoom-independent; multiplying by the scale gives the
     pixel positions that decide what overlaps on screen. Returns null before
     the map has a projection, which is why the caller defers the first draw
     until 'idle'. */
  toPixel (position) {
    const projection = this.map.getProjection()
    if (!projection) return null
    const scale = Math.pow(2, this.map.getZoom())
    const point = projection.fromLatLngToPoint(
      new google.maps.LatLng(position.lat, position.lng))
    return { x: point.x * scale, y: point.y * scale }
  }

  toLatLng (x, y) {
    const projection = this.map.getProjection()
    const scale = Math.pow(2, this.map.getZoom())
    const latLng = projection.fromPointToLatLng(
      new google.maps.Point(x / scale, y / scale))
    return { lat: latLng.lat(), lng: latLng.lng() }
  }

  /* Groups of markers that overlap on screen. Transitive on purpose: three in a
     row, each within the threshold of the next, is one group and fans out as
     one. */
  groups () {
    const points = []
    for (const entry of this.entries) {
      const pixel = this.toPixel(entry.base)
      if (pixel) points.push({ entry, pixel })
    }

    const groups = []
    const taken = new Set()
    for (let i = 0; i < points.length; i++) {
      if (taken.has(i)) continue
      const group = [points[i]]
      taken.add(i)
      for (let g = 0; g < group.length; g++) {
        for (let j = 0; j < points.length; j++) {
          if (taken.has(j)) continue
          const dx = group[g].pixel.x - points[j].pixel.x
          const dy = group[g].pixel.y - points[j].pixel.y
          if (Math.sqrt(dx * dx + dy * dy) <= this.nearbyDistance) {
            group.push(points[j])
            taken.add(j)
          }
        }
      }
      groups.push(group)
    }
    return groups
  }

  groupOf (entry) {
    return this.groups().find(g => g.some(p => p.entry === entry)) || [{ entry }]
  }

  // ----------------------------------------------------------------- status

  /** Re-decide every marker's glyph from what currently overlaps. */
  refresh () {
    for (const group of this.groups()) {
      for (const { entry } of group) {
        let status
        if (this.spiderfied.has(entry)) status = markerStatus.SPIDERFIED
        else if (group.length > 1) status = markerStatus.SPIDERFIABLE
        else status = markerStatus.UNSPIDERFIABLE
        this.setStatus(entry, status)
      }
    }
  }

  setStatus (entry, status) {
    if (entry.status === status) return
    entry.status = status
    if (entry.onFormat) entry.onFormat(status, entry.marker)
  }

  // --------------------------------------------------------------- spiderfy

  handleClick (entry) {
    // A '+' stands for several telescopes on one point, so the first click
    // opens the group rather than picking one of them arbitrarily.
    if (entry.status === markerStatus.SPIDERFIABLE) {
      this.spiderfy(entry)
      return
    }
    if (!this.keepSpiderfied && entry.status === markerStatus.SPIDERFIED) {
      this.unspiderfy()
      return
    }
    if (entry.onClick) entry.onClick(entry.marker)
  }

  spiderfy (entry) {
    const group = this.groupOf(entry)
    if (group.length < 2) return
    this.unspiderfy()

    // The centre the feet are measured from, and where every leg starts.
    const cx = group.reduce((sum, p) => sum + p.pixel.x, 0) / group.length
    const cy = group.reduce((sum, p) => sum + p.pixel.y, 0) / group.length
    const origin = this.toLatLng(cx, cy)

    // Circumference grows with the number of feet so they stay the same
    // distance apart however many telescopes share the point.
    const radius = this.circleFootSeparation * (2 + group.length) / TWO_PI
    const step = TWO_PI / group.length

    group.forEach((point, i) => {
      const angle = step * i
      const position = this.toLatLng(
        cx + radius * Math.cos(angle),
        cy + radius * Math.sin(angle))
      point.entry.marker.position = position
      this.spiderfied.add(point.entry)
      this.legs.push(new google.maps.Polyline({
        map: this.map,
        path: [origin, position],
        strokeColor: this.legColor,
        strokeWeight: this.legWeight,
        strokeOpacity: 0.8,
        clickable: false,
        zIndex: 1
      }))
    })

    this.refresh()
  }

  unspiderfy () {
    if (this.spiderfied.size === 0) return
    for (const entry of this.spiderfied) {
      entry.marker.position = entry.base
    }
    this.spiderfied.clear()
    this.clearLegs()
    this.refresh()
  }

  clearLegs () {
    this.legs.forEach(leg => leg.setMap(null))
    this.legs = []
  }
}
