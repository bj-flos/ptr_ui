<template>
  <div id="app">
    <google-account-warning
      :show-warning="showGoogleWarning"
      @dismiss="dismissGoogleWarning"
    />
    <router-view class="router-view" />
  </div>
</template>

<script>
import GoogleAccountWarning from '@/components/GoogleAccountWarning.vue'
import { mapState, mapMutations } from 'vuex'

export default {
  name: 'App',
  components: {
    GoogleAccountWarning
  },
  computed: {
    ...mapState('user_data', [
      'isGoogleFederatedAccount',
      'googleWarningDismissed'
    ]),
    showGoogleWarning () {
      return this.isGoogleFederatedAccount && !this.googleWarningDismissed
    }
  },
  methods: {
    ...mapMutations('user_data', {
      setGoogleWarningDismissed: 'googleWarningDismissed'
    }),
    dismissGoogleWarning () {
      this.setGoogleWarningDismissed(true)
    }
  }
}
</script>

<style scoped lang="scss">
/* Every view's root element gets this class, so what is set here applies to all
   of them.

   It used to be overflow-x: hidden, which made each page root a clipping box.
   That was invisible on a page as tall as the window and wrong on a short one:
   the navbar Sites dropdown asks for calc(100vh - 75px) and was cut off at the
   bottom of whatever the page happened to be -- on /adminonly, a heading and one
   line of text. The horizontal half of the same problem is why the dropdown used
   to be dragged left by up to 500px.

   Nothing is lost by dropping it. index.html sets overflow: hidden on <html>, so
   the document cannot scroll or show a scrollbar in either axis regardless, and
   anything wider than the window is clipped at the viewport either way.

   min-height in its place gives every page a full window to work in, so a short
   page no longer truncates anything hanging from the navbar. Views that set
   their own height (Site, Home, Apply) are unaffected: that is a different
   property and theirs still wins. */
.router-view {
  min-height: 100vh;
}
</style>
