/**
 * Reading Auth0 custom claims off the logged-in user.
 *
 * Auth0 requires custom claims to be namespaced URLs, and the namespace belongs
 * to whichever tenant issues them: the photonranch tenant injects metadata under
 * its own domain via an Action, and any other tenant uses its own. The namespace
 * was hardcoded in six places, so on a different tenant the claim simply was not
 * found and every user silently looked role-less -- no error, just no admin
 * anywhere.
 *
 * Configure per tenant with VUE_APP_AUTH0_CLAIM_NAMESPACE, or claimNamespace in
 * auth_config.json. With neither set the photonranch namespace is used.
 *
 * Roles come from app_metadata, which is write-protected -- only the Management
 * API can set it. The Action must emit a `<namespace>app_metadata` claim
 * containing `roles`; see docs/auth0-action-roles.js.
 *
 * The migration fallback that also read a legacy `<namespace>user_metadata`
 * claim was removed on 2026-08-11, once the tenant Action emitted app_metadata
 * and the fail-soft getUserRoles was deployed to the jobs service. NOTE this
 * ties the build to tenants whose Action emits app_metadata: against a tenant
 * still emitting only the legacy claim -- production photonranch, unless its
 * Action is updated too -- every user resolves as role-less. Restore the
 * fallback here rather than pointing this build at such a tenant.
 */

import authConfig from '../../auth_config.json'

const DEFAULT_NAMESPACE = 'https://photonranch.org/'

const configured =
  process.env.VUE_APP_AUTH0_CLAIM_NAMESPACE ||
  authConfig.claimNamespace ||
  DEFAULT_NAMESPACE

// Accept the namespace with or without its trailing slash, since it reads
// naturally either way and a missing slash would silently break every lookup.
const namespace = configured.endsWith('/') ? configured : `${configured}/`

export const APP_METADATA_CLAIM = `${namespace}app_metadata`

/**
 * The tenant's app_metadata claim, or an empty object when it is absent.
 *
 * Never throws: this runs inside a router guard and before the app mounts, so
 * an exception here blanks the page rather than degrading to "not an admin".
 */
export function userMetadata (user) {
  const value = (user || {})[APP_METADATA_CLAIM]
  return value && typeof value === 'object' ? value : {}
}

/** Roles for the user, always an array. */
export function userRoles (user) {
  const roles = userMetadata(user).roles
  return Array.isArray(roles) ? roles : []
}

/** Whether the user holds a given role. */
export function userHasRole (user, role) {
  return userRoles(user).includes(role)
}
