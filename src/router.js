// src/router.js

import Vue from 'vue'
import VueRouter from 'vue-router'
import store from '@/store/index'

import Home from './views/Home.vue'
import Profile from './views/Profile.vue'
import AdminOnly from './views/AdminOnly.vue'

import About from './views/info/About.vue'
import Resources from './views/info/Resources.vue'
import ReservationInfo from './views/info/ReservationInfo.vue'
import Login from './views/Login.vue'
import Invite from './views/Invite.vue'
import Apply from './views/Apply.vue'
import LegalPage from './views/info/LegalPage.vue'
import ImageView from './views/ImageView.vue'

// Observatories
import Site from './views/Site.vue'

// Pages for testing
import { authGuard } from './auth/authGuard'
import UserData from './views/UserData.vue'
import NotFound from './views/NotFound'

Vue.use(VueRouter)

/**
 * Match a site code from the URL to a configured site, ignoring case.
 *
 * Site codes are stored in the config API exactly as written, and that case has
 * changed over time. Lowercasing the URL parameter made every lookup miss once
 * the codes became uppercase; comparing case-insensitively and returning the
 * stored spelling means a link or bookmark in either case resolves.
 */
const resolveSitecode = code => {
  const sites = store.getters['site_config/available_sites'] || []
  return sites.find(s => String(s).toLowerCase() === String(code).toLowerCase())
}

const router = new VueRouter({
  mode: 'history',
  linkExactActiveClass: 'is-active',
  base: process.env.BASE_URL,
  routes: [
    { path: '/', name: 'home', component: Home },
    {
      path: '/adminonly',
      name: 'adminonly',
      component: AdminOnly,
      beforeEnter: authGuard,
      meta: { requiresRole: 'admin' }
    },

    { path: '/about', name: 'about', component: About },
    { path: '/resources', name: 'resources', component: Resources },
    { path: '/info/reservations', name: 'reservations', component: ReservationInfo },

    // Our own sign-in page: the logo and the terms someone is accepting
    // belong on a page we control, even though the credentials are
    // entered at the identity provider.
    { path: '/login', name: 'login', component: Login },

    // Where a Descope invitation lands. The invite is a magic link, so
    // the token arrives as ?t= and is verified here.
    { path: '/invite', name: 'invite', component: Invite },
    // Where the navbar Apply button leads. Open to anyone: the whole point is
    // that the person filling it in does not have an account yet.
    { path: '/apply', name: 'apply', component: Apply },

    // One component, two documents -- they differ only in their text.
    { path: '/info/privacy', name: 'privacy', component: LegalPage, props: { contentKey: 'privacy' } },
    { path: '/info/terms', name: 'terms', component: LegalPage, props: { contentKey: 'terms' } },

    { path: '/profile', name: 'profile', component: Profile, beforeEnter: authGuard },
    { path: '/data/:user', name: 'data', component: UserData },
    { path: '/image/:imageId', name: 'image-view', component: ImageView, props: true },
    {
      path: '/site/:sitecode/:subpage',
      name: 'site',
      beforeEnter: (to, from, next) => {
        if (!resolveSitecode(to.params.sitecode)) {
          return next('/')
        }
        next()
      },
      component: Site,
      props: route => {
        return {
          // Canonical spelling, not lowercased: the config API is keyed by the
          // site code exactly as stored, and store lookups are case-sensitive.
          sitecode: resolveSitecode(route.params.sitecode) || route.params.sitecode,
          subpage: route.params.subpage.toLowerCase()
        }
      }
    },
    { path: '/notfound', name: 'notfound', component: NotFound },

    {
      path: '/logout',
      name: 'logout',
      beforeEnter (to, from, next) {
        // Get the route where the user clicked 'logout'. We want to redirect back to this page.
        const redirect_route = window.localStorage.getItem('ptr_logout_redirect_path') || '/'
        return next(redirect_route)
      }
    },

    // handle page not found
    { path: '*', redirect: '/notfound' }
  ]
})

export default router
