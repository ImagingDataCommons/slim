import { customLogoUrl, isUsableLogoSvg } from '../customLogo'

const PLACEHOLDER =
  '<?xml version="1.0"?><svg viewBox="0 0 400.79 100" xml:space="preserve">\n</svg>'
const LOGO =
  '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10z"/></svg>'

describe('customLogoUrl', () => {
  it('joins the base path and logo.svg', () => {
    expect(customLogoUrl('/')).toBe('/logo.svg')
    expect(customLogoUrl('/slim/')).toBe('/slim/logo.svg')
    expect(customLogoUrl('/slim')).toBe('/slim/logo.svg')
    expect(customLogoUrl('https://example.org/slim/')).toBe(
      'https://example.org/slim/logo.svg',
    )
  })
})

describe('isUsableLogoSvg', () => {
  it('accepts an SVG that draws something', () => {
    expect(isUsableLogoSvg('image/svg+xml', LOGO)).toBe(true)
    expect(isUsableLogoSvg(null, LOGO)).toBe(true)
  })

  it('rejects the empty placeholder Slim ships', () => {
    expect(isUsableLogoSvg('image/svg+xml', PLACEHOLDER)).toBe(false)
  })

  it('rejects an HTML fallback page', () => {
    expect(isUsableLogoSvg('text/html; charset=utf-8', LOGO)).toBe(false)
    expect(
      isUsableLogoSvg(
        null,
        '<!doctype html><html><body><p>x</p></body></html>',
      ),
    ).toBe(false)
  })
})
