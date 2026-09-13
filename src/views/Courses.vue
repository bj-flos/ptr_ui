<template>
  <div class="courses">
    <SiteNavbar />
    <div class="container">
      <div class="courses-card">
        <!-- Drawn inline rather than fetched: it is four shapes, and an <img>
             here would be one more asset to serve and one more thing to 404.
             Colours are the amber this app already uses for its caution icon
             and a cone orange, so it reads as roadworks at a glance. -->
        <svg
          class="construction"
          viewBox="0 0 240 160"
          role="img"
          aria-labelledby="constructionTitle"
        >
          <title id="constructionTitle">Under construction</title>
          <defs>
            <!-- Rotated so the stripes run diagonally, which is what makes a
                 plain rectangle read as a hazard barrier. -->
            <pattern
              id="hazardStripes"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect
                width="24"
                height="24"
                fill="#f1b70e"
              />
              <rect
                width="12"
                height="24"
                fill="#23262a"
              />
            </pattern>
          </defs>

          <!-- Cones first, so the barrier plank lands in front of their tips. -->
          <g>
            <path
              d="M56 134 L72 80 Q74 74 78 74 Q82 74 84 80 L100 134 Z"
              fill="#e8541f"
            />
            <rect
              x="63"
              y="102"
              width="30"
              height="12"
              fill="#f5f5f5"
            />
            <rect
              x="48"
              y="132"
              width="60"
              height="10"
              rx="3"
              fill="#bf441b"
            />
          </g>
          <g>
            <path
              d="M140 134 L156 80 Q158 74 162 74 Q166 74 168 80 L184 134 Z"
              fill="#e8541f"
            />
            <rect
              x="147"
              y="102"
              width="30"
              height="12"
              fill="#f5f5f5"
            />
            <rect
              x="132"
              y="132"
              width="60"
              height="10"
              rx="3"
              fill="#bf441b"
            />
          </g>

          <rect
            x="20"
            y="52"
            width="200"
            height="30"
            rx="4"
            fill="url(#hazardStripes)"
            stroke="#15171a"
            stroke-width="3"
          />

          <rect
            x="12"
            y="144"
            width="216"
            height="4"
            rx="2"
            fill="#3a3f45"
          />
        </svg>

        <h1 class="title is-4">
          Under Development
        </h1>
        <p class="courses-lead">
          The course material is being written. It is not ready to read yet, and
          this page will carry it when it is.
        </p>

        <router-link to="/">
          Back to the map
        </router-link>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * The Courses tab.
 *
 * Deliberately open to anyone: no beforeEnter on the route, no v-if on the
 * navbar item, no auth check here. Someone deciding whether this is worth
 * signing up for has to be able to read what it is first.
 *
 * When the material lands, that split holds: the course description stays
 * readable signed out, and only enrolling is gated on having a login.
 */
import SiteNavbar from '@/components/SiteNavbar'

export default {
  name: 'Courses',
  components: { SiteNavbar }
}
</script>

<style lang="scss" scoped>
/* Same measure as the sign-in card: this is a heading and two lines, and at
   full width the text runs further than the eye wants to track. */
.courses-card {
  max-width: 30rem;
  margin: 3rem auto;
  padding: 2rem 1rem;
  text-align: center;
}

.construction {
  display: block;
  width: 240px;
  max-width: 80%;
  height: auto;
  margin: 0 auto 2rem;
}

.courses-lead {
  margin-bottom: 2rem;
  opacity: 0.85;
}
</style>
