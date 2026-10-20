import { act, renderHook } from '@testing-library/react'
import * as dcmjs from 'dcmjs'
import * as dmv from 'dicom-microscopy-viewer'
import type { Mock } from 'vitest'

import { getRoiKey } from '../../../../components/SlideViewer/utils/roiUtils'
import { resetFakeDmv } from '../../testing/fakeDmv'
import {
  createTestSession,
  TEST_ROI_STYLE,
  type TestSession,
} from '../../testing/fixtures'
import { SELECTED_ROI_STYLE, useRois } from '../useRois'

vi.mock('dicom-microscopy-viewer', async () => {
  const actual = await vi.importActual<typeof import('../../testing/fakeDmv')>(
    '../../testing/fakeDmv',
  )
  return actual.fakeDmvModule
})
vi.mock('../../../../utils/logger')

const OWN_STYLE = { stroke: { color: [1, 2, 3, 1], width: 1 } }

function createRoi(uid: string): dmv.roi.ROI {
  return new dmv.roi.ROI({
    uid,
    scoord3d: new dmv.scoord3d.Point({
      coordinates: [1, 2, 0],
      frameOfReferenceUID: 'for',
    }),
  })
}

interface Setup extends TestSession {
  result: { current: ReturnType<typeof useRois> }
  isShiftDown: Mock<(...args: []) => boolean>
  onDetailsVisibilityChange: Mock
}

function setup(): Setup {
  const test = createTestSession()
  const isShiftDown = vi.fn(() => false)
  const onDetailsVisibilityChange = vi.fn()
  const { result } = renderHook(() =>
    useRois({
      viewer: test.access,
      defaultRoiStyle: TEST_ROI_STYLE,
      isShiftDown,
      onDetailsVisibilityChange,
    }),
  )
  return { ...test, result, isShiftDown, onDetailsVisibilityChange }
}

function addRois(result: Setup['result'], ...uids: string[]): void {
  act(() => {
    for (const uid of uids)
      result.current.addStyledRoi(createRoi(uid), OWN_STYLE)
  })
}

