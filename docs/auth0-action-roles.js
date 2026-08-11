/**
 * Auth0 post-login Action: the roles claim.
 *
 * A record of what the tenant runs. Auth0 is the source of truth; editing this
 * file changes nothing by itself.
 *
 * Tenant dev-1p08tcynxqqoyvzj has exactly one post-login Action, "Add
 * photonranch user_metadata claim" (5a17b2a9-8575-460c-8447-92a4fa426d22), and
 * no Rules -- /api/v2/rules returns []. Hooks are deprecated to read-only. So
 * this Action is the entire source of the roles claim.
 *
 * HISTORY
 *
 * Version 1 resolved roles as:
 *
 *   const roles = Array.isArray(fromAppMetadata) ? fromAppMetadata : ['admin']
 *
 * The fallback granted admin. Every user had empty app_metadata, so every login
 * was issued admin and the tenant could not represent a non-admin user at all.
 * That surfaced as "a user without admin privileges still sees the Admins Only
 * link" -- the UI was correct; there were no non-admin users to test with. A
 * default that grants the highest privilege when configuration is missing fails
 * open; absent configuration should grant nothing.
 *
 * Version 2 (deployed 2026-08-11) changed it to `: []`. Roles now come only
 * from app_metadata, which is write-protected -- only the Management API can
 * set it.
 *
 * THE CLAIM NAME
 *
 * The claim was named .../user_metadata for historical reasons even though the
 * roles in it never came from user_metadata, which is empty for every user.
 * The version below emits .../app_metadata under its real name.
 *
 * Both claims are emitted, and the legacy one MUST stay until the fail-soft
 * getUserRoles is deployed to the jobs service. The deployed authorizer does:
 *
 *   userInfo['https://photonranch.org/user_metadata']['roles']
 *
 * an unguarded double index, inside a try that converts any exception into
 * `raise Exception('Unauthorized')`. Drop the legacy claim before that is
 * deployed and every command is denied for every user, admins included.
 *
 * Note this applies to the dev stack too: the jobs API on port 8093 runs from
 * /srv/photonranch-jobs, which is a different copy from ~/PTR/photonranch-jobs.
 *
 * ORDER OF OPERATIONS TO RETIRE THE LEGACY CLAIM
 *
 *   1. Deploy fail-soft getUserRoles to every jobs service, /srv included.
 *   2. Confirm commanding still works.
 *   3. Delete the two legacy setCustomClaim lines here and redeploy.
 *   4. Delete LEGACY_METADATA_KEY and its fallback from src/auth/claims.js.
 */

exports.onExecutePostLogin = async (event, api) => {
  const base = 'https://photonranch.org/'

  const fromAppMetadata = event.user.app_metadata && event.user.app_metadata.roles

  // No configuration means no privileges. This was ['admin'] in version 1.
  const roles = Array.isArray(fromAppMetadata) ? fromAppMetadata : []

  const claim = Object.assign({}, event.user.app_metadata, { roles })

  // Both tokens: the UI reads the ID token, and the jobs authorizer calls
  // /userinfo, which is driven by ID token claims.
  api.idToken.setCustomClaim(base + 'app_metadata', claim)
  api.accessToken.setCustomClaim(base + 'app_metadata', claim)

  // LEGACY -- see the header. Remove only after the fail-soft getUserRoles is
  // deployed everywhere, or commanding fails closed for everyone.
  api.idToken.setCustomClaim(base + 'user_metadata', claim)
  api.accessToken.setCustomClaim(base + 'user_metadata', claim)
}
