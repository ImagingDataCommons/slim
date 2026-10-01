import type AppConfig from '../AppConfig'
import { isProjectsPath } from '../utils/routes'

export interface ConfigProblem {
  message: string
  /** What the person deploying Slim should change */
  hint: string
}

/** Variables the committed configs read their DICOMweb URL from */
const ENV_URL_KEY_BY_CONFIG: ReadonlyMap<string, string> = new Map([
  ['local', 'SLIM_LOCAL_DICOMWEB_URL'],
  ['demo', 'SLIM_DEMO_DICOMWEB_URL'],
  ['preview', 'SLIM_PREVIEW_DICOMWEB_URL'],
])

const isBlank = (value: string | undefined): boolean =>
  value === undefined || value.trim() === ''

/**
 * Problems that keep Slim from starting, phrased for the person deploying it.
 * `config` is whatever `config/<configName>.js` assigned to `window.config`,
 * so it is checked defensively. On `/projects/.../dicomStores/...` routes the
 * default server (no `storageClasses`) gets its URL from the route, so it
 * may leave `url` and `path` empty.
 */
export function findConfigProblems(
  config: Pick<AppConfig, 'servers'> | undefined,
  configName: string,
  pathname: string = '',
): ConfigProblem[] {
  const file = `config/${configName}.js`
  if (config === undefined) {
    return [
      {
        message: `The configuration file ${file} did not load.`,
        hint: 'Check that REACT_APP_CONFIG names a file in public/config.',
      },
    ]
  }
  if (!Array.isArray(config.servers) || config.servers.length === 0) {
    return [
      {
        message: 'No DICOMweb server is configured.',
        hint: `Add at least one entry to "servers" in ${file}.`,
      },
    ]
  }
  const envKey = ENV_URL_KEY_BY_CONFIG.get(configName)
  const isUrlFromRoute = isProjectsPath(pathname)
  return config.servers
    .filter((server) => isBlank(server.url) && isBlank(server.path))
    .filter((server) => !(isUrlFromRoute && server.storageClasses == null))
    .map((server) => ({
      message: `The DICOMweb server "${server.id}" has no URL.`,
      hint:
        envKey !== undefined
          ? `Set ${envKey} in .env or in the environment that starts Slim, then restart it.`
          : `Set "url" or "path" for this server in ${file}.`,
    }))
}
