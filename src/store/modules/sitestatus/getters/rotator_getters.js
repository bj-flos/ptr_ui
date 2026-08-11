import { isItemStale, parseTrueFalse, unwrapVal, displayNumber } from './status_utils'

// Handle status before and after the individual timestamp inclusion
function get_val (getters, key) {
  return unwrapVal(getters.rotator_state[key])
}

const rotator_state = (state, getters, rootState) => {
  return state.rotator[rootState.site_config.selected_rotator] ?? {}
}

const rotator_position = (state, getters) => {
  const name = 'Position Angle'
  const val = displayNumber(get_val(getters, 'position_angle'), 4, ' °')
  const is_stale = isItemStale(getters, 'rotator_state', 'position_angle')
  return { name, val, is_stale }
}

/**
 * Rotator position angle as a raw number, or null when unavailable.
 *
 * rotator_position above formats for display ('12.3400 °') inside a
 * {name, val, is_stale} envelope, which cannot be used for geometry. This is
 * the same reading for callers that need to compute with it — the sky chart
 * rotates the camera footprint by it. get_val returns '-' for absent keys and
 * rotator_state returns {} when no rotator is selected, so sites without one
 * yield null and callers can fall back to an unrotated frame.
 */
const rotator_position_angle = (state, getters) => {
  const n = parseFloat(get_val(getters, 'position_angle'))
  return Number.isFinite(n) ? n : null
}

const rotator_moving = (state, getters) => {
  const name = 'Rotator Moving'
  let val = get_val(getters, 'rotator_moving')
  if (val != '-') {
    val = parseTrueFalse(val) ? 'moving' : 'idle'
  }
  const is_stale = isItemStale(getters, 'rotator_state', 'rotator_moving')
  return { name, val, is_stale }
}

export default {
  rotator_state,
  rotator_position,
  rotator_position_angle,
  rotator_moving
}
