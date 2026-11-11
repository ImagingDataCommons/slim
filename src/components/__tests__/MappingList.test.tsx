import { fireEvent, render, screen } from '@testing-library/react'
import type * as dmv from 'dicom-microscopy-viewer'
import type { Mock } from 'vitest'

import MappingList, { type MappingListProps } from '../MappingList'

function makeMapping(uid: string, label: string): dmv.mapping.ParameterMapping {
  return {
    uid,
    number: 1,
    label,
    description: `Description for ${label}`,
    studyInstanceUID: '1.2',
    seriesInstanceUID: '1.2.3',
    sopInstanceUID: '1.2.3.4',
    sopInstanceUIDs: ['1.2.3.4'],
  } as dmv.mapping.ParameterMapping
}

function renderList(overrides: Partial<MappingListProps> = {}): {
  onMappingVisibilityChange: Mock
  onMappingStyleChange: Mock
} {
  const onMappingVisibilityChange = vi.fn()
  const onMappingStyleChange = vi.fn()
  const mappings = [
    makeMapping('mapping-1', 'TIL Density'),
    makeMapping('mapping-2', 'Tumor Score'),
    makeMapping('mapping-3', 'Necrosis'),
  ]
  render(
    <MappingList
      mappings={mappings}
      metadata={{
        'mapping-1': [],
        'mapping-2': [],
        'mapping-3': [],
      }}
      visibleMappingUIDs={new Set(['mapping-1'])}
      defaultMappingStyles={{
        'mapping-1': { opacity: 0.8 },
        'mapping-2': { opacity: 0.8 },
        'mapping-3': { opacity: 0.8 },
      }}
      onMappingVisibilityChange={onMappingVisibilityChange}
      onMappingStyleChange={onMappingStyleChange}
      {...overrides}
    />,
  )
  return { onMappingVisibilityChange, onMappingStyleChange }
}

describe('MappingList', () => {
  describe('BulkVisibilityControl', () => {
    it('shows the visibility count', () => {
      renderList()
      expect(screen.getByText('1 of 3 visible')).toBeInTheDocument()
    })

    it('calls onMappingVisibilityChange for each hidden mapping when Show all is clicked', () => {
      const { onMappingVisibilityChange } = renderList()
      fireEvent.click(
        screen.getByRole('button', { name: 'Show all parametric maps' }),
      )
      /** mapping-1 is already visible, so only mapping-2 and mapping-3 should change */
      expect(onMappingVisibilityChange).toHaveBeenCalledTimes(2)
      expect(onMappingVisibilityChange).toHaveBeenCalledWith({
        mappingUID: 'mapping-2',
        isVisible: true,
      })
      expect(onMappingVisibilityChange).toHaveBeenCalledWith({
        mappingUID: 'mapping-3',
        isVisible: true,
      })
    })

    it('calls onMappingVisibilityChange for each visible mapping when Hide all is clicked', () => {
      const { onMappingVisibilityChange } = renderList({
        visibleMappingUIDs: new Set(['mapping-1', 'mapping-2', 'mapping-3']),
      })
      fireEvent.click(
        screen.getByRole('button', { name: 'Hide all parametric maps' }),
      )
      expect(onMappingVisibilityChange).toHaveBeenCalledTimes(3)
      expect(onMappingVisibilityChange).toHaveBeenCalledWith({
        mappingUID: 'mapping-1',
        isVisible: false,
      })
      expect(onMappingVisibilityChange).toHaveBeenCalledWith({
        mappingUID: 'mapping-2',
        isVisible: false,
      })
      expect(onMappingVisibilityChange).toHaveBeenCalledWith({
        mappingUID: 'mapping-3',
        isVisible: false,
      })
    })

    it('disables Show all when all mappings are visible', () => {
      renderList({
        visibleMappingUIDs: new Set(['mapping-1', 'mapping-2', 'mapping-3']),
      })
      expect(
        screen.getByRole('button', { name: 'Show all parametric maps' }),
      ).toBeDisabled()
      expect(
        screen.getByRole('button', { name: 'Hide all parametric maps' }),
      ).not.toBeDisabled()
    })

    it('disables Hide all when no mappings are visible', () => {
      renderList({ visibleMappingUIDs: new Set() })
      expect(
        screen.getByRole('button', { name: 'Show all parametric maps' }),
      ).not.toBeDisabled()
      expect(
        screen.getByRole('button', { name: 'Hide all parametric maps' }),
      ).toBeDisabled()
    })

    it('does not render BulkVisibilityControl with fewer than 2 mappings', () => {
      renderList({
        mappings: [makeMapping('mapping-1', 'TIL Density')],
        metadata: { 'mapping-1': [] },
        defaultMappingStyles: { 'mapping-1': { opacity: 0.8 } },
      })
      expect(
        screen.queryByRole('button', { name: 'Show all parametric maps' }),
      ).not.toBeInTheDocument()
    })
  })

  describe('individual mapping visibility', () => {
    it('renders all mapping items', () => {
      renderList()
      expect(screen.getByText('TIL Density')).toBeInTheDocument()
      expect(screen.getByText('Tumor Score')).toBeInTheDocument()
      expect(screen.getByText('Necrosis')).toBeInTheDocument()
    })

    it('toggles individual mapping visibility', () => {
      const { onMappingVisibilityChange } = renderList()
      fireEvent.click(screen.getByRole('button', { name: 'Show TIL Density' }))
      expect(onMappingVisibilityChange).toHaveBeenCalledWith({
        mappingUID: 'mapping-1',
        isVisible: false,
      })
    })
  })
})
