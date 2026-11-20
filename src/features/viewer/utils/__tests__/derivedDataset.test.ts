import { StorageClasses } from '../../../../data/uids'
import {
  classifyDerivedDataset,
  isBulkAnnotationUid,
  sharesReferenceFrame,
} from '../derivedDataset'

describe('classifyDerivedDataset', () => {
  it.each([
    [StorageClasses.COMPREHENSIVE_3D_SR, 'rois'],
    [StorageClasses.MICROSCOPY_BULK_SIMPLE_ANNOTATION, 'annotationGroups'],
    [StorageClasses.SEGMENTATION, 'segments'],
    [StorageClasses.LABELMAP_SEGMENTATION, 'segments'],
    [StorageClasses.PARAMETRIC_MAP, 'mappings'],
    [StorageClasses.OPTICAL_PATH, 'opticalPaths'],
  ])('shows %s as %s', (sopClassUID, kind) => {
    expect(classifyDerivedDataset(sopClassUID)).toEqual({ kind })
  })

  it('labels recognized classes that are not displayed yet', () => {
    expect(
      classifyDerivedDataset(
        StorageClasses.GRAYSCALE_SOFTCOPY_PRESENTATION_STATE,
      ),
    ).toEqual({
      kind: 'unsupported',
      label: 'Grayscale Softcopy Presentation State',
    })
  })

  it('ignores unknown classes', () => {
    expect(classifyDerivedDataset('1.2.3')).toEqual({ kind: 'unknown' })
  })
})

describe('sharesReferenceFrame', () => {
  const reference = { FrameOfReferenceUID: 'for', ContainerIdentifier: 'c' }

  it('needs both the frame of reference and the container to match', () => {
    expect(sharesReferenceFrame({ ...reference }, reference)).toBe(true)
    expect(
      sharesReferenceFrame(
        { ...reference, ContainerIdentifier: 'd' },
        reference,
      ),
    ).toBe(false)
    expect(
      sharesReferenceFrame(
        { ...reference, FrameOfReferenceUID: 'x' },
        reference,
      ),
    ).toBe(false)
  })
})

describe('isBulkAnnotationUid', () => {
  it('recognizes features named after an annotation group', () => {
    expect(isBulkAnnotationUid('g1-12', ['g1'])).toBe(true)
    expect(isBulkAnnotationUid('roi-1', ['g1'])).toBe(false)
    expect(isBulkAnnotationUid(undefined, ['g1'])).toBe(false)
  })
})
