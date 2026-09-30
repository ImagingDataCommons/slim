// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'
import { useEffect, useState } from 'react'

import { useValidation } from '../contexts/ValidationContext'
import type { Slide } from '../data/slides'
import { cn } from '../lib/utils'
import { Icon } from './ui/icon'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

interface ValidationWarningProps {
  annotationGroup?: dmv.annotation.AnnotationGroup
  slide?: Slide
  size?: number
  className?: string
}

/** Inline warning icon shown when the slide or annotation group fails validation. */
const ValidationWarning: React.FC<ValidationWarningProps> = ({
  slide,
  annotationGroup,
  size = 16,
  className,
}) => {
  const [tooltipText, setTooltipText] = useState<string | undefined>(undefined)
  const { runValidations } = useValidation()

  useEffect(() => {
    const validationResult = runValidations({
      dialog: false,
      context: { annotationGroup, slide },
    })
    if (!validationResult.isValid) {
      setTooltipText(validationResult.message ?? 'Validation warning')
      if (process.env.NODE_ENV === 'development') {
        console.warn(validationResult.message)
      }
    } else {
      setTooltipText(undefined)
    }
  }, [slide, annotationGroup, runValidations])

  if (tooltipText === undefined) {
    return null
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={tooltipText}
          className={cn('inline-flex flex-none text-warning', className)}
        >
          <Icon name="warning" size={size} filled />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[280px]">{tooltipText}</TooltipContent>
    </Tooltip>
  )
}

export default ValidationWarning
