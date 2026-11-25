import { formatVisibilitySummary } from '../visibilitySummary'

describe('formatVisibilitySummary', () => {
  it('reports all, none and partial visibility', () => {
    expect(formatVisibilitySummary(5, 5)).toBe('all visible')
    expect(formatVisibilitySummary(0, 5)).toBe('hidden')
    expect(formatVisibilitySummary(3, 5)).toBe('3 of 5 visible')
  })

  it('treats an empty set as hidden', () => {
    expect(formatVisibilitySummary(0, 0)).toBe('hidden')
  })
})
