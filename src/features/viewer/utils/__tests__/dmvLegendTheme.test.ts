import { describe, expect, it } from 'vitest'

import { applyDMVLegendTheme } from '../dmvLegendTheme'

function legendFixture(): {
  root: HTMLElement
  title: HTMLElement
  min: HTMLElement
} {
  const root = document.createElement('div')
  const header = document.createElement('button')
  const label = document.createElement('span')
  label.textContent = 'Legend'
  label.style.color = 'rgba(0, 0, 0, 0.85)'
  const chevron = document.createElement('span')
  chevron.style.background = 'rgba(0, 0, 0, 0.06)'
  header.append(label, chevron)

  const row = document.createElement('div')
  const min = document.createElement('div')
  min.textContent = '0'
  min.style.fontSize = '10px'
  min.style.fontWeight = '600'
  min.style.color = 'rgba(0, 0, 0, 0.9)'
  const max = document.createElement('div')
  max.textContent = '255'
  max.style.fontSize = '10px'
  max.style.fontWeight = '600'
  max.style.color = 'rgba(0, 0, 0, 0.9)'
  const title = document.createElement('div')
  title.textContent = 'Tumor infiltration by lymphocytes present'
  title.style.fontSize = '12px'
  title.style.fontWeight = '600'
  title.style.color = 'black'
  row.append(min, max, title)

  root.append(header, row)
  return { root, title, min }
}

describe('applyDMVLegendTheme', () => {
  it('paints dark chrome and light ink on black DMV titles', () => {
    const { root, title, min } = legendFixture()
    applyDMVLegendTheme(root, 'dark')

    expect(root.style.backgroundColor).toContain('21, 27, 38')
    expect(title.style.color).toContain('236, 240, 246')
    expect(min.style.color).toContain('236, 240, 246')
  })

  it('restores light chrome and dark ink', () => {
    const { root, title } = legendFixture()
    applyDMVLegendTheme(root, 'dark')
    applyDMVLegendTheme(root, 'light')

    expect(root.style.backgroundColor).toContain('255, 255, 255')
    expect(title.style.color).toContain('15, 23, 36')
  })
})
