/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
/** skipcq: JS-C1003 */
import type * as dwc from 'dicomweb-client'

import { StorageClasses } from '../../../../data/uids'
import { type ContainsEntry, findContainsEntry } from '../containsCatalog'
import {
  CONTAINS_MAX_PAGES,
  CONTAINS_PAGE_SIZE,
  type ContainsSearchClient,
  confirmStudyContains,
  fetchSlideStudy,
  STUDY_FIELDS,
  searchStudiesContaining,
  withEntryModality,
} from '../containsSearch'

const entry = (id: string): ContainsEntry => {
  const found = findContainsEntry(id)
  if (found === undefined) throw new Error(`No entry ${id}`)
  return found
}

type QidoRow = dwc.api.Instance & dwc.api.Series

const offsetOf = (options: dwc.api.SearchForSeriesOptions): number =>
  Number((options.queryParams as { offset?: number } | undefined)?.offset)

function row(
  studyUid: string,
  seriesUid: string,
  sopClassUid?: string,
): QidoRow {
  return {
    '0020000D': { vr: 'UI', Value: [studyUid] },
    '0020000E': { vr: 'UI', Value: [seriesUid] },
    ...(sopClassUid === undefined
      ? {}
      : { '00080016': { vr: 'UI', Value: [sopClassUid] } }),
  } as unknown as QidoRow
}

function badRequest(): Error {
  return Object.assign(new Error('400'), { status: 400 })
}

function fakeClient(
  overrides: Partial<ContainsSearchClient> = {},
): ContainsSearchClient & {
  searchForSeries: ReturnType<typeof vi.fn>
  searchForInstances: ReturnType<typeof vi.fn>
} {
  return {
    searchForSeries: vi.fn(overrides.searchForSeries ?? (async () => [])),
    searchForInstances: vi.fn(overrides.searchForInstances ?? (async () => [])),
  }
}

describe('searchStudiesContaining', () => {
  it('matches on SOP class and groups series by study', async () => {
    const pmap = StorageClasses.PARAMETRIC_MAP
    const client = fakeClient({
      searchForInstances: async () => [
        row('s1', 'a', pmap),
        row('s1', 'a', pmap),
        row('s1', 'b', pmap),
        row('s2', 'c', pmap),
      ],
    })

    const result = await searchStudiesContaining(client, entry('pmap'))

    expect(client.searchForInstances).toHaveBeenCalledWith({
      queryParams: {
        SOPClassUID: pmap,
        includefield: STUDY_FIELDS,
        limit: CONTAINS_PAGE_SIZE,
        offset: 0,
      },
    })
    expect(client.searchForSeries).not.toHaveBeenCalled()
    expect(result.isExact).toBe(true)
    expect(result.isPartial).toBe(false)
    expect(
      Object.fromEntries(
        [...result.matches].map(([uid, match]) => [uid, match.seriesUids]),
      ),
    ).toEqual({ s1: ['a', 'b'], s2: ['c'] })
  })

  it('falls back to the modality when the server rejects SOPClassUID', async () => {
    const client = fakeClient({
      searchForInstances: async () => {
        throw badRequest()
      },
      searchForSeries: async () => [row('s1', 'a')],
    })
    const onPage = vi.fn()

    const result = await searchStudiesContaining(client, entry('pmap'), {
      onPage,
    })

    expect(client.searchForSeries).toHaveBeenCalledWith({
      queryParams: {
        Modality: 'OT',
        includefield: STUDY_FIELDS,
        limit: CONTAINS_PAGE_SIZE,
        offset: 0,
      },
    })
    expect(result.isExact).toBe(false)
    expect([...result.matches.keys()]).toEqual(['s1'])
    expect(onPage).toHaveBeenLastCalledWith(1)

    await searchStudiesContaining(client, entry('seg'))
    expect(client.searchForInstances).toHaveBeenCalledTimes(1)
  })

  it('falls back when the server ignores SOPClassUID', async () => {
    const client = fakeClient({
      searchForInstances: async () => [
        row('s1', 'a', StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE),
      ],
      searchForSeries: async () => [row('s2', 'b')],
    })

    const result = await searchStudiesContaining(client, entry('ann'))

    expect([...result.matches.keys()]).toEqual(['s2'])
    expect(result.isExact).toBe(true)
  })

  it('rethrows other errors', async () => {
    const client = fakeClient({
      searchForInstances: async () => {
        throw Object.assign(new Error('down'), { status: 503 })
      },
    })

    await expect(searchStudiesContaining(client, entry('ann'))).rejects.toThrow(
      'down',
    )
    expect(client.searchForSeries).not.toHaveBeenCalled()
  })

  it('pages until a short page and stops at the cap', async () => {
    const fullPage = (offset: number): QidoRow[] =>
      Array.from({ length: CONTAINS_PAGE_SIZE }, (_, index) =>
        row(`s${offset + index}`, `x${offset + index}`),
      )
    const twoPages = fakeClient({
      searchForInstances: async () => {
        throw badRequest()
      },
      searchForSeries: async (options) =>
        offsetOf(options) === 0 ? fullPage(0) : [row('last', 'y')],
    })

    const result = await searchStudiesContaining(twoPages, entry('ann'))
    expect(twoPages.searchForSeries).toHaveBeenCalledTimes(2)
    expect(twoPages.searchForSeries).toHaveBeenLastCalledWith({
      queryParams: {
        Modality: 'ANN',
        includefield: STUDY_FIELDS,
        limit: CONTAINS_PAGE_SIZE,
        offset: CONTAINS_PAGE_SIZE,
      },
    })
    expect(result.matches.size).toBe(CONTAINS_PAGE_SIZE + 1)
    expect(result.isPartial).toBe(false)

    const endless = fakeClient({
      searchForInstances: async () => {
        throw badRequest()
      },
      searchForSeries: async (options) => fullPage(offsetOf(options)),
    })
    const capped = await searchStudiesContaining(endless, entry('ann'))
    expect(endless.searchForSeries).toHaveBeenCalledTimes(CONTAINS_MAX_PAGES)
    expect(capped.isPartial).toBe(true)
  })

  it('keeps the study attributes of the first match', async () => {
    const client = fakeClient({
      searchForInstances: async () => [
        {
          ...row('s1', 'a', StorageClasses.PARAMETRIC_MAP),
          '00100020': { vr: 'LO', Value: ['patient-1'] },
          '00080020': { vr: 'DA', Value: ['20240102'] },
        } as unknown as QidoRow,
      ],
    })

    const result = await searchStudiesContaining(client, entry('pmap'))

    expect(result.matches.get('s1')?.study).toMatchObject({
      StudyInstanceUID: 's1',
      PatientID: 'patient-1',
      StudyDate: '20240102',
    })
  })

  it('stops paging once the caller is no longer current', async () => {
    const client = fakeClient({
      searchForInstances: async () => {
        throw badRequest()
      },
      searchForSeries: async () =>
        Array.from({ length: CONTAINS_PAGE_SIZE }, (_, index) =>
          row(`s${index}`, `x${index}`),
        ),
    })

    await searchStudiesContaining(client, entry('ann'), {
      isCurrent: () => false,
    })
    expect(client.searchForSeries).toHaveBeenCalledTimes(1)
  })
})

