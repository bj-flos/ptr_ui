<template>
  <div>
    <SiteNavbar />
    <div class="admin-content">
      <h1 class="title is-4">
        Admin
      </h1>

      <b-tabs
        v-model="activeTab"
        type="is-boxed"
      >
        <b-tab-item
          label="Site Status"
          value="status"
        >
          <!-- Mounted with the tab rather than kept alive behind it: both tabs
               poll, and the one nobody is looking at has no business asking the
               status and calendar APIs every half minute. -->
          <AdminSiteStatus v-if="activeTab === 'status'" />
        </b-tab-item>

        <b-tab-item
          label="Reservations"
          value="reservations"
        >
          <AdminReservations v-if="activeTab === 'reservations'" />
        </b-tab-item>
      </b-tabs>
    </div>
  </div>
</template>

<script>
/**
 * The admin page.
 *
 * Two views of the same five telescopes: what each is reporting right now, and
 * what is booked on them over the next few hours.
 *
 * The route is guarded by authGuard's requiresRole check, so nothing here
 * checks again -- reaching this component means the role was accepted.
 */
import SiteNavbar from '@/components/SiteNavbar'
import AdminSiteStatus from '@/components/admin/AdminSiteStatus'
import AdminReservations from '@/components/admin/AdminReservations'

export default {
  name: 'AdminOnly',
  components: { SiteNavbar, AdminSiteStatus, AdminReservations },

  data () {
    return {
      activeTab: 'status'
    }
  }
}
</script>

<style lang="scss" scoped>
.admin-content {
  margin-top: 30px;
  padding: 0 1em 3em;
  max-width: 70rem;
}
</style>
