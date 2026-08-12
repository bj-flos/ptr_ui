const makeIcon = (function () {
  // generate a data: URI for an SVG marker with specified colors and optional '+' motif

  function processTemplate (str) {
    const template = str.split('`')
    for (let i = 0, len = template.length; i < len; i += 2) template[i] = encodeURIComponent(template[i])
    return template
  }
  function applyTemplate (template, values) {
    const result = template.slice()
    for (let i = 1, len = template.length; i < len; i += 2) result[i] = values[result[i]]
    return result.join('')
  }

  const svgTemplate = processTemplate('<svg viewBox="0 0 23 32" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd"><path d="M22 11c0 1.42-.226 2.585-.677 3.496l-7.465 15.117c-.218.43-.543.77-.974 1.016-.43.246-.892.37-1.384.37-.492 0-.954-.124-1.384-.37-.43-.248-.75-.587-.954-1.017L1.677 14.496C1.227 13.586 1 12.42 1 11c0-2.76 1.025-5.117 3.076-7.07C6.126 1.977 8.602 1 11.5 1c2.898 0 5.373.977 7.424 2.93C20.974 5.883 22 8.24 22 11z" stroke="`stroke`" stroke-width=".6" fill="`fill`" fill-rule="nonzero"/>`plus` `name`</g></svg>')

  const plusTemplate = processTemplate('<path d="M17 11.012c0-.607-.51-1.117-1.115-1.117h-3.222v-3.23c0-.63-.533-1.165-1.163-1.165s-1.163.534-1.163 1.166v3.23H7.115C6.51 9.895 6 10.405 6 11.01c0 .607.51 1.117 1.115 1.117h3.222v3.204c0 .632.533 1.166 1.163 1.166s1.163-.534 1.163-1.166V12.13h3.222c.606 0 1.115-.51 1.115-1.118z" fill="`fill`"/>')
  // var plusTemplate = processTemplate('<text>tst</text>');
  /* The site code, drawn inside the marker body.
     It used to be plain white, which had two problems: the marker's own outline
     is white, so the glyphs merged into it wherever the text ran near the edge,
     and white on the amber marker was weak to begin with. No single flat colour
     works, because the body underneath is green, red, amber or grey depending
     on the site.
     Black with a white outline drawn underneath (paint-order puts the stroke
     behind the fill) keeps the text legible on all four, and the halo separates
     it from the marker edge and from the greens and greys of the terrain. */
  const nameTemplate = processTemplate('<text x="50%" y="35%" font-size="6" font-weight="bold" font-family="Verdana" fill="black" stroke="white" stroke-width="1.4" stroke-linejoin="round" paint-order="stroke" text-anchor="middle" dominant-baseline="middle" lenghtAdjust1="spacingAndGlyphs" textLength1="15">`name`</text>')

  const rgbTemplate = processTemplate('rgb(`r`,`g`,`b`)')

  return function (fill, stroke, plus, name) {
    const svg = applyTemplate(svgTemplate, {
      fill: applyTemplate(rgbTemplate, fill),
      stroke: applyTemplate(rgbTemplate, stroke),
      plus: plus ? applyTemplate(plusTemplate, { fill: applyTemplate(rgbTemplate, plus) }) : '',
      name: name ? applyTemplate(nameTemplate, { name }) : ''
    })
    return 'data:image/svg+xml,' + svg
  }
})()

export { makeIcon }
