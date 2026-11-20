import { StorageClasses } from '../../../../data/uids'
import {
  type DerivedDataContext,
  notifyVisualizationError,
} from '../derivedDataContext'
import { loadAnnotationGroups } from '../loadAnnotationGroups'

vi.mock('dicom-microscopy-viewer', () => ({
  metadata: {
    MicroscopyBulkSimpleAnnotations: class {
      AnnotationGroupSequence: unknown[]
      constructor({ metadata }: { metadata: { groups: unknown[] } }) {
        this.AnnotationGroupSequence = metadata.groups
      }
    },
  },
}))

vi.mock('../../../../utils/logger')

vi.mock('../derivedDataContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../derivedDataContext')>()),
  notifyVisualizationError: vi.fn(),
}))

vi.mock('../loadSeriesMetadata', () => ({
  loadSeriesMetadata: async ({
    onMetadata,
  }: {
    onMetadata: (metadata: unknown[]) => void
  }) => {
    onMetadata(retrieved)
  },
}))

const group = (uid: string) => ({
  AnnotationGroupUID: uid,
  AnnotationPropertyTypeCodeSequence: [
    { CodeValue: '1', CodingSchemeDesignator: 'SCT', CodeMeaning: 'x' },
  ],
})

let retrieved: unknown[] = []

describe('loadAnnotationGroups', () => {
  it('skips a malformed instance and still adds and styles the others', async () => {
    retrieved = [{ groups: [group('bad')] }, { groups: [group('good')] }]
    const addAnnotationGroups = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('malformed')
      })
      .mockImplementation(() => undefined)
    const setAnnotationGroupStyle = vi.fn()
    const onChange = vi.fn()
    const context = {
      session: {
        isDestroyed: false,
        volumeViewer: { addAnnotationGroups, setAnnotationGroupStyle },
        roiStyles: { findingFillColor: () => [1, 2, 3, 0.5] },
      },
      clients: { [StorageClasses.MICROSCOPY_BULK_SIMPLE_ANNOTATION]: {} },
      studyInstanceUID: '2.25.1',
      onChange,
    } as unknown as DerivedDataContext

    await loadAnnotationGroups(context)

    expect(addAnnotationGroups).toHaveBeenCalledTimes(2)
    expect(setAnnotationGroupStyle).toHaveBeenCalledTimes(1)
    expect(setAnnotationGroupStyle).toHaveBeenCalledWith('good', {
      color: [1, 2, 3, 0.5],
    })
    expect(notifyVisualizationError).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalled()
  })
})
