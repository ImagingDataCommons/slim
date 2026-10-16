import type { ServerSettings } from '../../AppConfig'
import { findConfigProblems } from '../configProblems'

const server = (overrides: Partial<ServerSettings>): ServerSettings => ({
  id: 'main',
  write: false,
  ...overrides,
})

describe('findConfigProblems', () => {
  it('accepts servers with a URL or a path', () => {
    expect(
      findConfigProblems(
        {
          servers: [
            server({ url: 'https://dicom.example/rs' }),
            server({ id: 'p', path: '/dicomweb' }),
          ],
        },
        'local',
      ),
    ).toEqual([])
  })

  it('reports a configuration file that did not load', () => {
    expect(findConfigProblems(undefined, 'custom')).toEqual([
      {
        message: 'The configuration file config/custom.js did not load.',
        hint: 'Check that REACT_APP_CONFIG names a file in public/config.',
      },
    ])
  })

  it('reports a missing server list', () => {
    const [problem] = findConfigProblems({ servers: [] }, 'custom')
    expect(problem.message).toBe('No DICOMweb server is configured.')
    expect(problem.hint).toContain('config/custom.js')
  })

  it('points committed configs at their environment variable', () => {
    expect(
      findConfigProblems({ servers: [server({ id: 'preview' })] }, 'preview'),
    ).toEqual([
      {
        message: 'The DICOMweb server "preview" has no URL.',
        hint: 'Set SLIM_PREVIEW_DICOMWEB_URL in .env or in the environment that starts Slim, then restart it.',
      },
    ])
  })

  it('points custom configs at the server entry and ignores blank values', () => {
    const problems = findConfigProblems(
      { servers: [server({ url: ' ', path: '' })] },
      'custom',
    )
    expect(problems).toHaveLength(1)
    expect(problems[0].hint).toBe(
      'Set "url" or "path" for this server in config/custom.js.',
    )
  })

  describe('on a Google Cloud store route', () => {
    const projectsPath =
      '/projects/p/locations/l/datasets/d/dicomStores/s/study/1.2.3'

    it('accepts a default server without a URL', () => {
      expect(
        findConfigProblems({ servers: [server({})] }, 'gcp', projectsPath),
      ).toEqual([])
    })

    it('still reports a storage-class server without a URL', () => {
      const problems = findConfigProblems(
        {
          servers: [
            server({}),
            server({
              id: 'ann',
              storageClasses: ['1.2.840.10008.5.1.4.1.1.91.1'],
            }),
          ],
        },
        'gcp',
        projectsPath,
      )
      expect(problems.map((problem) => problem.message)).toEqual([
        'The DICOMweb server "ann" has no URL.',
      ])
    })

    it('reports the default server on other routes', () => {
      expect(
        findConfigProblems({ servers: [server({})] }, 'gcp', '/studies/1.2.3'),
      ).toHaveLength(1)
    })
  })
})
