import { act, renderHook } from '@testing-library/react'

import { buildAnnotationConfig } from '../../utils/annotationConfig'
import { useAnnotationDraft } from '../useAnnotationDraft'

jest.mock('../../../../utils/logger')

const config = buildAnnotationConfig([
  {
    finding: { value: '1', schemeDesignator: 'SCT', meaning: 'Tumor' },
    geometryTypes: ['polygon', 'point'],
    evaluations: [
      {
        name: { value: '2', schemeDesignator: 'DCM', meaning: 'Grade' },
        values: [{ value: '3', schemeDesignator: 'DCM', meaning: 'High' }],
      },
    ],
  },
  {
    finding: { value: '4', schemeDesignator: 'SCT', meaning: 'Stroma' },
    geometryTypes: ['point'],
  },
])
const [tumor, stroma] = config.findings

describe('useAnnotationDraft', () => {
  it('offers nothing until a finding is chosen', () => {
    const { result } = renderHook(() => useAnnotationDraft(config))

    expect(result.current.draft).toEqual({ evaluations: [] })
    expect(result.current.geometryTypes).toEqual([])
    expect(result.current.evaluationOptions).toEqual([])
  })

  it('offers the options of the chosen finding', () => {
    const { result } = renderHook(() => useAnnotationDraft(config))

    act(() => {
      result.current.onFindingChange(tumor)
    })

    expect(result.current.geometryTypes).toEqual(['polygon', 'point'])
    expect(result.current.evaluationOptions).toHaveLength(1)
  })

  it('drops a geometry type the next finding does not allow', () => {
    const { result } = renderHook(() => useAnnotationDraft(config))
    act(() => {
      result.current.onFindingChange(tumor)
    })
    act(() => {
      result.current.onGeometryTypeChange('polygon')
    })
    act(() => {
      result.current.onFindingChange(stroma)
    })

    expect(result.current.draft.geometryType).toBeUndefined()
  })

  it('records evaluations and the measurement choice', () => {
    const { result } = renderHook(() => useAnnotationDraft(config))
    const [grade] = config.evaluationOptions['SCT:1']
    act(() => {
      result.current.onFindingChange(tumor)
    })
    act(() => {
      result.current.onEvaluationChange(grade.name, grade.values[0])
      result.current.onMeasurementChange(true)
    })

    expect(result.current.draft.evaluations).toHaveLength(1)
    expect(result.current.draft.markup).toBe('measurement')

    act(() => {
      result.current.onEvaluationClear()
    })
    expect(result.current.draft.evaluations).toEqual([])
  })
})
