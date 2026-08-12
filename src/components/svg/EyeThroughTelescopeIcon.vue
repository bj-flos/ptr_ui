<template>
  <!-- A person's eye at the eyepiece: someone sitting at the telescope and
       driving it themselves. Stands for a realtime reservation. -->
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 48 48"
    role="img"
    aria-label="You at the telescope"
    focusable="false"
  >
    <!-- tripod -->
    <path
      d="M24 30 L16 43 M24 30 L32 43 M24 30 L24 43"
      fill="none"
      :stroke="frame"
      stroke-width="2.4"
      stroke-linecap="round"
    />
    <!-- tube, pointing up to the right -->
    <rect
      x="12"
      y="17"
      width="26"
      height="9"
      rx="2.5"
      :fill="body"
      transform="rotate(-22 25 21.5)"
    />
    <!-- objective end -->
    <rect
      x="35"
      y="12"
      width="5"
      height="12"
      rx="1.5"
      :fill="frame"
      transform="rotate(-22 37.5 18)"
    />
    <!-- eyepiece -->
    <rect
      x="9"
      y="23"
      width="6"
      height="7"
      rx="1.5"
      :fill="frame"
      transform="rotate(-22 12 26.5)"
    />
    <!-- the eye, looking into it -->
    <ellipse
      cx="9"
      cy="10"
      rx="8"
      ry="5"
      :fill="eyeWhite"
      :stroke="frame"
      stroke-width="1.6"
    />
    <circle
      cx="9"
      cy="10"
      r="2.6"
      :fill="frame"
    />
  </svg>
</template>

<script>
/**
 * Drawn inline rather than loaded as an asset: no network request, no CSP
 * question, and it inherits whatever size the caller asks for. Colours are
 * props so the same glyph works on a light card and a dark toolbar.
 */
export default {
  name: 'EyeThroughTelescopeIcon',
  props: {
    size: { type: [String, Number], default: 34 },
    body: { type: String, default: '#4b95d6' },
    frame: { type: String, default: '#2c3e50' },
    eyeWhite: { type: String, default: '#ffffff' }
  }
}
</script>
