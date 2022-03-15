import React from 'react'
import { Button as Btn, Tooltip } from 'antd'

interface ButtonProps {
  icon: any
  tooltip?: string
  label?: string
  onClick?: (options: any) => void
  isSelected?: boolean
}

/**
 * React component for a button.
 */
class Button extends React.Component<ButtonProps, {}> {
  constructor (props: ButtonProps) {
    super(props)
    this.handleClick = this.handleClick.bind(this)
  }

  handleClick (event: React.SyntheticEvent): void {
    if (this.props.onClick !== undefined) {
      this.props.onClick(event)
    }
  }

  render (): React.ReactNode {
    const Icon = this.props.icon
    if (Icon === undefined) {
      return null
    }
    let button
    if (this.props.isSelected ?? false) {
      button = (
        <Btn
          onClick={this.handleClick}
          icon={<Icon />}
          type='primary'
        >
          {this.props.label}
        </Btn>
      )
    } else {
      button = (
        <Btn
          onClick={this.handleClick}
          icon={<Icon />}
          type='default'
        >
          {this.props.label}
        </Btn>
      )
    }

    if (this.props.tooltip !== undefined) {
      return (
        <Tooltip title={this.props.tooltip}>
          {button}
        </Tooltip>
      )
    } else {
      return button
    }
  }
}

export default Button
