import { nextSelectedRoiUIDs } from '../roiSelection'

describe('nextSelectedRoiUIDs', () => {
  it('selects only the clicked ROI on a plain click', () => {
    expect([...nextSelectedRoiUIDs(new Set(['a', 'b']), 'c', false)]).toEqual([
      'c',
    ])
  })

  it('adds the clicked ROI on Shift-click without mutating the input', () => {
    const current = new Set(['a'])
    expect([...nextSelectedRoiUIDs(current, 'b', true)]).toEqual(['a', 'b'])
    expect([...current]).toEqual(['a'])
  })

  it('keeps a single entry when Shift-clicking a selected ROI', () => {
    expect([...nextSelectedRoiUIDs(new Set(['a']), 'a', true)]).toEqual(['a'])
  })
})
