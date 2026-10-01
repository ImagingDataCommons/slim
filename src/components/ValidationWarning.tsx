// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'
import { useEffect, useMemo } from 'react'

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
  const { runValidations } = useValidation()

  const tooltipText = useMemo((): string | undefined => {
    const validationResult = runValidations({
      dialog: false,
      context: { annotationGroup, slide },
    })
    return validationResult.isValid
      ? undefined
      : (validationResult.message ?? 'Validation warning')
  }, [slide, annotationGroup, runValidations])

  useEffect(() => {
    if (tooltipText !== undefined && process.env.NODE_ENV === 'development') {
      console.warn(tooltipText)
    }
  }, [tooltipText])

  if (tooltipText === undefined) {
    return null
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={`Warning: ${tooltipText}`}
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
