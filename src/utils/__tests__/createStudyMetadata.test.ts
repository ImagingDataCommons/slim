import type { Instance } from '../../services/DICOMMetadataStore'
import createSeriesMetadata from '../createSeriesMetadata'
import createStudyMetadata from '../createStudyMetadata'

function instance(
  SOPInstanceUID: string,
  overrides: Partial<Instance> = {},
): Instance {
  return {
    SOPInstanceUID,
    SOPClassUID: '1.2.840.10008.5.1.4.1.1.77.1.6',
    Rows: 1,
    Columns: 1,
    PatientSex: 'F',
    Modality: 'SM',
    InstanceNumber: '1',
    SeriesInstanceUID: '1.2.3',
    ...overrides,
  }
}

describe('createSeriesMetadata', () => {
  it('starts empty with default attributes', () => {
    const series = createSeriesMetadata('1.2.3')
    expect(series).toMatchObject({
      SeriesInstanceUID: '1.2.3',
      Modality: '',
      SeriesNumber: 0,
      SeriesDescription: '',
      instances: [],
    })
  })

  it('copies attributes from the first default instance', () => {
    const series = createSeriesMetadata('1.2.3', [
      instance('a', { SeriesDescription: 'H&E', Modality: 'SM' }),
    ])
    expect(series.SeriesDescription).toBe('H&E')
    expect(series.Modality).toBe('SM')
    expect(series.instances).toEqual([])
  })

  it('adds instances once per SOP Instance UID and looks them up', () => {
    const series = createSeriesMetadata('1.2.3')
    const first = instance('a')
    series.addInstance(first)
    series.addInstances([instance('a'), instance('b')])
    expect(series.instances.map((item) => item.SOPInstanceUID)).toEqual([
      'a',
      'b',
    ])
    expect(series.getInstance('a')).toBe(first)
    expect(series.getInstance('missing')).toBeUndefined()
  })
})

describe('createStudyMetadata', () => {
  it('starts empty', () => {
    expect(createStudyMetadata('1.2')).toMatchObject({
      StudyInstanceUID: '1.2',
      StudyDescription: '',
      isLoaded: false,
      series: [],
    })
  })

  it('groups instances into series', () => {
    const study = createStudyMetadata('1.2')
    study.addInstancesToSeries([instance('a'), instance('b')])
    study.addInstanceToSeries(instance('c'))
    study.addInstanceToSeries(instance('d', { SeriesInstanceUID: '4.5.6' }))
    expect(study.series.map((series) => series.SeriesInstanceUID)).toEqual([
      '1.2.3',
      '4.5.6',
    ])
    expect(study.series[0].instances).toHaveLength(3)
  })

  it('fills a missing study description from the instances', () => {
    const study = createStudyMetadata('1.2')
    study.addInstanceToSeries(instance('a', { StudyDescription: 'Biopsy' }))
    expect(study.StudyDescription).toBe('Biopsy')
    study.addInstanceToSeries(instance('b', { StudyDescription: 'Other' }))
    expect(study.StudyDescription).toBe('Biopsy')
  })

  it('ignores empty batches', () => {
    const study = createStudyMetadata('1.2')
    study.addInstancesToSeries([])
    expect(study.series).toEqual([])
  })

  it('merges series metadata into existing or new series', () => {
    const study = createStudyMetadata('1.2')
    study.addInstanceToSeries(instance('a'))
    study.setSeriesMetadata('1.2.3', { SeriesDescription: 'H&E' })
    study.setSeriesMetadata('7.8.9', { SeriesNumber: 2 })
    expect(study.series[0].SeriesDescription).toBe('H&E')
    expect(study.series[0].instances).toHaveLength(1)
    expect(study.series[1]).toMatchObject({
      SeriesInstanceUID: '7.8.9',
      SeriesNumber: 2,
      instances: [],
    })
  })
})
