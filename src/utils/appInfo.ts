/** Implementation Class UID registered for Slim */
export const SLIM_IMPLEMENTATION_UID = '1.2.826.0.1.3680043.9.7433.1.5'

/** Application identity shown in the header and written into reports */
export interface AppInfo {
  name: string
  version: string
  homepage: string
  uid: string
  organization?: string
}

export function buildAppInfo({
  name,
  version,
  homepage,
  organization,
}: Omit<AppInfo, 'uid'>): AppInfo {
  return { name, version, homepage, uid: SLIM_IMPLEMENTATION_UID, organization }
}
