/** @jest-environment node */
import { data } from 'dcmjs'

import {
  buildFileMetaInformation,
  EXPLICIT_VR_LITTLE_ENDIAN,
  encodeDicomDataset,
} from '../encodeDicomDataset'

const dataset = {
  SOPClassUID: '1.2.840.10008.5.1.4.1.1.88.34',
  SOPInstanceUID: '1.2.3.4',
  Modality: 'SR',
}

describe('buildFileMetaInformation', () => {
  it('describes the instance, transfer syntax and implementation', () => {
    const meta = buildFileMetaInformation(dataset, '9.8.7')
    expect(meta['00020002'].Value).toEqual([dataset.SOPClassUID])
    expect(meta['00020003'].Value).toEqual([dataset.SOPInstanceUID])
    expect(meta['00020010'].Value).toEqual([EXPLICIT_VR_LITTLE_ENDIAN])
    expect(meta['00020012'].Value).toEqual(['9.8.7'])
  })

  it('writes File Meta Information Version 00 01', () => {
    const [version] = buildFileMetaInformation(dataset, '9.8.7')['00020001']
      .Value
    expect(version).toBeInstanceOf(ArrayBuffer)
    if (version instanceof ArrayBuffer) {
      expect(Array.from(new Uint8Array(version))).toEqual([0, 1])
    }
  })
})

describe('encodeDicomDataset', () => {
  it('produces a Part 10 buffer that reads back', () => {
    const buffer = encodeDicomDataset(dataset, '9.8.7')
    const prefix = new TextDecoder().decode(new Uint8Array(buffer, 128, 4))
    expect(prefix).toBe('DICM')
    const read = data.DicomMessage.readFile(buffer)
    expect(read.dict).toHaveProperty('00080018.Value', ['1.2.3.4'])
    expect(read.dict).toHaveProperty('00080060.Value', ['SR'])
  })
})
