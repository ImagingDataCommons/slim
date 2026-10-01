import {
  buildDebugMessages,
  type DebugMessages,
  formatDebugReport,
} from '../debugReport'

const EMPTY: DebugMessages = {
  Communication: [],
  EncodingDecoding: [],
  Visualization: [],
  Authentication: [],
  Warning: [],
}

describe('buildDebugMessages', () => {
  it('returns empty buckets without input', () => {
    expect(buildDebugMessages([], [], [])).toEqual(EMPTY)
  })

  it('groups errors by their parallel category', () => {
    const messages = buildDebugMessages(
      [
        { message: 'Search failed', source: 'DICOMweb' },
        { message: 'Token expired', source: 'Auth' },
        { message: 'Bad frame', source: 'Viewer' },
      ],
      ['Communication', 'Authentication', 'EncodingDecoding'],
      [],
    )
    expect(messages.Communication).toEqual([
      { message: 'Search failed', source: 'DICOMweb' },
    ])
    expect(messages.Authentication).toEqual([
      { message: 'Token expired', source: 'Auth' },
    ])
    expect(messages.EncodingDecoding).toEqual([
      { message: 'Bad frame', source: 'Viewer' },
    ])
    expect(messages.Visualization).toEqual([])
  })

  it('drops errors with unknown or missing categories', () => {
    const messages = buildDebugMessages(
      [{ message: 'a' }, { message: 'b' }, { message: 'c' }],
      ['Unknown', 'Warning'],
      [],
    )
    expect(messages).toEqual(EMPTY)
  })

  it('turns warnings into source-less messages', () => {
    expect(buildDebugMessages([], [], ['High memory']).Warning).toEqual([
      { message: 'High memory' },
    ])
  })
})

describe('formatDebugReport', () => {
  it('lists every category in order with numbered messages', () => {
    const report = formatDebugReport(
      {
        ...EMPTY,
        Communication: [
          { message: 'Search failed', source: 'DICOMweb' },
          { message: 'Retrieve failed' },
        ],
        Warning: [{ message: 'High memory' }],
      },
      new Date('2026-09-12T09:42:00.000Z'),
      'TestAgent/1.0',
    )
    expect(report).toBe(
      [
        '=== Slim Debug Report ===',
        'Generated: 2026-09-12T09:42:00.000Z',
        'User agent: TestAgent/1.0',
        '',
        '## Communication (2)',
        '  1. Search failed [DICOMweb]',
        '  2. Retrieve failed',
        '',
        '## Data encoding/decoding (0)',
        '',
        '## Visualization (0)',
        '',
        '## Authentication (0)',
        '',
        '## Warning (1)',
        '  1. High memory',
        '',
      ].join('\n'),
    )
  })
})
