import {
  stylesForRoiSelection,
  visibleUidsAfterSelection,
} from '../roiSelectionStyles'

const selectedStyle = { stroke: { color: [1, 0, 0, 1], width: 3 } }
const ownStyle = { stroke: { color: [0, 1, 0, 1], width: 1 } }

describe('stylesForRoiSelection', () => {
  it('styles selected and visible ROIs and leaves hidden ones alone', () => {
    const rois = [{ uid: 'a' }, { uid: 'b' }, { uid: 'c' }] as never[]
    const { styles, selectedVisibleUIDs } = stylesForRoiSelection({
      rois,
      selectedRoiUIDs: new Set(['a']),
      visibleRoiUIDs: new Set(['a', 'b']),
      selectedStyle,
      styleForRoi: () => ownStyle,
    })
    expect(styles).toEqual([
      { uid: 'a', style: selectedStyle },
      { uid: 'b', style: ownStyle },
    ])
    expect(selectedVisibleUIDs).toEqual(['a'])
  })
})

describe('visibleUidsAfterSelection', () => {
  it('keeps the same Set when every selected UID is already visible', () => {
    const visible = new Set(['a', 'b'])
    expect(visibleUidsAfterSelection(visible, ['a'])).toBe(visible)
  })

  it('adds newly revealed selected UIDs', () => {
    expect(visibleUidsAfterSelection(new Set(['b']), ['a', 'b'])).toEqual(
      new Set(['b', 'a']),
    )
  })
})
