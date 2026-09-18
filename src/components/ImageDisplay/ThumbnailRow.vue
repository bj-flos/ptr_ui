<template>
  <div class="images">
    <img
      v-for="(item, index) in images"
      :key="index"
      :src="thumbnailWithFallback(item)"
      :title="item.base_filename"
      :class="{'selected_thumbnail' : item.image_id == selected_image}"
      loading="lazy"
      class="recent-image"
      @error="show_thumbnail_placeholder"
      @click="setActiveImage(item)"
    >
  </div>
</template>

<script>
import { THUMBNAIL_PLACEHOLDER, show_placeholder } from '@/utils/placeholder_image'

export default {
  name: 'ThumbnailRow',
  props: {
    images: {
      type: Array,
      default: () => []
    },
    selected_image: {
      type: Number,
      required: false
    }
  },
  methods: {
    show_thumbnail_placeholder (event) {
      show_placeholder(event, THUMBNAIL_PLACEHOLDER)
    },
    setActiveImage (item) {
      this.$emit('thumbnailClicked', item)
    },
    thumbnailWithFallback (item) {
      return item.jpg_thumbnail_url || item.jpg_url
    }
  }
}
</script>

<style lang="scss" scoped>

.images {
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
}
.recent-image {
  cursor: pointer;
  margin: 0;
  margin-bottom: 5px;
  flex: 0 0 auto;
  height: 60px;
}
.recent-image:not(:first-child) {
  margin-left: 5px;
}
.selected_thumbnail {
  border: 3px solid rgb(241, 183, 36);
}

</style>
