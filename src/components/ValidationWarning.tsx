import React, { useState, useEffect } from 'react'
import { FaExclamationTriangle } from 'react-icons/fa'
import { Tooltip } from 'antd'
import { useValidation } from '../contexts/ValidationContext'
import { Slide } from '../data/slides'
// skipcq: JS-C1003
import * as dmv from 'dicom-microscopy-viewer'

interface ValidationWarningProps {
  annotationGroup?: dmv.annotation.AnnotationGroup
  onEvent?: () => void
  slide?: Slide
  iconColor?: string
  iconSize?: string
  style?: React.CSSProperties
  position?: {
    top?: string
    right?: string
  }
}

const ValidationWarning: React.FC<ValidationWarningProps> = ({
  slide,
  annotationGroup,
  iconColor = '#e69500',
  iconSize = '1.3em',
  position = { top: '4px', right: '4px' },
  style
}) => {
  const [show, setShow] = useState(false)
  const [tooltipText, setTooltipText] = useState<string | undefined>(undefined)

  const { runValidations } = useValidation()

  useEffect(() => {
    const validationResult = runValidations({
      dialog: false,
      context: { annotationGroup, slide }
    })
    if (!validationResult.isValid) {
      setShow(true)
      setTooltipText(validationResult.message)
      console.warn(validationResult.message)
    } else {
      setShow(false)
      setTooltipText(undefined)
    }
  }, [slide, annotationGroup, runValidations])

  if (!show) {
    return null
  }

  return (
    <Tooltip title={tooltipText}>
      <div style={{
        ...style,
        position: 'absolute',
        top: position.top,
        right: position.right,
        zIndex: 2,
        pointerEvents: 'auto'
      }}
      >
        <FaExclamationTriangle style={{
          color: iconColor,
          fontSize: iconSize,
          textShadow: '0 2px 6px rgba(0,0,0,0.25), 0 0px 2px #fff'
        }}
        />
      </div>
    </Tooltip>
  )
}

export default ValidationWarning
