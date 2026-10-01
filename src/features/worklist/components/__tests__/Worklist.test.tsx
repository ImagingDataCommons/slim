import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
/** skipcq: JS-C1003 */
import type * as dwc from 'dicomweb-client'
import type React from 'react'
import { BrowserRouter, MemoryRouter } from 'react-router'

import DicomWebManager from '../../../../DicomWebManager'
import { StorageClasses } from '../../../../data/uids'
import { Worklist } from '../Worklist'

afterAll(() => {
  vi.restoreAllMocks()
})

afterEach(cleanup)

describe('Worklist', () => {
  const serverSettings = {
    id: 'mock',
    path: '/dicomweb',
    write: false,
  }
  const manager = new DicomWebManager({
    baseUri: 'http://mockserver.org',
    settings: [serverSettings],
  })
  const clientMapping = {
    '1.2.840.10008.5.1.4.1.1.77.1.6': manager,
  }

  const searchResults = [
    {
      '0020000D': { vr: 'UI', Value: ['1.2.3.1'] },
      '00200010': { vr: 'SH', Value: ['study1'] },
      '00080050': { vr: 'SH', Value: ['accession1'] },
      '00080020': { vr: 'DA', Value: ['20210101'] },
      '00080030': { vr: 'TM', Value: ['081025'] },
      '00100010': { vr: 'PN', Value: [{ Alphabetic: 'first^patient' }] },
      '00100020': { vr: 'LO', Value: ['patient1'] },
      '00100040': { vr: 'CS', Value: ['F'] },
      '00100030': { vr: 'DA' },
      '00201206': { vr: 'IS', Value: [1] },
      '00201208': { vr: 'IS', Value: [2] },
      '00080061': { vr: 'CS', Value: ['SM', 'SR'] },
    },
    {
      '0020000D': { vr: 'UI', Value: ['1.2.3.2'] },
      '00200010': { vr: 'SH', Value: ['study2'] },
      '00080050': { vr: 'SH', Value: ['accession2'] },
      '00080020': { vr: 'DA', Value: ['20210128'] },
      '00080030': { vr: 'TM', Value: ['040032'] },
      '00100010': { vr: 'PN', Value: [{ Alphabetic: 'second^patient' }] },
      '00100020': { vr: 'LO', Value: ['patient2'] },
      '00100040': { vr: 'CS', Value: ['M'] },
      '00100030': { vr: 'DA' },
      '00201206': { vr: 'IS', Value: [1] },
      '00201208': { vr: 'IS', Value: [1] },
      '00080061': { vr: 'CS', Value: ['SM'] },
    },
    {
      '0020000D': { vr: 'UI', Value: ['1.2.3.3'] },
      '00200010': { vr: 'SH', Value: ['study3'] },
      '00080050': { vr: 'SH', Value: ['accession3'] },
      '00080020': { vr: 'DA', Value: ['20210200'] },
      '00080030': { vr: 'TM', Value: ['120815'] },
      '00100010': { vr: 'PN', Value: [{ Alphabetic: 'second^patient' }] },
      '00100020': { vr: 'LO', Value: ['patient2'] },
      '00100040': { vr: 'CS', Value: ['M'] },
      '00100030': { vr: 'DA' },
      '00201206': { vr: 'IS', Value: [1] },
      '00201208': { vr: 'IS', Value: [2] },
      '00080061': { vr: 'CS', Value: ['CT'] },
    },
    {
      '0020000D': { vr: 'UI', Value: ['1.2.3.4'] },
      '00200010': { vr: 'SH', Value: ['study4'] },
      '00080050': { vr: 'SH', Value: ['accession4'] },
      '00080020': { vr: 'DA', Value: ['20210301'] },
      '00080030': { vr: 'TM', Value: ['100000'] },
      '00100010': { vr: 'PN', Value: [{ Alphabetic: 'fourth^patient' }] },
      '00100020': { vr: 'LO', Value: ['patient4'] },
      '00100040': { vr: 'CS', Value: ['F'] },
      '00100030': { vr: 'DA' },
      '00201206': { vr: 'IS', Value: [1] },
      '00201208': { vr: 'IS', Value: [1] },
    },
  ]

  const seriesForBackfillStudy: dwc.api.Series[] = [
    {
      '0020000E': { vr: 'UI', Value: ['1.2.4.1'] },
      '00200011': { vr: 'IS', Value: [1] },
      '00080060': { vr: 'CS', Value: ['OT'] },
      '00201209': { vr: 'IS', Value: [1] },
    },
    {
      '0020000E': { vr: 'UI', Value: ['1.2.4.2'] },
      '00200011': { vr: 'IS', Value: [2] },
      '00080060': { vr: 'CS', Value: ['SR'] },
      '00201209': { vr: 'IS', Value: [1] },
    },
  ]

  manager.searchForStudies = async (
    _options: dwc.api.SearchForStudiesOptions,
  ): Promise<dwc.api.Study[]> => {
    /** The last study omits ModalitiesInStudy (0008,0061) on purpose */
    return await Promise.resolve(searchResults as dwc.api.Study[])
  }

  manager.searchForSeries = async (): Promise<dwc.api.Series[]> => {
    return await Promise.resolve(seriesForBackfillStudy)
  }

  const renderWithRouter = (ui: React.ReactElement) =>
    render(<BrowserRouter>{ui}</BrowserRouter>)

  it('should populate one row for each available study', async () => {
    const { queryAllByRole } = renderWithRouter(
      <Worklist clients={clientMapping} />,
    )

    await waitFor(() => {
      const rows = queryAllByRole('row')
      /** Table has 1 header row + one body row per study; searchResults has 4 studies */
      expect(rows.length).toBe(5)
    })
  })

  it('links each patient name to its study', async () => {
    const { findAllByRole } = renderWithRouter(
      <Worklist clients={clientMapping} />,
    )
    const links = await findAllByRole('link', { name: /patient/ })
    expect(links).toHaveLength(4)
    expect(links[0].getAttribute('href')).toMatch(/\/studies\/1\.2\.3\./)
  })

  it('synthesizes ModalitiesInStudy from series when study omits (0008,0061)', async () => {
    const { findByText, getAllByText } = renderWithRouter(
      <Worklist clients={clientMapping} />,
    )

    /** The backfilled study shows OT and SR badges; study 1 already lists SR */
    expect(await findByText('OT', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(getAllByText('SR')).toHaveLength(2)
  })

  describe('"Contains" filter', () => {
    const uidRow = (study: string, series: string, sopClass?: string) => ({
      '0020000D': { vr: 'UI', Value: [study] },
      '0020000E': { vr: 'UI', Value: [series] },
      ...(sopClass === undefined
        ? {}
        : { '00080016': { vr: 'UI', Value: [sopClass] } }),
    })

    /** A slide study that is not part of the loaded worklist */
    const unlistedStudy = {
      '0020000D': { vr: 'UI', Value: ['9.9.9'] },
      '00100020': { vr: 'LO', Value: ['unlisted-patient'] },
      '00100010': { vr: 'PN', Value: [{ Alphabetic: 'unlisted^patient' }] },
      '00080061': { vr: 'CS', Value: ['SM', 'ANN'] },
      '00201206': { vr: 'IS', Value: [5] },
    }

    function createManager(): DicomWebManager {
      const filterManager = new DicomWebManager({
        baseUri: 'http://mockserver.org',
        settings: [serverSettings],
      })
      filterManager.searchForStudies = async (options) => {
        const uid = (
          options.queryParams as { StudyInstanceUID?: string } | undefined
        )?.StudyInstanceUID
        if (uid === undefined) return searchResults as dwc.api.Study[]
        return (uid === '9.9.9' ? [unlistedStudy] : []) as dwc.api.Study[]
      }
      filterManager.searchForSeries = async () => []
      return filterManager
    }

    const renderAt = (url: string, filterManager: DicomWebManager) =>
      render(
        <MemoryRouter initialEntries={[url]}>
          <Worklist
            clients={{
              [StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]: filterManager,
            }}
          />
        </MemoryRouter>,
      )

    it('shows only studies with the entry from the URL and clears it', async () => {
      const filterManager = createManager()
      filterManager.searchForInstances = vi.fn(async () => [
        uidRow(
          '1.2.3.1',
          'ann1',
          StorageClasses.MICROSCOPY_BULK_SIMPLE_ANNOTATION,
        ),
      ]) as unknown as DicomWebManager['searchForInstances']

      renderAt('/?contains=ann', filterManager)

      expect(
        await screen.findByText('1 study with Bulk annotations'),
      ).toBeInTheDocument()
      expect(screen.getAllByRole('link', { name: /patient/ })).toHaveLength(1)

      fireEvent.click(
        screen.getByRole('button', { name: 'Clear Bulk annotations filter' }),
      )
      await waitFor(() => {
        expect(screen.getAllByRole('link', { name: /patient/ })).toHaveLength(4)
      })
      expect(
        screen.getByText('4 slide microscopy studies on this server'),
      ).toBeInTheDocument()
    })

    it('confirms modality matches and drops studies of another SOP class', async () => {
      const filterManager = createManager()
      filterManager.searchForInstances = vi.fn(
        async (options: dwc.api.SearchForInstancesOptions) => {
          if (options.seriesInstanceUID === undefined) {
            throw Object.assign(new Error('400'), { status: 400 })
          }
          return [
            uidRow(
              String(options.studyInstanceUID),
              options.seriesInstanceUID,
              options.seriesInstanceUID === 'pm1'
                ? StorageClasses.PARAMETRIC_MAP
                : '1.2.840.10008.5.1.4.1.1.2',
            ),
          ]
        },
      ) as unknown as DicomWebManager['searchForInstances']
      filterManager.searchForSeries = vi.fn(
        async (options: dwc.api.SearchForSeriesOptions) =>
          (options.queryParams as { Modality?: string } | undefined)
            ?.Modality === 'OT'
            ? [uidRow('1.2.3.1', 'pm1'), uidRow('1.2.3.2', 'ct1')]
            : [],
      ) as unknown as DicomWebManager['searchForSeries']

      renderAt('/?contains=pmap', filterManager)

      expect(
        await screen.findByText('1 study with Parametric map'),
      ).toBeInTheDocument()
      const links = screen.getAllByRole('link', { name: /patient/ })
      expect(links).toHaveLength(1)
      expect(links[0].getAttribute('href')).toContain('1.2.3.1')
    })

    it('offers a retry when the search fails', async () => {
      const filterManager = createManager()
      const searchForInstances = vi
        .fn()
        .mockRejectedValueOnce(
          Object.assign(new Error('down'), { status: 503 }),
        )
        .mockResolvedValue([
          uidRow(
            '1.2.3.4',
            'ann4',
            StorageClasses.MICROSCOPY_BULK_SIMPLE_ANNOTATION,
          ),
        ])
      filterManager.searchForInstances =
        searchForInstances as unknown as DicomWebManager['searchForInstances']
      vi.spyOn(console, 'error').mockImplementation(() => {})

      renderAt('/?contains=ann', filterManager)

      fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
      expect(
        await screen.findByText('1 study with Bulk annotations'),
      ).toBeInTheDocument()
    })

    it('fetches matches outside the loaded worklist and drops those without slides', async () => {
      const filterManager = createManager()
      const ann = StorageClasses.MICROSCOPY_BULK_SIMPLE_ANNOTATION
      filterManager.searchForInstances = vi.fn(async () => [
        uidRow('1.2.3.1', 'ann1', ann),
        {
          ...uidRow('9.9.9', 'ann9', ann),
          '00100020': unlistedStudy['00100020'],
        },
        uidRow('8.8.8', 'ann8', ann),
      ]) as unknown as DicomWebManager['searchForInstances']

      renderAt('/?contains=ann', filterManager)

      expect(
        await screen.findByText('2 studies with Bulk annotations'),
      ).toBeInTheDocument()
      expect(
        await screen.findByRole('link', { name: /unlisted/i }),
      ).toBeInTheDocument()
      expect(screen.getAllByRole('link', { name: /patient/ })).toHaveLength(2)
    })
  })
})
