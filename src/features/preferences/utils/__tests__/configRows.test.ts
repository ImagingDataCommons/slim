import {
  type ConfigRow,
  filterConfigRows,
  flattenConfig,
  formatConfigValue,
  isSecretKey,
  MASKED_VALUE,
  maskConfig,
  splitByQuery,
} from '../configRows'

describe('splitByQuery', () => {
  it('returns the whole text for an empty query', () => {
    expect(splitByQuery('servers', '  ')).toEqual([
      { text: 'servers', isMatch: false, start: 0 },
    ])
  })

  it('marks every case-insensitive occurrence with its offset', () => {
    expect(splitByQuery('Server url: server', 'SERVER')).toEqual([
      { text: 'Server', isMatch: true, start: 0 },
      { text: ' url: ', isMatch: false, start: 6 },
      { text: 'server', isMatch: true, start: 12 },
    ])
  })

  it('returns no matches when the query is absent', () => {
    expect(splitByQuery('mode', 'path')).toEqual([
      { text: 'mode', isMatch: false, start: 0 },
    ])
  })
})

describe('isSecretKey', () => {
  it.each([
    'secret',
    'clientSecret',
    'client_secret',
    'accessToken',
    'password',
    'passwd',
    'Authorization',
    'bearer',
    'credentials',
    'apiKey',
    'api_key',
    'api-key',
    'privateKey',
  ])('treats %s as secret', (key) => {
    expect(isSecretKey(key)).toBe(true)
  })

  it.each([
    'url',
    'clientId',
    'keyboard',
    'monkey',
    'storageClasses',
    'authority',
    'scope',
  ])('keeps %s visible', (key) => {
    expect(isSecretKey(key)).toBe(false)
  })
})

describe('maskConfig', () => {
  it('masks secret leaves and keeps other values', () => {
    expect(
      maskConfig({
        oidc: { clientId: 'slim', clientSecret: 's3cr3t', scope: 'openid' },
        servers: [{ url: 'https://example.org', apiKey: 'abc' }],
        enableServerSelection: true,
      }),
    ).toEqual({
      oidc: { clientId: 'slim', clientSecret: MASKED_VALUE, scope: 'openid' },
      servers: [{ url: 'https://example.org', apiKey: MASKED_VALUE }],
      enableServerSelection: true,
    })
  })

  it('masks every leaf under a secret-named group', () => {
    expect(
      maskConfig({
        credentials: {
          user: 'admin',
          nested: { pin: 1234 },
          list: [{ value: 'x' }],
        },
      }),
    ).toEqual({
      credentials: {
        user: MASKED_VALUE,
        nested: { pin: MASKED_VALUE },
        list: [{ value: MASKED_VALUE }],
      },
    })
  })

  it('masks primitive arrays under a secret key as one value', () => {
    expect(maskConfig({ tokens: ['a', 'b'] })).toEqual({
      tokens: MASKED_VALUE,
    })
  })

  it('leaves undefined secrets undefined and passes primitives through', () => {
    expect(maskConfig({ token: undefined })).toEqual({ token: undefined })
    expect(maskConfig('plain')).toBe('plain')
    expect(maskConfig(null)).toBeNull()
  })
})

describe('formatConfigValue', () => {
  it('formats strings, arrays, functions and primitives', () => {
    expect(formatConfigValue('a')).toBe('"a"')
    expect(formatConfigValue([1, 'b'])).toBe('[1, "b"]')
    expect(formatConfigValue(() => 1)).toBe('ƒ()')
    expect(formatConfigValue(false)).toBe('false')
    expect(formatConfigValue(null)).toBe('null')
  })
})

describe('flattenConfig', () => {
  const config = {
    path: '/',
    mode: 'dark',
    servers: [{ id: 'local', read: true, write: true }],
  }
  const defaults = {
    path: '/',
    mode: 'light',
    'servers[0].read': true,
    'servers[0].write': false,
  }

  it('emits groups before their leaves with depth and paths', () => {
    const rows = flattenConfig(config, defaults)
    expect(
      rows.map(({ path, key, depth, isGroup }) => ({
        path,
        key,
        depth,
        isGroup,
      })),
    ).toEqual([
      { path: 'path', key: 'path', depth: 0, isGroup: false },
      { path: 'mode', key: 'mode', depth: 0, isGroup: false },
      { path: 'servers', key: 'servers', depth: 0, isGroup: true },
      { path: 'servers[0]', key: '[0]', depth: 1, isGroup: true },
      { path: 'servers[0].id', key: 'id', depth: 2, isGroup: false },
      { path: 'servers[0].read', key: 'read', depth: 2, isGroup: false },
      { path: 'servers[0].write', key: 'write', depth: 2, isGroup: false },
    ])
  })

  it('flags leaves that differ from defaults or have none', () => {
    const changed = flattenConfig(config, defaults)
      .filter((row) => !row.isGroup && row.isChanged)
      .map((row) => row.path)
    expect(changed).toEqual(['mode', 'servers[0].id', 'servers[0].write'])
  })

  it('formats leaf values and keeps raw values', () => {
    const row = flattenConfig(config, defaults).find(
      (item) => item.path === 'mode',
    )
    expect(row?.value).toBe('"dark"')
    expect(row?.raw).toBe('dark')
  })

  it('treats primitive arrays as leaves', () => {
    const rows = flattenConfig({ storageClasses: ['1.2', '1.3'] }, {})
    expect(rows).toHaveLength(1)
    expect(rows[0].isGroup).toBe(false)
    expect(rows[0].value).toBe('["1.2", "1.3"]')
  })

  it('returns no rows for non-objects', () => {
    expect(flattenConfig(undefined, {})).toEqual([])
    expect(flattenConfig('x', {})).toEqual([])
  })
})

describe('filterConfigRows', () => {
  const rows: ConfigRow[] = flattenConfig(
    {
      mode: 'dark',
      oidc: { authority: 'https://idp.example.org', scope: 'openid' },
      servers: [{ url: 'https://dicom.example.org', read: true }],
    },
    { 'servers[0].read': true },
  )
  const paths = (list: ConfigRow[]): string[] => list.map((row) => row.path)

  it('returns all rows without a query or filter', () => {
    expect(filterConfigRows(rows, '  ', false)).toEqual(rows)
  })

  it('matches paths and values case-insensitively and keeps ancestors', () => {
    expect(paths(filterConfigRows(rows, 'DICOM.example', false))).toEqual([
      'servers',
      'servers[0]',
      'servers[0].url',
    ])
    expect(paths(filterConfigRows(rows, 'oidc.scope', false))).toEqual([
      'oidc',
      'oidc.scope',
    ])
  })

  it('keeps only changed leaves when requested', () => {
    expect(paths(filterConfigRows(rows, '', true))).not.toContain(
      'servers[0].read',
    )
    expect(paths(filterConfigRows(rows, 'read', true))).toEqual([])
  })
})
