<template>
  <div>
    <div style="margin-bottom: 1em;">
      OpenWeatherMap Report
      <pre>{{ owmReport }}</pre>
    </div>

    <div style="margin-bottom: 1em;">
      <b-button @click="showOwmStatus">
        (alternate method) show OpenWeatherMap Status
      </b-button>
    </div>
    <b-modal v-model="owmModalVisible">
      <pre>{{ owmReport }}</pre>
    </b-modal>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'OWMReport',
  data () {
    return {
      owmModalVisible: false,
      owmReport: '...loading...'
    }
  },
  computed: {
    ...mapGetters('site_config', [
      'wema_name'
    ])
  },
  mounted () {
    this.getOwmReport()
  },
  watch: {
    '$route.params.sitecode' () {
      this.owmReport = '...loading...'
      this.getOwmReport()
    }
  },
  methods: {
    getOwmReport () {
      this.$store.dispatch('sitestatus/getLatestOwmReport').then((res) => {
        this.owmReport = this.$store.getters['sitestatus/owmReport']
      })
    },
    showOwmStatus () {
      this.owmModalVisible = true
    }
  }
}
</script>
