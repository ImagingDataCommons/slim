import { fireEvent, render, screen } from '@testing-library/react'
import type * as dmv from 'dicom-microscopy-viewer'

import AnnotationGroupItem, {
  type AnnotationGroupItemProps,
} from '../AnnotationGroupItem'

vi.mock('../../contexts/ValidationContext', () => ({
  useValidation: () => ({ runValidations: () => ({ isValid: true }) }),
}))

const uid = '1.2.826.0.1.3680043.10.511.3.1'
const area = {
  CodeValue: '42798000',
  CodingSchemeDesignator: 'SCT',
  CodeMeaning: 'Area',
}
const eccentricity = {
  CodeValue: '112034',
  CodingSchemeDesignator: 'DCM',
  CodeMeaning: 'Eccentricity',
}
const nucleiWithMeasurements = {
  AnnotationCoordinateType: '2D',
  AnnotationGroupSequence: [
    {
      AnnotationGroupUID: uid,
      GraphicType: 'POLYGON',
      NumberOfAnnotations: 1200,
      MeasurementsSequence: [
        { ConceptNameCodeSequence: [area] },
        { ConceptNameCodeSequence: [eccentricity] },
      ],
    },
  ],
} as unknown as dmv.metadata.MicroscopyBulkSimpleAnnotations

function renderItem(
  overrides: Partial<AnnotationGroupItemProps> = {},
): AnnotationGroupItemProps {
  const props: AnnotationGroupItemProps = {
    annotationGroup: {
      uid,
      label: 'Nuclei',
    } as unknown as dmv.annotation.AnnotationGroup,
    isVisible: true,
    metadata: nucleiWithMeasurements,
    defaultStyle: { opacity: 1, color: [255, 0, 0] },
    onAnnotationGroupClick: vi.fn(),
    onVisibilityChange: vi.fn(),
    onStyleChange: vi.fn(),
    ...overrides,
  }
  render(<AnnotationGroupItem {...props} />)
  fireEvent.click(
    screen.getByRole('button', { name: 'Display settings for Nuclei' }),
  )
  return props
}

const measurementPicker = (): HTMLElement =>
  screen.getByRole('combobox', { name: 'Color by measurement' })

function chooseMeasurement(name: string): void {
  fireEvent.keyDown(measurementPicker(), { key: 'Enter' })
  fireEvent.click(screen.getByRole('option', { name }))
}

describe('AnnotationGroupItem color by measurement', () => {
  it('lists each measurement of the group', () => {
    renderItem()
    fireEvent.keyDown(measurementPicker(), { key: 'Enter' })

    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['None', 'Area', 'Eccentricity'])
  })

  it('colors the group by the chosen measurement', () => {
    const { onStyleChange } = renderItem()
    chooseMeasurement('Area')

    expect(onStyleChange).toHaveBeenCalledWith({
      uid,
      styleOptions: {
        measurement: expect.objectContaining({
          CodeValue: '42798000',
          CodingSchemeDesignator: 'SCT',
          CodeMeaning: 'Area',
        }),
      },
    })
    expect(
      screen.getByRole('img', { name: 'Colored by measurement' }),
    ).toBeInTheDocument()
  })

  it('restores the default color when None is chosen', () => {
    const { onStyleChange } = renderItem()
    chooseMeasurement('Area')
    chooseMeasurement('None')

    expect(onStyleChange).toHaveBeenLastCalledWith({
      uid,
      styleOptions: { color: [255, 0, 0] },
    })
    expect(
      screen.queryByRole('img', { name: 'Colored by measurement' }),
    ).not.toBeInTheDocument()
  })

  it('disables the measurements while the group is hidden', () => {
    renderItem({ isVisible: false })
    fireEvent.keyDown(measurementPicker(), { key: 'Enter' })

    expect(screen.getByRole('option', { name: 'Area' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('hides the picker for groups without measurements', () => {
    renderItem({
      metadata: {
        AnnotationGroupSequence: [{ AnnotationGroupUID: uid }],
      } as unknown as dmv.metadata.MicroscopyBulkSimpleAnnotations,
    })

    expect(
      screen.queryByRole('combobox', { name: 'Color by measurement' }),
    ).not.toBeInTheDocument()
  })
})
