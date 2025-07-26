import React, { useState, useEffect } from 'react'
import { FaExclamationTriangle } from 'react-icons/fa'
import { Tooltip } from 'antd'
import { useSlides } from '../hooks/useSlides'

interface ValidationWarningProps {
  annotationGroup?: any
  slide?: any
  iconColor?: string
  iconSize?: string
  style?: React.CSSProperties
  position?: {
    top?: string
    right?: string
  }
}

const MessageEnum = {
  MISSING_MULTI_RESOLUTION_PYRAMID: 'This slide is missing a multi-resolution pyramid. Display and performance may be degraded.',
  NOT_ASSOCIATED_WITH_ANY_SLIDE: 'The annotation group is not associated with any slide.'
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

  const { slides } = useSlides()

  useEffect(() => {
    if (slide?.volumeImages?.length <= 1) {
      setShow(true)
      setTooltipText(MessageEnum.MISSING_MULTI_RESOLUTION_PYRAMID)
      console.warn(MessageEnum.MISSING_MULTI_RESOLUTION_PYRAMID)
    } else if (slides != null && slides.length > 0 && annotationGroup != null) {
      const hasMatchingSlide = slides.some((slide: any) =>
        slide.volumeImages?.some(
          (volumeImage: any) =>
            volumeImage.SOPInstanceUID != null &&
            volumeImage.SOPInstanceUID ===
            annotationGroup.referencedSOPInstanceUID
        )
      )
      if (!hasMatchingSlide) {
        setShow(true)
        setTooltipText(MessageEnum.NOT_ASSOCIATED_WITH_ANY_SLIDE)
        console.warn(MessageEnum.NOT_ASSOCIATED_WITH_ANY_SLIDE)
      } else {
        setShow(false)
        setTooltipText(undefined)
      }
    } else {
      setShow(false)
      setTooltipText(undefined)
    }
  }, [slide, annotationGroup, slides])

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
