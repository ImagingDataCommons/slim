/**
 * Deployments rebrand Slim by replacing `public/logo.svg`. The file shipped
 * with Slim is an empty placeholder, so the header only shows it once it
 * contains a drawing.
 */

const GRAPHIC_ELEMENT =
  /<(?:path|rect|circle|ellipse|polygon|polyline|line|text|image|use|g)\b/i

/** URL of the replaceable logo under the app's base path */
export function customLogoUrl(baseUrl: string): string {
  return `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}logo.svg`
}

/**
 * True when the response is an SVG with at least one drawing element. SPA
 * fallbacks answer missing files with index.html, which must not count.
 */
export function isUsableLogoSvg(
  contentType: string | null,
  markup: string,
): boolean {
  if (contentType?.toLowerCase().includes('text/html') === true) return false
  return /<svg[\s>]/i.test(markup) && GRAPHIC_ELEMENT.test(markup)
}
