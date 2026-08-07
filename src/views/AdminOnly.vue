<template>
  <div class="page">
    <SiteNavbar />
    <div class="admin-content">
      <div class="has-text title">
        Admin only
      </div>
      <div class="has-text">
        <p>This page should only be accessible if you are an admin</p>
      </div>
      <div class="has-text subtitle">
        <router-link to="/">
          home page
        </router-link>
      </div>
    </div>
  </div>
</template>

<script>
import SiteNavbar from '@/components/SiteNavbar'
export default {
  name: 'AdminOnly',
  components: { SiteNavbar }
}
</script>

<style lang="scss" scoped>
.admin-content {
    margin-top: 50px;
    padding: 0 1em;
}
</style>
