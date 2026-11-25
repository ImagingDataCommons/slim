export const DEFAULT_LOCAL_DICOMWEB_URL: string

export function resolveSlimEnv(
  root: string,
  env: Record<string, string | undefined>,
): {
  values: Record<string, string>
  configName: string
  missingKey: string | undefined
}

export function slimEnvScript(values: Record<string, string>): string
