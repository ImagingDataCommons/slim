import { EMPTY_GO_TO_INPUT } from '../goTo'
import {
  INITIAL_VIEWER_INTERACTION,
  type ViewerInteraction,
  viewerInteractionReducer,
} from '../viewerInteraction'

const reduce = viewerInteractionReducer

describe('viewerInteractionReducer', () => {
  it('opens the annotation dialog when drawing starts and closes it on stop', () => {
    const modifying = reduce(INITIAL_VIEWER_INTERACTION, {
      type: 'startModifying',
    })
    const drawing = reduce(modifying, { type: 'startDrawing' })

    expect(drawing).toMatchObject({
      isRoiDrawingActive: true,
      isRoiModificationActive: false,
      isAnnotationModalVisible: true,
    })
    expect(reduce(drawing, { type: 'stopDrawing' })).toMatchObject({
      isRoiDrawingActive: false,
      isAnnotationModalVisible: false,
    })
  })

  it('keeps drawing after the annotation dialog completes and stops on cancel', () => {
    const drawing = reduce(INITIAL_VIEWER_INTERACTION, { type: 'startDrawing' })

    expect(
      reduce(drawing, { type: 'completeAnnotationConfiguration' }),
    ).toMatchObject({
      isAnnotationModalVisible: false,
      isRoiDrawingActive: true,
    })
    expect(
      reduce(drawing, { type: 'cancelAnnotationConfiguration' }),
    ).toMatchObject({
      isAnnotationModalVisible: false,
      isRoiDrawingActive: false,
    })
  })

  it('runs one ROI tool at a time', () => {
    const translating = reduce(
      reduce(INITIAL_VIEWER_INTERACTION, { type: 'startModifying' }),
      { type: 'startTranslating' },
    )

    expect(translating).toMatchObject({
      isRoiModificationActive: false,
      isRoiTranslationActive: true,
    })
    expect(
      reduce(translating, { type: 'stopTools' }).isRoiTranslationActive,
    ).toBe(false)
  })

  it('cancel stops tools and closes tool dialogs but not the report', () => {
    const busy: ViewerInteraction = {
      ...INITIAL_VIEWER_INTERACTION,
      isRoiDrawingActive: true,
      isGoToModalVisible: true,
      isReportModalVisible: true,
      goToInput: { x: '1', y: '2', magnification: '3' },
    }

    expect(reduce(busy, { type: 'cancel' })).toEqual({
      ...INITIAL_VIEWER_INTERACTION,
      isReportModalVisible: true,
    })
  })

  it('opens go-to with empty fields, edits them and clears them on close', () => {
    const open = reduce(
      { ...INITIAL_VIEWER_INTERACTION, isReportModalVisible: true },
      { type: 'openGoTo' },
    )
    expect(open).toMatchObject({
      isGoToModalVisible: true,
      isReportModalVisible: false,
      goToInput: EMPTY_GO_TO_INPUT,
    })

    const edited = reduce(open, {
      type: 'changeGoToInput',
      field: 'x',
      value: '12',
    })
    expect(edited.goToInput).toEqual({ ...EMPTY_GO_TO_INPUT, x: '12' })
    expect(reduce(edited, { type: 'closeGoTo' })).toMatchObject({
      isGoToModalVisible: false,
      goToInput: EMPTY_GO_TO_INPUT,
    })
  })

  it('hiding ROIs stops the active tool', () => {
    const hidden = reduce(
      reduce(INITIAL_VIEWER_INTERACTION, { type: 'startModifying' }),
      { type: 'hideRois' },
    )

    expect(hidden).toMatchObject({
      areRoisHidden: true,
      isRoiModificationActive: false,
    })
    expect(reduce(hidden, { type: 'showRois' }).areRoisHidden).toBe(false)
  })

  it('toggles the dialogs it does not otherwise manage', () => {
    let state = reduce(INITIAL_VIEWER_INTERACTION, {
      type: 'setSelectedRoiModalVisible',
      isVisible: true,
    })
    state = reduce(state, { type: 'setReportModalVisible', isVisible: true })
    state = reduce(state, {
      type: 'setRoiRemovalConfirmVisible',
      isVisible: true,
    })

    expect(state).toMatchObject({
      isSelectedRoiModalVisible: true,
      isReportModalVisible: true,
      isRoiRemovalConfirmVisible: true,
    })
  })
})
