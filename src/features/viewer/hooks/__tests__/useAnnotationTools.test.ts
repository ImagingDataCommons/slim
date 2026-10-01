import { act, renderHook } from '@testing-library/react'
import * as dcmjs from 'dcmjs'
import { useReducer } from 'react'

import { resetFakeDmv } from '../../testing/fakeDmv'
import {
  createTestSession,
  TEST_ROI_STYLE,
  type TestSession,
} from '../../testing/fixtures'
import type { AnnotationDraft } from '../../utils/annotationDraft'
import {
  INITIAL_VIEWER_INTERACTION,
  viewerInteractionReducer,
} from '../../utils/viewerInteraction'
import { useAnnotationTools } from '../useAnnotationTools'

jest.mock(
  'dicom-microscopy-viewer',
  () =>
    jest.requireActual<typeof import('../../testing/fakeDmv')>(
      '../../testing/fakeDmv',
    ).fakeDmvModule,
)
jest.mock('../../../../utils/logger')

interface Options {
  selectedRoiUIDs?: string[]
  visibleRoiUIDs?: string[]
  confirmRoiRemoval?: boolean
  draft?: AnnotationDraft
}

function setup({
  selectedRoiUIDs = [],
  visibleRoiUIDs = [],
  confirmRoiRemoval = false,
  draft = { evaluations: [] },
}: Options = {}) {
  const test: TestSession = createTestSession()
  const rois = {
    selectedRoiUIDs: new Set(selectedRoiUIDs),
    visibleRoiUIDs: new Set(visibleRoiUIDs),
    addStyledRoi: jest.fn(),
    removeRois: jest.fn(),
    restyleSelected: jest.fn(),
  }
  const onSave = jest.fn()
  const { result } = renderHook(() => {
    const [interaction, dispatch] = useReducer(
      viewerInteractionReducer,
      INITIAL_VIEWER_INTERACTION,
    )
    const tools = useAnnotationTools({
      sessionRef: test.access.sessionRef,
      interaction,
      dispatch,
      rois,
      draft,
      defaultRoiStyle: TEST_ROI_STYLE,
      confirmRoiRemoval,
      goToRanges: { x: [0, 25], y: [0, 50] },
      onSave,
    })
    return { interaction, tools }
  })
  return { ...test, result, rois, onSave }
}

beforeEach(() => {
  resetFakeDmv()
})

describe('useAnnotationTools', () => {
  it('starts drawing with the annotation dialog and stops on the second click', () => {
    const { result, viewer } = setup()

    act(() => {
      result.current.tools.onDraw()
    })
    expect(result.current.interaction).toMatchObject({
      isRoiDrawingActive: true,
      isAnnotationModalVisible: true,
    })
    expect(viewer.deactivateSelectInteraction).toHaveBeenCalled()

    act(() => {
      result.current.tools.onDraw()
    })
    expect(result.current.interaction.isRoiDrawingActive).toBe(false)
    expect(viewer.deactivateDrawInteraction).toHaveBeenCalled()
    expect(viewer.activateSelectInteraction).toHaveBeenCalled()
  })

  it('draws with the style of the chosen finding once configured', () => {
    const finding = new dcmjs.sr.coding.CodedConcept({
      value: '1',
      schemeDesignator: 'SCT',
      meaning: 'Tumor',
    })
    const { result, viewer } = setup({
      draft: { finding, geometryType: 'polygon', evaluations: [] },
    })
    act(() => {
      result.current.tools.onDraw()
    })

    act(() => {
      result.current.tools.onAnnotationConfigurationCompletion()
    })

    expect(viewer.activateDrawInteraction).toHaveBeenCalledWith({
      geometryType: 'polygon',
      markup: undefined,
      styleOptions: TEST_ROI_STYLE,
    })
    expect(result.current.interaction).toMatchObject({
      isRoiDrawingActive: true,
      isAnnotationModalVisible: false,
    })
  })

  it('does not draw without a finding and geometry type', () => {
    const { result, viewer } = setup()

    act(() => {
      result.current.tools.onAnnotationConfigurationCompletion()
    })

    expect(viewer.activateDrawInteraction).not.toHaveBeenCalled()
  })

  it('toggles modification from the viewer state', () => {
    const { result, viewer } = setup()

    act(() => {
      result.current.tools.onModify()
    })
    expect(viewer.activateModifyInteraction).toHaveBeenCalled()
    expect(result.current.interaction.isRoiModificationActive).toBe(true)

    act(() => {
      result.current.tools.onModify()
    })
    expect(viewer.deactivateModifyInteraction).toHaveBeenCalled()
    expect(result.current.interaction.isRoiModificationActive).toBe(false)
  })

  it('cancels the active tool from the Escape shortcut', () => {
    const { result, viewer } = setup()
    act(() => {
      result.current.tools.onTranslate()
    })

    act(() => {
      result.current.tools.onShortcut('cancel')
    })

    expect(viewer.deactivateTranslateInteraction).toHaveBeenCalled()
    expect(result.current.interaction.isRoiTranslationActive).toBe(false)
  })

  it('saves from the shortcut', () => {
    const { result, onSave } = setup()

    act(() => {
      result.current.tools.onShortcut('save')
    })

    expect(onSave).toHaveBeenCalled()
  })
})

