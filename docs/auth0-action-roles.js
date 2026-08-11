/**
 * Auth0 post-login Action: the roles claim.
 *
 * A record of what the tenant runs. Auth0 is the source of truth; editing this
 * file changes nothing by itself.
 *
 * Tenant dev-1p08tcynxqqoyvzj has exactly one post-login Action, "Add
 * photonranch user_metadata claim" (5a17b2a9-8575-460c-8447-92a4fa426d22), and
 * no Rules -- /api/v2/rules returns []. Hooks are deprecated to read-only. So
 * this Action is the entire source of the roles claim. The Action's *name* is
 * now historical; it emits app_metadata.
 *
 * HISTORY
 *
 * v1  Resolved roles as `Array.isArray(fromAppMetadata) ? fromAppMetadata :
 *     ['admin']`. The fallback granted admin, every user had empty
 *     app_metadata, so every login was issued admin and the tenant could not
 *     represent a non-admin user at all. That surfaced as "a user without admin
 *     privileges still sees the Admins Only link" -- the UI was correct; there
 *     were no non-admin users to test with. A default that grants the highest
 *     privilege when configuration is missing fails open; absent configuration
 *     should grant nothing.
 *
 * v2  Fallback changed to []. Roles now come only from app_metadata, which is
 *     write-protected -- only the Management API can set it.
 *
 * v3/4  Claim emitted under .../app_metadata as well as the legacy
 *     .../user_metadata name, so readers could migrate without a flag day.
 *
 * v5  Legacy claim removed (this file). Safe only because the fail-soft
 *     getUserRoles is deployed to the jobs service -- the previous version
 *     indexed .../user_metadata with an unguarded double index inside a try
 *     that converts any exception into `raise Exception('Unauthorized')`, so
 *     removing the claim before that would have denied every command for every
 *     user.
 *
 * WHAT DEPENDS ON THIS
 *
 * - src/auth/claims.js reads `<namespace>app_metadata` only; its legacy
 *   fallback was removed at the same time.
 * - photonranch-jobs getUserRoles still reads both, which is harmless and
 *   leaves that service able to run against either tenant.
 *
 * Roles are baked into the token at login, so changes here need a fresh token:
 * sign out and in, or getTokenSilently({ignoreCache: true}), which re-runs the
 * Action server-side.
 */

exports.onExecutePostLogin = async (event, api) => {
  const base = 'https://photonranch.org/'

  const fromAppMetadata = event.user.app_metadata && event.user.app_metadata.roles

  // No configuration means no privileges. This was ['admin'] in v1.
  const roles = Array.isArray(fromAppMetadata) ? fromAppMetadata : []

  const claim = Object.assign({}, event.user.app_metadata, { roles })

  // Both tokens: the UI reads the ID token, and the jobs authorizer calls
  // /userinfo, which is driven by ID token claims.
  api.idToken.setCustomClaim(base + 'app_metadata', claim)
  api.accessToken.setCustomClaim(base + 'app_metadata', claim)
}
