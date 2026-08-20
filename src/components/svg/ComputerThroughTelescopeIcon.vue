<template>
  <!-- A computer at the eyepiece instead of a person: the queue runs the
       observation while you are away. Stands for a project reservation. -->
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 48 48"
    role="img"
    aria-label="Use Automation"
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
    <!-- tube, same pose as the eye version so the pair reads as a set -->
    <rect
      x="12"
      y="17"
      width="26"
      height="9"
      rx="2.5"
      :fill="body"
      transform="rotate(-22 25 21.5)"
    />
    <rect
      x="35"
      y="12"
      width="5"
      height="12"
      rx="1.5"
      :fill="frame"
      transform="rotate(-22 37.5 18)"
    />
    <rect
      x="9"
      y="23"
      width="6"
      height="7"
      rx="1.5"
      :fill="frame"
      transform="rotate(-22 12 26.5)"
    />
    <!-- the computer, in the eye's place -->
    <rect
      x="1"
      y="4"
      width="17"
      height="12"
      rx="1.8"
      :fill="screen"
      :stroke="frame"
      stroke-width="1.6"
    />
    <path
      d="M6 16 h7 l1.5 3 h-10 Z"
      :fill="frame"
    />
    <!-- a couple of code lines on the screen -->
    <path
      d="M4.5 8 h7 M4.5 11 h4.5"
      :stroke="body"
      stroke-width="1.6"
      stroke-linecap="round"
    />
  </svg>
</template>

<script>
/**
 * The sibling of EyeThroughTelescopeIcon -- same telescope, same pose, with a
 * computer where the eye was, so the two read as a pair at a glance. Inline for
 * the same reasons: no network request and it scales with the caller.
 */
export default {
  name: 'ComputerThroughTelescopeIcon',
  props: {
    size: { type: [String, Number], default: 34 },
    body: { type: String, default: '#4b95d6' },
    frame: { type: String, default: '#2c3e50' },
    screen: { type: String, default: '#ffffff' }
  }
}
</script>
