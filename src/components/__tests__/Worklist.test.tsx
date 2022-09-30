import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { cleanup, render } from '@testing-library/react'
import * as dwc from 'dicomweb-client'

import DicomWebManager from '../../DicomWebManager'
import Worklist from '../Worklist'

beforeAll(() => {})

afterAll(() => {
  jest.restoreAllMocks()
})

afterEach(cleanup)

describe('Worklist', () => {
  const serverSettings = {
    id: 'mock',
    path: '/dicomweb',
    write: false
  }
  const manager = new DicomWebManager({
    baseUri: 'http://mockserver.org',
    settings: [serverSettings]
  })
  const clientMapping = {
    '1.2.840.10008.5.1.4.1.1.77.1.6': manager
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
      '00080061': { vr: 'CS', Value: ['SM', 'SR'] }
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
      '00080061': { vr: 'CS', Value: ['SM'] }
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
      '00080061': { vr: 'CS', Value: ['CT'] }
    }
  ]

  manager.searchForStudies = async (
    options: dwc.api.SearchForStudiesOptions
  ): Promise<dwc.api.Study[]> => {
    return await Promise.resolve(searchResults)
  }

  it('should populate one row for each available study', () => {
    const { queryAllByRole } = render(
      <BrowserRouter>
        <Worklist clients={clientMapping} />
      </BrowserRouter>
    )

    const rows = queryAllByRole('row')
    expect(rows).toHaveLength(2)
  })
})
