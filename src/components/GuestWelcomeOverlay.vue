<template>
  <!-- Sits over the map, which is blurred behind it by the parent. Not a
       Buefy modal: a modal traps the page and covers the navbar, and the
       navbar is where "apply" and "Log in" live -- the two things a guest is
       most likely to want next. -->
  <div class="guest-welcome">
    <div
      class="guest-welcome-card"
      role="dialog"
      aria-labelledby="guest-welcome-title"
    >
      <h1
        id="guest-welcome-title"
        class="guest-welcome-title"
      >
        Welcome to Photon Ranch
      </h1>

      <!-- The project's own words, condensed from the About page rather than
           written fresh, so the two cannot describe different projects. -->
      <div class="guest-welcome-body">
        <p>
          PTR/Asterism is an education project complementing the programs at
          Las Cumbres Observatory, built around a self-paced laboratory course,
          <em>Astronomy and the Scientific Method</em>, aimed at grade levels
          5&ndash;8 but accessible to learners of all ages.
        </p>
        <p>
          It runs on a telescope network of similar scale to LCO, focused on
          remote and scheduled observing rather than purely robotic use, with a
          deliberately heterogeneous range of telescopes &mdash; 200&nbsp;mm to
          24&Prime; &mdash; and detectors.
        </p>
        <p>
          You are browsing as a guest: you can look around, but booking time
          and operating a telescope need an account.
        </p>
        <p>
          You can request an observing account for Photon Ranch by clicking the
          &lsquo;Apply for Account&rsquo; button below.
        </p>
      </div>

      <div class="guest-welcome-actions">
        <!-- Same destination as the navbar's apply button. A router-link
             rather than a click handler, so it behaves like a link: and
             middle-click and copy-link both work. -->
        <b-button
          tag="router-link"
          to="/apply"
          type="is-primary"
          size="is-medium"
          expanded
          class="guest-welcome-apply"
        >
          Apply for Account
        </b-button>

        <b-button
          size="is-medium"
          expanded
          class="guest-welcome-continue"
          @click="$emit('dismiss')"
        >
          Continue as Guest
        </b-button>
      </div>

      <p class="guest-welcome-more">
        More about the project is on the
        <router-link to="/about">
          About
        </router-link>
        page.
      </p>
    </div>
  </div>
</template>

<script>
/**
 * The welcome a guest sees on the home page, over a blurred map.
 *
 * Deliberately stateless. Whether it is shown, and whether dismissing it
 * sticks, belong to the store -- see user_data's isGuest and
 * guestWelcomeDismissed -- because a component that owned that would forget
 * on every route change back to home.
 */
export default {
  name: 'GuestWelcomeOverlay'
}
</script>

<style lang="scss" scoped>
/* Scoped styles do not see the theme unless they ask: vue.config.js has the
   global sass data line commented out, so every component that needs a
   variable imports it, as CommandTabsWide and ImageFilter do. */
@import "@/style/_variables.scss";

.guest-welcome {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Above the map and its controls, below the navbar's dropdowns. */
  z-index: 20;
  padding: 1rem;
  /* The card is the thing to read; a slight scrim stops the blurred map
     competing with it without hiding that there is a map there at all. */
  /* Lighter than it was: the card is dark now and carries its own contrast,
     so a heavy scrim just hid that there is a map behind it at all. */
  background: rgba(0, 0, 0, 0.2);
}

.guest-welcome-card {
  max-width: 34rem;
  width: 100%;
  max-height: 100%;
  overflow-y: auto;
  padding: 1.75rem 2rem;
  border-radius: 6px;
  /* $dark is the surface CalendarLegend uses for a raised panel, so this reads
     as part of the app rather than a white sheet dropped on it.

     The colour is set EXPLICITLY alongside it. This card was white with no
     colour of its own, which inherited $body-color -- light text, on white.
     Any component that sets one of these two without the other inherits the
     theme for the other half, and dark-on-dark or light-on-light is the
     result. */
  background-color: $dark;
  color: $white-ter;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.6);
  text-align: center;
}

/* Bulma colours anchors from its own palette, which is tuned for a light
   background, so links need saying too rather than inheriting the card.
 *
 * Scoped to the PROSE, not the card. The Apply button is tag="router-link",
 * which Buefy renders as an <a>, so a card-wide rule here repainted its label
 * blue on the turquoise primary background and made it unreadable. Anything
 * that is a button gets its colour from Bulma's own invert, which is what it
 * is for. */
.guest-welcome-body a,
.guest-welcome-more a {
  color: $blue;

  &:hover {
    color: lighten($blue, 12%);
  }
}

.guest-welcome-title {
  /* "Large print", as asked. Not a Bulma title class: those are tuned for
     page headings and this wants to be bigger than the one behind it. */
  font-size: 2.25rem;
  line-height: 1.15;
  font-weight: 700;
  margin-bottom: 1rem;
  /* Bulma gives headings $title-color, which is tuned for a light page. */
  color: $white-ter;
}

.guest-welcome-body {
  text-align: left;
  margin-bottom: 1.5rem;

  p + p {
    margin-top: 0.75rem;
  }
}

.guest-welcome-actions {
  /* Apply above Continue, so the account route is the one in the reading
     path and dismissing is the deliberate second choice. */
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.guest-welcome-more {
  margin-top: 1.25rem;
  font-size: 0.85rem;
  opacity: 0.75;
}

/* Phone: the card is the page. */
@media screen and (max-width: 40rem) {
  .guest-welcome-card {
    padding: 1.25rem 1rem;
  }

  .guest-welcome-title {
    font-size: 1.75rem;
  }
}
</style>
