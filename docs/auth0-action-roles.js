/**
 * Auth0 post-login Action: the roles claim.
 *
 * A record of what the tenant runs. Auth0 is the source of truth; editing this
 * file changes nothing by itself.
 *
 * As of 2026-08-11 the dev tenant (dev-1p08tcynxqqoyvzj) has exactly one
 * post-login Action, "Add photonranch user_metadata claim"
 * (5a17b2a9-8575-460c-8447-92a4fa426d22), and no Rules -- /api/v2/rules
 * returns []. Hooks are deprecated to read-only. So this Action is the entire
 * source of the roles claim.
 *
 * THE BUG IT CONTAINED
 *
 *   const fromAppMetadata = event.user.app_metadata && event.user.app_metadata.roles
 *   const roles = Array.isArray(fromAppMetadata) ? fromAppMetadata : ['admin']
 *
 * The fallback grants admin. Every user on the tenant had empty app_metadata,
 * so every login was issued admin, and the tenant could not represent a
 * non-admin user at all. This surfaced as "a user without admin privileges
 * still sees the Admins Only link" -- the UI was correct; there were simply no
 * non-admin users to test with.
 *
 * A default that grants the highest privilege when configuration is missing
 * fails open. Absent configuration should grant nothing.
 *
 * THE FIX: change that one line to
 *
 *   const roles = Array.isArray(fromAppMetadata) ? fromAppMetadata : []
 *
 * then Deploy, and give the accounts that should have admin an explicit
 * app_metadata of {"roles": ["admin"]} via the Management API. Roles are baked
 * into the token at login, so each account must sign out and back in.
 *
 * NOTE ON THE CLAIM NAME
 *
 * The Action writes a claim literally named
 * https://photonranch.org/user_metadata, built by merging the user's
 * user_metadata with the resolved roles. The name is historical: the roles in
 * it do not come from user_metadata, which is empty for every user. Readers
 * (src/auth/claims.js here, getUserRoles in photonranch-jobs) prefer an
 * app_metadata claim and fall back to this one, so the name can be corrected
 * later without breaking anyone.
 *
 * Because roles are NOT read from user_metadata on this tenant, the
 * user-editable-metadata escalation risk does not apply here. Moving the claim
 * to app_metadata is naming hygiene, not a security fix.
 *
 * The shape below is what the Action should look like once corrected. Apply it
 * as a one-line edit to the deployed Action rather than pasting wholesale --
 * the API response truncated mid-way through its setCustomClaim calls, so the
 * tail of the real Action has not been read.
 */

exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://photonranch.org/user_metadata'

  const fromAppMetadata = event.user.app_metadata && event.user.app_metadata.roles

  // No configuration means no privileges. This was ['admin'].
  const roles = Array.isArray(fromAppMetadata) ? fromAppMetadata : []

  const claim = Object.assign({}, event.user.user_metadata, { roles })

  // Both tokens: the UI reads the ID token, and the jobs authorizer calls
  // /userinfo, which is driven by ID token claims.
  api.idToken.setCustomClaim(namespace, claim)
  api.accessToken.setCustomClaim(namespace, claim)
}
