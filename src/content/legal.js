/**
 * The privacy statement and terms of service, as published by this deployment.
 *
 * The text is the operator's, not the application's. Both documents are empty
 * here on purpose: LegalPage renders a plain "not written yet" notice rather
 * than prose, because a page that looks like a policy but is not one gets
 * linked, quoted and relied upon.
 *
 * To publish, set `html` (and `updated`). It is rendered with v-html, so it is
 * trusted content from this repository -- never anything a user can supply.
 * Keep it to headings, paragraphs and lists; LegalPage styles those.
 *
 *   privacy: {
 *     title: 'Privacy Statement',
 *     updated: '9 September 2026',
 *     html: `
 *       <h2>What we hold</h2>
 *       <p>...</p>
 *     `
 *   }
 *
 * Worth stating accurately when it is written, because it is what this
 * deployment actually does: the account itself lives with Descope, the
 * identity provider, and this application stores the observation records and
 * images produced by observing. There is no third-party analytics in the
 * interface. Google Maps and Windy are loaded from their own servers on pages
 * that show a map or a weather chart, which those providers can see.
 */

export default {
  privacy: {
    title: 'Privacy Statement',
    updated: '',
    html: ''
  },

  terms: {
    title: 'Terms of Service',
    updated: '',
    html: ''
  }
}