describe('confirmStudyContains', () => {
  const instanceOf = (sopClassUid: string) => async () => [
    row('s1', 'a', sopClassUid),
  ]

  it('matches when a series holds the SOP class', async () => {
    const client = fakeClient({
      searchForInstances: instanceOf(StorageClasses.PARAMETRIC_MAP),
    })

    await expect(
      confirmStudyContains(client, entry('pmap'), 's1', ['a']),
    ).resolves.toBe('match')
    expect(client.searchForInstances).toHaveBeenCalledWith({
      studyInstanceUID: 's1',
      seriesInstanceUID: 'a',
      queryParams: { limit: 1, includefield: '00080016' },
    })
  })

  it('checks each series until one matches', async () => {
    const client = fakeClient({
      searchForInstances: async (options) => [
        row(
          's1',
          String(options.seriesInstanceUID),
          options.seriesInstanceUID === 'b'
            ? StorageClasses.COMPREHENSIVE_3D_SR
            : StorageClasses.COMPREHENSIVE_SR,
        ),
      ],
    })

    await expect(
      confirmStudyContains(client, entry('sr3d'), 's1', ['a', 'b', 'c']),
    ).resolves.toBe('match')
    expect(client.searchForInstances).toHaveBeenCalledTimes(2)
  })

  it('reports a mismatch when no series holds the SOP class', async () => {
    const client = fakeClient({
      searchForInstances: instanceOf('1.2.840.10008.5.1.4.1.1.2'),
    })

    await expect(
      confirmStudyContains(client, entry('pmap'), 's1', ['a']),
    ).resolves.toBe('mismatch')
  })

  it('reports unknown when a lookup failed', async () => {
    const client = fakeClient({
      searchForInstances: async () => {
        throw new Error('timeout')
      },
    })

    await expect(
      confirmStudyContains(client, entry('pmap'), 's1', ['a']),
    ).resolves.toBe('unknown')
  })
})

describe('fetchSlideStudy', () => {
  it('returns the slide microscopy study row', async () => {
    const searchForStudies = vi.fn(async () => [
      {
        '0020000D': { vr: 'UI', Value: ['s1'] },
        '00201206': { vr: 'IS', Value: [3] },
      } as unknown as dwc.api.Study,
    ])

    const study = await fetchSlideStudy({ searchForStudies }, 's1')

    expect(searchForStudies).toHaveBeenCalledWith({
      queryParams: expect.objectContaining({
        StudyInstanceUID: 's1',
        ModalitiesInStudy: 'SM',
      }),
    })
    expect(study?.StudyInstanceUID).toBe('s1')
  })

  it('lists SM when the server omits ModalitiesInStudy', async () => {
    const study = await fetchSlideStudy(
      {
        searchForStudies: async () => [
          {
            '0020000D': { vr: 'UI', Value: ['s1'] },
          } as unknown as dwc.api.Study,
        ],
      },
      's1',
    )
    expect(study?.ModalitiesInStudy).toEqual(['SM'])
  })

  it('returns null for a study without slides', async () => {
    await expect(
      fetchSlideStudy({ searchForStudies: async () => [] }, 's1'),
    ).resolves.toBeNull()
  })
})

describe('withEntryModality', () => {
  const base = { StudyInstanceUID: 's1' } as dmv.metadata.Study

  it('adds the entry modality to the listed ones', () => {
    expect(
      withEntryModality({ ...base, ModalitiesInStudy: ['SM'] }, entry('pmap'))
        .ModalitiesInStudy,
    ).toEqual(['OT', 'SM'])
    expect(withEntryModality(base, entry('ann')).ModalitiesInStudy).toEqual([
      'ANN',
    ])
  })

  it('keeps the row when the modality is already listed', () => {
    const study = { ...base, ModalitiesInStudy: ['SM', 'ANN'] }
    expect(withEntryModality(study, entry('ann'))).toBe(study)
  })
})
