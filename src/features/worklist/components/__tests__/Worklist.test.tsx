import { cleanup, render, waitFor } from '@testing-library/react'
/** skipcq: JS-C1003 */
import type * as dwc from 'dicomweb-client'
import type React from 'react'
import { BrowserRouter } from 'react-router-dom'

import DicomWebManager from '../../../../DicomWebManager'
import { Worklist } from '../Worklist'

afterAll(() => {
  jest.restoreAllMocks()
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
    render(
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        {ui}
      </BrowserRouter>,
    )

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
})
