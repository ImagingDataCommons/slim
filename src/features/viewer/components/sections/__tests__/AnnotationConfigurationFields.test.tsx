import { render, screen } from '@testing-library/react'

import { AnnotationConfigurationFields } from '../AnnotationConfigurationFields'

const concept = (value: string, meaning: string) =>
  ({
    value,
    schemeDesignator: 'SCT',
    meaning,
    CodeValue: value,
    CodingSchemeDesignator: 'SCT',
    CodeMeaning: meaning,
  }) as never

describe('AnnotationConfigurationFields', () => {
  it('names each select by its field label for assistive technology', () => {
    const tumor = concept('108369006', 'Tumor')
    render(
      <AnnotationConfigurationFields
        findings={[tumor]}
        selectedFinding={tumor}
        evaluationOptions={[
          {
            name: concept('371441004', 'Histological grade'),
            values: [concept('54102005', 'G1')],
          } as never,
        ]}
        selectedEvaluations={[]}
        geometryTypes={['polygon', 'point']}
        selectedGeometryType="polygon"
        isMeasurementActive={false}
        onFindingChange={vi.fn()}
        onEvaluationChange={vi.fn()}
        onEvaluationClear={vi.fn()}
        onGeometryTypeChange={vi.fn()}
        onMeasurementChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('combobox', { name: /^Finding/ })).toBeVisible()
    expect(
      screen.getByRole('combobox', { name: /^Histological grade/ }),
    ).toBeVisible()
    expect(
      screen.getByRole('combobox', { name: /^ROI geometry/ }),
    ).toBeVisible()
  })
})
