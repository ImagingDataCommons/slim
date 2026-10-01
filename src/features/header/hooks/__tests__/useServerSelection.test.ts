import { act, renderHook } from '@testing-library/react'

import { OIDC_CONFIG_STORAGE_KEY } from '../../../../auth/oidcConfig'
import { useServerSelection } from '../useServerSelection'

const VALID_OIDC =
  '{"authority":"https://idp.example.com","clientId":"slim","scope":"openid"}'

const renderSelection = () => {
  const onServerSelection = vi.fn()
  const view = renderHook(() => useServerSelection({ onServerSelection }))
  return { ...view, onServerSelection }
}

describe('useServerSelection', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('submits the default server without OIDC changes when untouched', () => {
    const { result, onServerSelection } = renderSelection()

    act(() => result.current.openDialog())
    act(() => result.current.submitSelection())

    expect(onServerSelection).toHaveBeenCalledWith({
      url: '',
      oidc: undefined,
    })
    expect(result.current.isDialogOpen).toBe(false)
  })

  it('submits a custom URL with a new OIDC config and caches it', () => {
    const { result, onServerSelection } = renderSelection()

    act(() => result.current.openDialog())
    act(() => {
      result.current.setMode('custom')
      result.current.setServerUrl('https://dicom.example.com/dicomweb/')
      result.current.setOidcConfigInput(VALID_OIDC)
    })
    act(() => result.current.submitSelection())

    expect(onServerSelection).toHaveBeenCalledTimes(1)
    const [params] = onServerSelection.mock.calls[0]
    expect(params.url).toBe('https://dicom.example.com/dicomweb')
    expect(params.oidc).toMatchObject({
      authority: 'https://idp.example.com',
      clientId: 'slim',
      scope: 'openid',
    })
    expect(window.localStorage.getItem(OIDC_CONFIG_STORAGE_KEY)).toBe(
      VALID_OIDC,
    )
  })

  it('blocks submission while the OIDC config is invalid', () => {
    const { result, onServerSelection } = renderSelection()

    act(() => result.current.openDialog())
    act(() => result.current.setOidcConfigInput('{ authority: "x" }'))

    expect(result.current.isOidcConfigValid).toBe(false)
    expect(result.current.isServerUrlValid).toBe(true)
    expect(result.current.isValid).toBe(false)

    act(() => result.current.submitSelection())

    expect(onServerSelection).not.toHaveBeenCalled()
    expect(result.current.isDialogOpen).toBe(true)
  })

  it('drops the cached OIDC config when the field is emptied', () => {
    window.localStorage.setItem(OIDC_CONFIG_STORAGE_KEY, VALID_OIDC)
    const { result, onServerSelection } = renderSelection()

    act(() => result.current.openDialog())
    expect(result.current.oidcConfigInput).toBe(VALID_OIDC)
    act(() => result.current.setOidcConfigInput(''))
    act(() => result.current.submitSelection())

    expect(onServerSelection).toHaveBeenCalledWith({ url: '', oidc: null })
    expect(window.localStorage.getItem(OIDC_CONFIG_STORAGE_KEY)).toBeNull()
  })

  it('restores the cached OIDC config on cancel', () => {
    window.localStorage.setItem(OIDC_CONFIG_STORAGE_KEY, VALID_OIDC)
    const { result, onServerSelection } = renderSelection()

    act(() => result.current.openDialog())
    act(() => result.current.setOidcConfigInput('edited'))
    act(() => result.current.cancelDialog())

    expect(result.current.oidcConfigInput).toBe(VALID_OIDC)
    expect(result.current.isDialogOpen).toBe(false)
    expect(onServerSelection).not.toHaveBeenCalled()
  })
})
