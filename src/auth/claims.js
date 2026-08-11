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
 * auth_config.json. With neither set the photonranch namespace is used, so the
 * default build is unchanged.
 *
 * Roles are moving from user_metadata to app_metadata. user_metadata is the
 * bucket Auth0 treats as user-editable -- anything holding a token with
 * update:current_user_metadata could grant itself admin -- while app_metadata is
 * write-protected and is where authorization data belongs.
 *
 * Both claims are read during the move, app_metadata first. That ordering is
 * what makes the migration safe: readers can be deployed before the Action
 * changes, tokens issued by the old Action keep working, and sessions already
 * open do not have to be invalidated. Once every issued token carries
 * app_metadata, drop LEGACY_METADATA_KEY and the fallback below.
 */

import authConfig from '../../auth_config.json'

const DEFAULT_NAMESPACE = 'https://photonranch.org/'

const METADATA_KEY = 'app_metadata'
const LEGACY_METADATA_KEY = 'user_metadata'

const configured =
  process.env.VUE_APP_AUTH0_CLAIM_NAMESPACE ||
  authConfig.claimNamespace ||
  DEFAULT_NAMESPACE

// Accept the namespace with or without its trailing slash, since it reads
// naturally either way and a missing slash would silently break every lookup.
const namespace = configured.endsWith('/') ? configured : `${configured}/`

export const APP_METADATA_CLAIM = `${namespace}${METADATA_KEY}`
export const USER_METADATA_CLAIM = `${namespace}${LEGACY_METADATA_KEY}`

function claim (user, key) {
  const value = (user || {})[key]
  return value && typeof value === 'object' ? value : {}
}

/**
 * The tenant's metadata claim, preferring app_metadata over the legacy
 * user_metadata, or an empty object when neither is present.
 *
 * Never throws: this runs inside a router guard and before the app mounts, so
 * an exception here blanks the page rather than degrading to "not an admin".
 */
export function userMetadata (user) {
  const app = claim(user, APP_METADATA_CLAIM)
  return Object.keys(app).length > 0 ? app : claim(user, USER_METADATA_CLAIM)
}

/**
 * Roles for the user, always an array.
 *
 * Read from whichever claim actually carries them rather than from whichever
 * claim exists, so a token with both present but roles in only one still
 * resolves.
 */
export function userRoles (user) {
  const fromApp = claim(user, APP_METADATA_CLAIM).roles
  if (Array.isArray(fromApp)) return fromApp

  const fromUser = claim(user, USER_METADATA_CLAIM).roles
  return Array.isArray(fromUser) ? fromUser : []
}

/** Whether the user holds a given role. */
export function userHasRole (user, role) {
  return userRoles(user).includes(role)
}
