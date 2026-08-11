/**
 * Auth0 Action: add roles to the token from app_metadata.
 *
 * Trigger: Login / Post Login.
 *
 * Paste into Actions -> Library -> Build Custom (Login / Post Login), then add
 * it to the Login flow. This file is a record of what the tenant runs; Auth0 is
 * the source of truth and editing this file changes nothing by itself.
 *
 * Roles moved from user_metadata to app_metadata. user_metadata is the bucket
 * Auth0 treats as user-editable, so anything holding a token with
 * update:current_user_metadata could have granted itself admin. app_metadata is
 * write-protected: only the Management API can change it.
 *
 * Both claims are emitted during the migration. The backend authorizer and the
 * UI read app_metadata first and fall back to user_metadata, so emitting both
 * means no reader breaks regardless of deploy order, and sessions already open
 * keep working. Remove the legacy block once every reader is deployed and
 * outstanding tokens have expired.
 */

exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://photonranch.org/'

  const appMetadata = event.user.app_metadata || {}
  const userMetadata = event.user.user_metadata || {}

  // During the move a user may still have roles only in user_metadata, so fall
  // back rather than silently issuing a token with no roles at all.
  const roles = Array.isArray(appMetadata.roles)
    ? appMetadata.roles
    : (Array.isArray(userMetadata.roles) ? userMetadata.roles : [])

  // Set on both the ID token and the access token: the UI reads the ID token,
  // and the jobs authorizer calls /userinfo, which is driven by the ID token
  // claims. Omitting the access token would break anything validating it
  // directly.
  api.idToken.setCustomClaim(`${namespace}app_metadata`, { roles })
  api.accessToken.setCustomClaim(`${namespace}app_metadata`, { roles })

  // LEGACY -- delete once every reader prefers app_metadata and old tokens have
  // expired. Kept so a rollback of the readers does not lock anyone out.
  api.idToken.setCustomClaim(`${namespace}user_metadata`, { roles })
  api.accessToken.setCustomClaim(`${namespace}user_metadata`, { roles })
}
