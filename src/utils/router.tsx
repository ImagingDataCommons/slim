// React required at runtime for JSX (classic transform)
// biome-ignore lint/style/useImportType: see above
import React from 'react'
import {
  type Location,
  type NavigateFunction,
  type Params,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

export interface RouteComponentProps {
  location: Location
  navigate: NavigateFunction
  params: Params<string>
}

export function withRouter<T extends RouteComponentProps>(
  Component: React.ComponentType<T>,
): React.ComponentType<Omit<T, keyof RouteComponentProps>> {
  function ComponentWithRouterProp(
    props: Omit<T, keyof RouteComponentProps>,
  ): JSX.Element {
    const location = useLocation()
    const navigate = useNavigate()
    const params = useParams()
    const routerProps = {
      ...props,
      location,
      navigate,
      params,
    } as T
    return <Component {...routerProps} />
  }
  return ComponentWithRouterProp as React.ComponentType<
    Omit<T, keyof RouteComponentProps>
  >
}
