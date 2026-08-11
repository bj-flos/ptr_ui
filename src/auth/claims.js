/**
 * Reading Auth0 custom claims off the logged-in user.
 *
 * Auth0 requires custom claims to be namespaced URLs, and the namespace belongs
 * to whichever tenant issues them: the photonranch tenant injects user_metadata
 * under its own domain via an Action, and any other tenant uses its own. The
 * namespace was hardcoded in six places, so on a different tenant the claim
 * simply was not found and every user silently looked role-less -- no error,
 * just no admin anywhere.
 *
 * Configure per tenant with VUE_APP_AUTH0_CLAIM_NAMESPACE, or claimNamespace in
 * auth_config.json. With neither set the photonranch namespace is used, so the
 * default build is unchanged.
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

export const USER_METADATA_CLAIM = `${namespace}user_metadata`

/**
 * The tenant's user_metadata claim, or an empty object when it is absent.
 *
 * Never throws: this runs inside a router guard and before the app mounts, so
 * an exception here blanks the page rather than degrading to "not an admin".
 */
export function userMetadata (user) {
  return (user || {})[USER_METADATA_CLAIM] || {}
}

/** Roles from the user_metadata claim, always an array. */
export function userRoles (user) {
  const roles = userMetadata(user).roles
  return Array.isArray(roles) ? roles : []
}

/** Whether the user holds a given role. */
export function userHasRole (user, role) {
  return userRoles(user).includes(role)
}
