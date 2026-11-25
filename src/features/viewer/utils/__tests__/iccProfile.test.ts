import { hasIccProfile } from '../iccProfile'

describe('hasIccProfile', () => {
  it('detects an inline profile', () => {
    expect(
      hasIccProfile({
        OpticalPathSequence: [{ ICCProfile: new Uint8Array([1]) }],
        bulkdataReferences: {},
      }),
    ).toBe(true)
  })

  it('detects a bulk data profile', () => {
    expect(
      hasIccProfile({
        OpticalPathSequence: [{}],
        bulkdataReferences: {
          OpticalPathSequence: [{ ICCProfile: { BulkDataURI: 'x' } }],
        },
      }),
    ).toBe(true)
  })

  it('reports a missing profile', () => {
    expect(
      hasIccProfile({ OpticalPathSequence: [{}], bulkdataReferences: {} }),
    ).toBe(false)
    expect(
      hasIccProfile({
        OpticalPathSequence: [{ ICCProfile: null }],
        bulkdataReferences: { OpticalPathSequence: [{}] },
      }),
    ).toBe(false)
    expect(
      hasIccProfile({
        OpticalPathSequence: [],
        bulkdataReferences: { OpticalPathSequence: 'invalid' },
      }),
    ).toBe(false)
  })
})
