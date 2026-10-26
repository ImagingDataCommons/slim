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
    expect(buildDebugMessages([], [])).toEqual(EMPTY)
  })

  it('groups errors by their type', () => {
    const messages = buildDebugMessages(
      [
        {
          error: { message: 'Search failed', type: 'Communication' },
          source: 'DICOMweb',
        },
        {
          error: { message: 'Token expired', type: 'Authentication' },
          source: 'Auth',
        },
        {
          error: { message: 'Bad frame', type: 'EncodingDecoding' },
          source: 'Viewer',
        },
      ],
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

  it('drops errors with unknown or missing types', () => {
    const messages = buildDebugMessages(
      [
        { error: { message: 'a', type: 'Unknown' } },
        { error: { message: 'b', type: 'Warning' } },
        { error: { message: 'c' } },
        { error: { message: 'd', type: 42 } },
      ],
      [],
    )
    expect(messages).toEqual(EMPTY)
  })

  it('keeps errors without a source', () => {
    expect(
      buildDebugMessages(
        [{ error: { message: 'Hidden', type: 'Visualization' } }],
        [],
      ).Visualization,
    ).toEqual([{ message: 'Hidden', source: undefined }])
  })

  it('turns warnings into source-less messages', () => {
    expect(buildDebugMessages([], ['High memory']).Warning).toEqual([
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
