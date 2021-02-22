import React from 'react'
import classNames from 'classnames'
import { Button as Btn, Tooltip } from 'antd'

import { IconType } from 'react-icons'

interface ButtonProps {
  icon: IconType
  tooltip?: string
  label?: string
  onClick?: (options: any) => void
  isToggle?: boolean
  isSelected?: boolean
}

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
    const cssClasses = classNames({
      active: this.props.isSelected
    })

    const button = (
      <Btn
        className={cssClasses}
        onClick={this.handleClick}
        icon={<Icon />}
      >
        {this.props.label}
      </Btn>
    )

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
