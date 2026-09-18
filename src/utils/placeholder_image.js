/* What an <img> falls back to when its source will not load.

   Inline SVG rather than a hosted placeholder, for the reason the store
   already records at display_placeholder_image: a placeholder that needs the
   network can itself fail, and then the failure is two broken images instead
   of one. via.placeholder.com, which every one of these call sites used, has
   stopped answering altogether -- it does not refuse the connection, it closes
   it -- so each thumbnail that missed drew a second console error on its way
   to drawing nothing.

   Data URIs, so there is no request to fail. Percent-encoded quotes inside,
   because these are read back into markup where a bare apostrophe would end
   the attribute early.
*/

const box = (size, text, fontSize) =>
  'data:image/svg+xml;charset=utf8,' +
  '%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 ' +
  `width=%27${size}%27 height=%27${size}%27%3E` +
  '%3Crect width=%27100%25%27 height=%27100%25%27 fill=%27%23222%27/%3E' +
  '%3Ctext x=%2750%25%27 y=%2755%25%27 fill=%27%23888%27 ' +
  `font-family=%27sans-serif%27 font-size=%27${fontSize}%27 ` +
  `text-anchor=%27middle%27%3E${encodeURIComponent(text)}%3C/text%3E%3C/svg%3E`

export const THUMBNAIL_PLACEHOLDER = box(60, 'jpg', 13)
export const PREVIEW_PLACEHOLDER = box(768, 'no jpg preview available', 28)

/* Swap in the placeholder, once.

   The placeholder is a data URI and cannot itself fail, but an element whose
   src is already the placeholder is left alone regardless: that is cheaper to
   reason about than trusting the browser never to re-fire error on it.
*/
export function show_placeholder (event, placeholder) {
  const img = event.target
  if (!img || img.src === placeholder) return
  img.src = placeholder
}
