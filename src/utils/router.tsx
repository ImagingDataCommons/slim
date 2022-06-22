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

export function withRouter<T> (Component: React.ComponentType<T>): Function {
  function ComponentWithRouterProp (props: any): JSX.Element {
    const location = useLocation()
    const navigate = useNavigate()
    const params = useParams()
    return (
      <Component
        {...props}
        location={location}
        navigate={navigate}
        params={params}
      />
    )
  }
  return ComponentWithRouterProp
}
