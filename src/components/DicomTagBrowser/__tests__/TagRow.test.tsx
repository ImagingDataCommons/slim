import { fireEvent, render, screen, within } from '@testing-library/react'
import { TagRow } from '../TagRow'
import type { TagTreeNode } from '../tagTree'

const sequence: TagTreeNode = {
  key: '00400560',
  tag: '(0040,0560)',
  vr: 'SQ',
  keyword: 'SpecimenDescriptionSequence',
  value: '',
  children: [
    {
      key: '00400560-1-00400551',
      tag: '(0040,0551)',
      vr: 'LO',
      keyword: 'SpecimenIdentifier',
      value: 'S-1',
    },
  ],
}

function renderRows(expandedKeys: ReadonlySet<string>, onToggle = vi.fn()) {
  render(
    <table>
      <tbody>
        <TagRow
          item={sequence}
          depth={0}
          expandedKeys={expandedKeys}
          onToggle={onToggle}
        />
      </tbody>
    </table>,
  )
  return onToggle
}

describe('TagRow', () => {
  it('exposes rows and cells as table semantics', () => {
    renderRows(new Set([sequence.key]))

    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(2)
    expect(within(rows[1]).getAllByRole('cell')).toHaveLength(4)
    expect(within(rows[1]).getByText('SpecimenIdentifier')).toBeVisible()
  })

  it('toggles a sequence from its expand button', () => {
    const onToggle = renderRows(new Set())

    expect(screen.getAllByRole('row')).toHaveLength(1)
    fireEvent.click(
      screen.getByRole('button', {
        name: '(0040,0560) SpecimenDescriptionSequence',
      }),
    )
    expect(onToggle).toHaveBeenCalledWith(sequence.key)
  })
})
