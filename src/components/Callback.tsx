import React from 'react'
import {
  Redirect,
  RouteComponentProps,
  withRouter
} from 'react-router-dom'


interface CallbackProps extends RouteComponentProps {}

class Callback extends React.Component<CallbackProps> {
  render (): React.ReactNode {
    return (
      <div>
        Redirecting...
        <Redirect to='/' />
      </div>
    )
  }
}

export default withRouter(Callback)
