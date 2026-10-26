import type { User } from '../../../auth'

export interface UserIdentity {
  /** Primary label: name, else email, else "Guest" */
  name: string
  /** Secondary trigger label, omitted when it would repeat `name` */
  email?: string
  /** Up to two initials, '' when there is nothing to derive them from */
  initials: string
  /** Menu header line: organization and sign-in state, else the email */
  subline?: string
}

/** Two-letter initials from a display name, e.g. "Elena Kovač" → "EK". */
export function getInitials(name: string | undefined): string {
  if (name === undefined || name.trim() === '') return ''
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value
}

export function getUserIdentity(
  user: User | undefined,
  organization?: string,
): UserIdentity {
  const userName = nonEmpty(user?.name)
  const userEmail = nonEmpty(user?.email)
  const name = userName ?? userEmail ?? 'Guest'
  const email = user === undefined ? 'Not signed in' : userEmail
  const sublineParts = [
    nonEmpty(organization),
    user === undefined ? 'Not signed in' : undefined,
  ].filter((part): part is string => part !== undefined)
  return {
    name,
    email: email !== name ? email : undefined,
    initials: getInitials(userName ?? userEmail),
    subline: sublineParts.length > 0 ? sublineParts.join(' · ') : email,
  }
}