beforeEach(() => {
  resetFakeDmv()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useRois', () => {
  it('adds user ROIs with their style and shows them', () => {
    const { result, viewer, access } = setup()

    addRois(result, 'a')

    expect(viewer.getROIStyle('a')).toBe(OWN_STYLE)
    expect([...result.current.visibleRoiUIDs]).toEqual(['a'])
    expect(access.refreshSnapshot).toHaveBeenCalled()
  })

  it('records the draft finding on a drawn ROI', () => {
    const { result, viewer, session } = setup()
    const finding = new dcmjs.sr.coding.CodedConcept({
      value: '85756007',
      schemeDesignator: 'SCT',
      meaning: 'Tissue',
    })

    act(() => {
      result.current.addDrawnRoi(
        createRoi('drawn'),
        { evaluations: [] },
        OWN_STYLE,
      )
      result.current.addDrawnRoi(
        createRoi('found'),
        { finding, evaluations: [] },
        OWN_STYLE,
      )
    })

    expect(viewer.rois.map((roi) => roi.uid)).toEqual(['found'])
    expect(getRoiKey(session.volumeViewer.getROI('found'))).toBe('SCT:85756007')
  })

  it('attaches the configured finding category on a drawn ROI', () => {
    const test = createTestSession()
    const finding = new dcmjs.sr.coding.CodedConcept({
      value: '85756007',
      schemeDesignator: 'SCT',
      meaning: 'Tissue',
    })
    const findingCategory = new dcmjs.sr.coding.CodedConcept({
      value: '91723000',
      schemeDesignator: 'SCT',
      meaning: 'Anatomical structure',
    })
    const { result } = renderHook(() =>
      useRois({
        viewer: test.access,
        defaultRoiStyle: TEST_ROI_STYLE,
        findingCategories: { 'SCT:85756007': findingCategory },
        isShiftDown: () => false,
        onDetailsVisibilityChange: vi.fn(),
      }),
    )

    act(() => {
      result.current.addDrawnRoi(
        createRoi('categorized'),
        { finding, evaluations: [] },
        OWN_STYLE,
      )
    })

    const evaluations =
      test.session.volumeViewer.getROI('categorized').evaluations
    expect(evaluations).toHaveLength(2)
    expect(evaluations[0]).toMatchObject({
      ConceptNameCodeSequence: [
        expect.objectContaining({ CodeValue: '276214006' }),
      ],
      ConceptCodeSequence: [expect.objectContaining({ CodeValue: '91723000' })],
    })
    expect(evaluations[1]).toMatchObject({
      ConceptNameCodeSequence: [
        expect.objectContaining({ CodeValue: '121071' }),
      ],
      ConceptCodeSequence: [expect.objectContaining({ CodeValue: '85756007' })],
    })
  })

  it('selects an ROI and restores the style of the others', () => {
    const { result, viewer } = setup()
    addRois(result, 'a', 'b')

    act(() => {
      result.current.onSelection('a')
    })

    expect([...result.current.selectedRoiUIDs]).toEqual(['a'])
    expect(result.current.selectedRoi?.uid).toBe('a')
    expect(viewer.getROIStyle('a')).toBe(SELECTED_ROI_STYLE)
    expect(viewer.getROIStyle('b')).toBe(OWN_STYLE)
  })

  it('adds to the selection while Shift is held', () => {
    const { result, isShiftDown } = setup()
    addRois(result, 'a', 'b')
    act(() => {
      result.current.onSelection('a')
    })
    isShiftDown.mockReturnValue(true)

    act(() => {
      result.current.onSelection('b')
    })

    expect([...result.current.selectedRoiUIDs]).toEqual(['a', 'b'])
  })

  it('hiding an ROI clears its style and its selection', () => {
    const { result, viewer } = setup()
    addRois(result, 'a')
    act(() => {
      result.current.onSelection('a')
    })

    act(() => {
      result.current.onVisibilityChange({ roiUID: 'a', isVisible: false })
    })

    expect(viewer.getROIStyle('a')).toEqual({})
    expect(result.current.visibleRoiUIDs.size).toBe(0)
    expect(result.current.selectedRoiUIDs.size).toBe(0)

    act(() => {
      result.current.onVisibilityChange({ roiUID: 'a', isVisible: true })
    })
    expect(viewer.getROIStyle('a')).toBe(OWN_STYLE)
  })

  it('removes the selected ROIs, or every visible one', () => {
    const { result, viewer } = setup()
    addRois(result, 'a', 'b', 'c')
    act(() => {
      result.current.onSelection('b')
    })

    act(() => {
      result.current.removeRois()
    })
    expect(viewer.rois.map((roi) => roi.uid)).toEqual(['a', 'c'])
    expect([...result.current.visibleRoiUIDs]).toEqual(['a', 'c'])

    act(() => {
      result.current.removeRois()
    })
    expect(viewer.rois).toHaveLength(0)
    expect(viewer.activateSelectInteraction).toHaveBeenCalled()
  })

  it('restyles ROIs from the annotation list and shows them', () => {
    const { result, viewer, session } = setup()
    addRois(result, 'a')
    act(() => {
      result.current.onVisibilityChange({ roiUID: 'a', isVisible: false })
    })
    const styleOptions = { color: [0, 100, 0], opacity: 1, contourOnly: false }

    act(() => {
      result.current.onStylesChange({ uids: ['a'], styleOptions })
    })

    expect(viewer.getROIStyle('a')?.stroke).toEqual({
      color: [0, 100, 0, 1],
      width: 2,
    })
    expect(session.roiStyles.copyAnnotationStyles().a).toBe(styleOptions)
    expect([...result.current.visibleRoiUIDs]).toEqual(['a'])
  })

  it('reset hides every ROI and clears the selection', () => {
    const { result } = setup()
    addRois(result, 'a')
    act(() => {
      result.current.onSelection('a')
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.visibleRoiUIDs.size).toBe(0)
    expect(result.current.selectedRoiUIDs.size).toBe(0)
    expect(result.current.selectedRoi).toBeUndefined()
  })
})

describe('useRois DMV events', () => {
  it('selects the ROI DMV reports and clears on an empty click', () => {
    const { result, viewer, session } = setup()
    addRois(result, 'a')

    act(() => {
      result.current.dmvHandlers.dicommicroscopyviewer_roi_selected(
        session.volumeViewer.getROI('a'),
      )
    })
    expect([...result.current.selectedRoiUIDs]).toEqual(['a'])

    act(() => {
      result.current.dmvHandlers.dicommicroscopyviewer_viewport_clicked({
        rois: [],
      })
    })
    expect(result.current.selectedRoiUIDs.size).toBe(0)
    expect(viewer.clearSelections).toHaveBeenCalled()
  })

  it('opens the details of a double-clicked ROI, not of bulk annotations', () => {
    const { result, viewer, session, onDetailsVisibilityChange } = setup()
    addRois(result, 'a')
    viewer.annotationGroups.add({
      uid: 'group',
      seriesInstanceUID: 'ann',
      referencedSeriesInstanceUID: 'slide',
    })

    act(() => {
      result.current.dmvHandlers.dicommicroscopyviewer_roi_double_clicked(
        createRoi('group-7'),
      )
    })
    expect(onDetailsVisibilityChange).not.toHaveBeenCalled()

    act(() => {
      result.current.dmvHandlers.dicommicroscopyviewer_roi_double_clicked(
        session.volumeViewer.getROI('a'),
      )
    })
    expect(result.current.selectedRoi?.uid).toBe('a')
    expect(onDetailsVisibilityChange).toHaveBeenLastCalledWith(true)

    act(() => {
      result.current.dmvHandlers.dicommicroscopyviewer_roi_double_clicked(null)
    })
    expect(result.current.selectedRoi).toBeUndefined()
    expect(onDetailsVisibilityChange).toHaveBeenLastCalledWith(false)
  })

  it('re-renders the list when an ROI is modified', () => {
    const { result } = setup()
    addRois(result, 'a')
    const before = result.current.visibleRoiUIDs

    act(() => {
      result.current.dmvHandlers.dicommicroscopyviewer_roi_modified(
        createRoi('a'),
      )
    })

    expect(result.current.visibleRoiUIDs).not.toBe(before)
    expect([...result.current.visibleRoiUIDs]).toEqual(['a'])
  })
})
