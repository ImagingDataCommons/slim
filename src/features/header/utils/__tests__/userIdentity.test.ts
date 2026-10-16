import { getInitials, getUserIdentity } from '../userIdentity'

describe('getInitials', () => {
  it('returns an empty string for missing names', () => {
    expect(getInitials(undefined)).toBe('')
    expect(getInitials('   ')).toBe('')
  })

  it('uses the first letter of a single word', () => {
    expect(getInitials('elena')).toBe('E')
    expect(getInitials('elena@example.org')).toBe('E')
  })

  it('uses the first and last words', () => {
    expect(getInitials('Elena Kovač')).toBe('EK')
    expect(getInitials('  maria  de la  cruz ')).toBe('MC')
  })
})

describe('getUserIdentity', () => {
  it('describes a guest', () => {
    expect(getUserIdentity(undefined)).toEqual({
      name: 'Guest',
      email: 'Not signed in',
      initials: '',
      subline: 'Not signed in',
    })
  })

  it('adds the organization for a guest', () => {
    expect(getUserIdentity(undefined, 'IDC').subline).toBe(
      'IDC · Not signed in',
    )
  })

  it('describes a signed-in user with name and email', () => {
    expect(
      getUserIdentity({ name: 'Elena Kovač', email: 'elena@example.org' }),
    ).toEqual({
      name: 'Elena Kovač',
      email: 'elena@example.org',
      initials: 'EK',
      subline: 'elena@example.org',
    })
  })

  it('prefers the organization for the menu subline', () => {
    expect(
      getUserIdentity({ name: 'Elena', email: 'elena@example.org' }, 'IDC')
        .subline,
    ).toBe('IDC')
  })

  it('falls back to the email as name without repeating it', () => {
    expect(
      getUserIdentity({ name: undefined, email: 'elena@example.org' }),
    ).toEqual({
      name: 'elena@example.org',
      email: undefined,
      initials: 'E',
      subline: 'elena@example.org',
    })
  })

  it('treats blank names and organizations as missing', () => {
    const identity = getUserIdentity(
      { name: ' ', email: 'elena@example.org' },
      '',
    )
    expect(identity.name).toBe('elena@example.org')
    expect(identity.subline).toBe('elena@example.org')
  })
})
