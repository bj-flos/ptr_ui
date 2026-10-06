<template>
  <!-- A pointer at something on the page, for a guest finding their way
       around. aria-hidden on the arrow only: the arrow is decoration, the
       text is the content. -->
  <div
    class="guest-callout"
    :class="`is-${direction}`"
    role="note"
  >
    <span
      class="guest-callout-arrow"
      aria-hidden="true"
    />
    <div class="guest-callout-body">
      <slot />
    </div>
  </div>
</template>

<script>
/**
 * One annotation bubble with an arrow on a chosen side.
 *
 * Positioning is the CALLER's job -- this only draws the bubble and points
 * the arrow. The two users of it sit against the navbar, where the thing being
 * pointed at is, and a component that tried to own its own placement would
 * have to know about both.
 *
 * `direction` is the side the arrow sits on, so `up` means the arrow is on top
 * and the bubble hangs below the thing it indicates.
 */
export default {
  name: 'GuestCallout',
  props: {
    direction: {
      type: String,
      default: 'up',
      validator: v => ['up', 'right', 'down', 'left'].includes(v)
    }
  }
}
</script>

<style lang="scss" scoped>
@import "@/style/_variables.scss";

.guest-callout {
  position: relative;
  display: flex;
  align-items: center;
  /* Narrow on purpose. These sit over a map and beside a clock; a wide bubble
     would cover what it is explaining. */
  max-width: 19rem;
  pointer-events: auto;
}

.guest-callout-body {
  /* $ptr-yellow against $dark: the same pairing the status footers use for
     "read this", and it has to stand off a dark navbar and a dark map both. */
  background-color: $dark;
  color: $white-ter;
  border: 1px solid $ptr-yellow;
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
  font-size: 0.82rem;
  line-height: 1.35;
  box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.55);
}

/* The arrow is a CSS triangle rather than an icon so it inherits the border
   colour and cannot fail to load. */
.guest-callout-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border: 0.5rem solid transparent;
}

.guest-callout.is-up {
  flex-direction: column;

  .guest-callout-arrow {
    top: -1rem;
    left: 1.5rem;
    border-bottom-color: $ptr-yellow;
  }
}

.guest-callout.is-right {
  .guest-callout-arrow {
    right: -1rem;
    top: 50%;
    transform: translateY(-50%);
    border-left-color: $ptr-yellow;
  }
}

.guest-callout.is-down {
  .guest-callout-arrow {
    bottom: -1rem;
    left: 1.5rem;
    border-top-color: $ptr-yellow;
  }
}

.guest-callout.is-left {
  .guest-callout-arrow {
    left: -1rem;
    top: 50%;
    transform: translateY(-50%);
    border-right-color: $ptr-yellow;
  }
}
</style>
