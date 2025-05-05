import React from 'react'
import {
  NavigateFunction,
  Params,
  useLocation,
  useNavigate,
  useParams,
  Location
} from 'react-router-dom'

export interface RouteComponentProps {
  location: Location
  navigate: NavigateFunction
  params: Params<string>
}

export function withRouter<T extends RouteComponentProps> (
  Component: React.ComponentType<T>
): React.ComponentType<Omit<T, keyof RouteComponentProps>> {
  function ComponentWithRouterProp (props: Omit<T, keyof RouteComponentProps>): JSX.Element {
    const location = useLocation()
    const navigate = useNavigate()
    const params = useParams()
    return (
      <Component
        {...props as T}
        location={location}
        navigate={navigate}
        params={params}
      />
    )
  }
  return ComponentWithRouterProp
}
