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
  background: rgba(0, 0, 0, 0.35);
}

.guest-welcome-card {
  max-width: 34rem;
  width: 100%;
  max-height: 100%;
  overflow-y: auto;
  padding: 1.75rem 2rem;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.4);
  text-align: center;
}

.guest-welcome-title {
  /* "Large print", as asked. Not a Bulma title class: those are tuned for
     page headings and this wants to be bigger than the one behind it. */
  font-size: 2.25rem;
  line-height: 1.15;
  font-weight: 700;
  margin-bottom: 1rem;
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
