/**
 * Values the page can be handed at run time.
 *
 * vue-cli compiles every `process.env.VUE_APP_*` into the bundle, so a built
 * image is normally pinned to the environment it was built for. config.js is
 * written by whatever deploys this -- a ConfigMap in Kubernetes -- and loaded
 * before the bundle, which lets one image serve every deployment.
 *
 * Absent or empty, the build-time value applies exactly as before, so nothing
 * changes for `npm run serve` or for a build with a .env file.
 *
 * The build-time value has to be passed in by the caller rather than looked up
 * here: webpack substitutes `process.env.VUE_APP_X` textually, so a dynamic
 * `process.env[name]` compiles to nothing.
 */
const RUNTIME = (typeof window !== 'undefined' && window.__PTR_CONFIG__) || {}

export function runtimeConfig (name, buildTime) {
  const value = RUNTIME[name]
  if (value === undefined || value === null || value === '') {
    return buildTime
  }
  return value
}

export default runtimeConfig
