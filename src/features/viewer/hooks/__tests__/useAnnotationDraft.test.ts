import { act, renderHook } from '@testing-library/react'

import { buildAnnotationConfig } from '../../utils/annotationConfig'
import { useAnnotationDraft } from '../useAnnotationDraft'

vi.mock('../../../../utils/logger')

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
  it('preselects the first finding and its first geometry', () => {
    const { result } = renderHook(() => useAnnotationDraft(config))

    expect(result.current.draft.finding).toBe(tumor)
    expect(result.current.draft.geometryType).toBe('polygon')
    expect(result.current.geometryTypes).toEqual(['polygon', 'point'])
    expect(result.current.evaluationOptions).toHaveLength(1)
  })

  it('stays empty when the config has no findings', () => {
    const { result } = renderHook(() =>
      useAnnotationDraft(buildAnnotationConfig([])),
    )

    expect(result.current.draft).toEqual({ evaluations: [] })
    expect(result.current.geometryTypes).toEqual([])
  })

  it('offers the options of the chosen finding', () => {
    const { result } = renderHook(() => useAnnotationDraft(config))

    act(() => {
      result.current.onFindingChange(stroma)
    })

    expect(result.current.draft.finding).toBe(stroma)
    expect(result.current.geometryTypes).toEqual(['point'])
    expect(result.current.evaluationOptions).toEqual([])
  })

  it('selects the first geometry the next finding allows when the current one is invalid', () => {
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

    expect(result.current.draft.geometryType).toBe('point')
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
