<template>
  <div class="legal">
    <SiteNavbar />
    <div class="container">
      <div class="description-text legal-body">
        <h1 class="title">
          {{ title }}
        </h1>

        <!-- The text is supplied by the operator and lives in
             src/content/legal.js. Until it is written this says so plainly:
             a page that looks like a policy but is not one is worse than a
             page that admits it is pending, because the first gets linked and
             quoted. -->
        <!-- The html comes from src/content/legal.js: in this repository,
             written by the operator. No user input reaches it, and if that
             ever changes this needs a sanitiser rather than a wider rule. -->
        <!-- eslint-disable vue/no-v-html -->
        <div
          v-if="body"
          class="legal-text"
          v-html="body"
        />
        <!-- eslint-enable vue/no-v-html -->
        <div
          v-else
          class="legal-pending"
        >
          <b-message
            type="is-warning"
            has-icon
          >
            <p>
              <strong>This document has not been written yet.</strong>
            </p>
            <p>
              Nothing on this page is a statement of policy. It is a placeholder
              so the links from the sign-in page resolve rather than 404.
            </p>
            <p class="legal-pending-how">
              To publish it, put the text in
              <code>src/content/legal.js</code> under
              <code>{{ contentKey }}</code>.
            </p>
          </b-message>
        </div>

        <p
          v-if="body && updated"
          class="legal-updated"
        >
          Last updated {{ updated }}.
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import SiteNavbar from '@/components/SiteNavbar'
import legal from '@/content/legal'

export default {
  name: 'LegalPage',
  components: { SiteNavbar },

  props: {
    /* Which document to render. One component for both, because they differ
     * only in their text -- two near-identical views would drift. */
    contentKey: {
      type: String,
      required: true,
      validator: value => ['privacy', 'terms'].includes(value)
    }
  },

  computed: {
    doc () {
      return legal[this.contentKey] || {}
    },
    title () {
      return this.doc.title || (this.contentKey === 'privacy'
        ? 'Privacy Statement'
        : 'Terms of Service')
    },
    body () {
      return this.doc.html || ''
    },
    updated () {
      return this.doc.updated || ''
    }
  }
}
</script>

<style lang="scss" scoped>
.legal-body {
  max-width: 45rem;
  margin: 2rem auto;
}

.legal-text ::v-deep h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1.5rem 0 0.5rem;
}

.legal-text ::v-deep p {
  margin-bottom: 0.75rem;
}

.legal-text ::v-deep ul {
  list-style: disc;
  margin: 0 0 0.75rem 1.25rem;
}

.legal-pending-how {
  margin-top: 0.75rem;
  font-size: 0.9em;
  opacity: 0.85;
}

.legal-updated {
  margin-top: 2rem;
  font-size: 0.85em;
  opacity: 0.7;
}
</style>
