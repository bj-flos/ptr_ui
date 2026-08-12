<template>
  <span
    class="telescope-icon"
    :style="{ fontSize: size }"
    aria-hidden="true"
  >🔭</span>
</template>

<script>
/**
 * The telescope glyph, in one place.
 *
 * Currently the emoji, which is what Asterism uses to mark an observatory and
 * which a grade-school reader recognises without a label. It has no artwork to
 * borrow: Asterism's own assets are the star-cluster logo and the First Light
 * logo, neither of which is a telescope.
 *
 * Wrapped in a component so replacing it with real artwork later is a change to
 * this file and nothing else. Marked aria-hidden because the button around it
 * carries the accessible name -- a screen reader announcing "telescope emoji"
 * on top of that is noise.
 */
export default {
  name: 'TelescopeIcon',
  props: {
    size: {
      type: String,
      default: '1.25rem'
    }
  }
}
</script>

<style lang="scss" scoped>
.telescope-icon {
  line-height: 1;
  /* Emoji render from a colour font, so they ignore `color`. Stated here so
     nobody later spends time wondering why setting a colour does nothing. */
}
</style>
