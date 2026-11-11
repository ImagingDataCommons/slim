import { planRoiRemoval } from '../roiRemoval'

describe('planRoiRemoval', () => {
  it('removes the selection and prunes it from the visible set', () => {
    const selected = new Set(['a', 'b'])
    const visible = new Set(['a', 'b', 'c'])
    const plan = planRoiRemoval(selected, visible)
    expect(plan.scope).toBe('selected')
    expect(plan.removedUIDs).toEqual(['a', 'b'])
    expect(plan.selectedRoiUIDs).toEqual(new Set())
    expect(plan.visibleRoiUIDs).toEqual(new Set(['c']))
  })

  it('removes every visible ROI when nothing is selected', () => {
    const plan = planRoiRemoval(new Set(), new Set(['a', 'c']))
    expect(plan.scope).toBe('visible')
    expect(plan.removedUIDs).toEqual(['a', 'c'])
    expect(plan.visibleRoiUIDs).toEqual(new Set())
  })

  it('handles a selected ROI that is not visible', () => {
    const plan = planRoiRemoval(new Set(['hidden']), new Set(['c']))
    expect(plan.removedUIDs).toEqual(['hidden'])
    expect(plan.visibleRoiUIDs).toEqual(new Set(['c']))
  })

  it('returns an empty plan when there is nothing to remove', () => {
    const plan = planRoiRemoval(new Set(), new Set())
    expect(plan.removedUIDs).toEqual([])
  })

  it('does not mutate the inputs', () => {
    const selected = new Set(['a'])
    const visible = new Set(['a', 'b'])
    planRoiRemoval(selected, visible)
    expect(selected).toEqual(new Set(['a']))
    expect(visible).toEqual(new Set(['a', 'b']))
  })
})
