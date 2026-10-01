import NotificationMiddleware from '../../services/NotificationMiddleware'
import {
  authorizationFromUser,
  clearAuthParamsFromUrl,
  createUser,
  readReturnUrl,
} from '../oidcUser'
import { makeProfile, makeUser } from '../testing/fakeUserManager'

describe('createUser', () => {
  let onError: jest.SpyInstance

  beforeEach(() => {
    onError = jest
      .spyOn(NotificationMiddleware, 'onError')
      .mockImplementation(jest.fn())
  })

  afterEach(() => {
    onError.mockRestore()
  })

  it('takes name and email from the profile', () => {
    expect(createUser(makeUser())).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    })
    expect(onError).not.toHaveBeenCalled()
  })

  it('reports a profile without name or email', () => {
    expect(
      createUser(makeUser({ profile: makeProfile({ email: undefined }) })),
    ).toEqual({ name: undefined, email: undefined })
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('reports a missing user', () => {
    expect(createUser(null)).toEqual({ name: undefined, email: undefined })
    expect(onError).toHaveBeenCalledTimes(1)
  })
})

describe('authorizationFromUser', () => {
  it('prefixes the token type', () => {
    expect(authorizationFromUser(makeUser({ accessToken: 'abc' }))).toBe(
      'Bearer abc',
    )
  })

  it('defaults to Bearer', () => {
    const user = makeUser({ accessToken: 'abc' })
    user.token_type = ''
    expect(authorizationFromUser(user)).toBe('Bearer abc')
  })
})

describe('readReturnUrl', () => {
  it.each([
    [{ returnUrl: '/studies/1?gcp=x' }, '/studies/1?gcp=x'],
    ['/studies/1', '/studies/1'],
    [{ returnUrl: 'https://evil.example.com/' }, undefined],
    [{ returnUrl: '//evil.example.com/' }, undefined],
    [{ returnUrl: '' }, undefined],
    [{ other: '/x' }, undefined],
    [undefined, undefined],
  ])('reads %p as %p', (state, expected) => {
    expect(readReturnUrl(makeUser({ state }))).toBe(expected)
  })
})

describe('clearAuthParamsFromUrl', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('removes authorize response parameters and the fragment', () => {
    window.history.replaceState(
      {},
      '',
      '/studies/1?code=c&state=s&session_state=x&gcp=keep#access_token=t',
    )
    clearAuthParamsFromUrl()
    expect(`${window.location.pathname}${window.location.search}`).toBe(
      '/studies/1?gcp=keep',
    )
    expect(window.location.hash).toBe('')
  })
})
