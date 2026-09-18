<template>
  <div class="info-thumbnail-row">
    <template v-for="img in exisiting_info_images">
      <img
        :key="img.channel"
        :src="img.jpg_url"
        class="info-image-thumbnail"
        :class="{'is_selected': img.base_filename == current_image.base_filename}"
        @error="show_thumbnail_placeholder"
        @click="setActiveImage(img.channel)"
      >
    </template>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { THUMBNAIL_PLACEHOLDER, show_placeholder } from '@/utils/placeholder_image'
export default {
  name: 'InfoImageThumb',
  methods: {
    show_thumbnail_placeholder (event) {
      show_placeholder(event, THUMBNAIL_PLACEHOLDER)
    },
    setActiveImage (channel) {
      const info_image_index = channel - 1 // channels are 1-indexed, arrays are 0-indexed
      this.$store.dispatch('images/set_info_image_as_current_image', info_image_index)
    }
  },
  computed: {
    ...mapState('images', [
      'current_image',
      'info_images'
    ]),

    // Channels without images should not display thumbnails
    exisiting_info_images () {
      return this.info_images.filter(i => 'channel' in i)
    }

  }
}
</script>

<style lang="scss" scoped>
.info-thumbnail-row {
  display: flex;
}
.info-image-thumbnail {
  height: 60px;
  width: 60px;
  margin: 0;
  margin-bottom: 5px;
  cursor: pointer;
}
.info-image-thumbnail:not(:first-child) {
  margin-left: 5px;
}
.is_selected {
  border: 3px solid rgb(241, 183, 36);
}
</style>