describe('useAnnotationTools removal', () => {
  it('does nothing without selected or visible ROIs', () => {
    const { result, rois } = setup()

    act(() => {
      result.current.tools.onRemove()
    })

    expect(rois.removeRois).not.toHaveBeenCalled()
    expect(result.current.interaction.isRoiRemovalConfirmVisible).toBe(false)
  })

  it('removes right away unless confirmation is required', () => {
    const { result, rois } = setup({ visibleRoiUIDs: ['a'] })

    act(() => {
      result.current.tools.onRemove()
    })

    expect(rois.removeRois).toHaveBeenCalledTimes(1)
  })

  it('asks for confirmation first when configured', () => {
    const { result, rois } = setup({
      selectedRoiUIDs: ['a'],
      confirmRoiRemoval: true,
    })

    act(() => {
      result.current.tools.onRemove()
    })
    expect(result.current.interaction.isRoiRemovalConfirmVisible).toBe(true)
    expect(rois.removeRois).not.toHaveBeenCalled()

    act(() => {
      result.current.tools.onRoiRemovalConfirmation()
    })
    expect(result.current.interaction.isRoiRemovalConfirmVisible).toBe(false)
    expect(rois.removeRois).toHaveBeenCalledTimes(1)
  })
})

describe('useAnnotationTools visibility and go-to', () => {
  it('hides all ROIs and shows them again with the selection style', () => {
    const { result, viewer, rois } = setup()

    act(() => {
      result.current.tools.onToggleRoiVisibility()
    })
    expect(viewer.hideROIs).toHaveBeenCalled()
    expect(result.current.interaction.areRoisHidden).toBe(true)

    act(() => {
      result.current.tools.onToggleRoiVisibility()
    })
    expect(viewer.showROIs).toHaveBeenCalled()
    expect(rois.restyleSelected).toHaveBeenCalled()
    expect(result.current.interaction.areRoisHidden).toBe(false)
  })

  it('ignores an invalid position', () => {
    const { result, viewer } = setup()
    act(() => {
      result.current.tools.onGoTo()
    })
    act(() => {
      result.current.tools.onGoToInputChange('x', '100')
      result.current.tools.onGoToInputChange('y', '20')
      result.current.tools.onGoToInputChange('magnification', '10')
    })

    act(() => {
      result.current.tools.onSlidePositionSelection()
    })

    expect(viewer.navigate).not.toHaveBeenCalled()
    expect(result.current.interaction.isGoToModalVisible).toBe(true)
  })

  it('navigates to a valid position and marks it', () => {
    const { result, viewer, rois } = setup()
    act(() => {
      result.current.tools.onGoTo()
    })
    act(() => {
      result.current.tools.onGoToInputChange('x', '10')
      result.current.tools.onGoToInputChange('y', '20')
      result.current.tools.onGoToInputChange('magnification', '10')
    })

    act(() => {
      result.current.tools.onSlidePositionSelection()
    })

    expect(viewer.navigate).toHaveBeenCalledWith({
      position: [10, 20],
      level: expect.any(Number),
    })
    expect(rois.addStyledRoi).toHaveBeenCalledWith(
      expect.objectContaining({ scoord3d: expect.anything() }),
      TEST_ROI_STYLE,
    )
    expect(result.current.interaction.isGoToModalVisible).toBe(false)
  })
})
