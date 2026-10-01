/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'
import { useEffect, useMemo } from 'react'

import { useValidation } from '../contexts/ValidationContext'
import type { Slide } from '../data/slides'
import { cn } from '../lib/utils'
import { Icon } from './ui/icon'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

export interface ValidationWarningProps {
  annotationGroup?: dmv.annotation.AnnotationGroup
  slide?: Slide
  size?: number
  /**
   * Render a focusable trigger that also opens on click or tap. Disable it
   * when the warning sits inside another button; the message then reaches
   * assistive technology through the icon's accessible name only.
   */
  interactive?: boolean
  className?: string
}

/** Inline warning icon shown when the slide or annotation group fails validation. */
function ValidationWarning({
  slide,
  annotationGroup,
  size = 16,
  interactive = true,
  className,
}: ValidationWarningProps): React.ReactElement | null {
  const { runValidations } = useValidation()

  const message = useMemo((): string | undefined => {
    const validationResult = runValidations({
      dialog: false,
      context: { annotationGroup, slide },
    })
    return validationResult.isValid
      ? undefined
      : (validationResult.message ?? 'Validation warning')
  }, [slide, annotationGroup, runValidations])

  useEffect(() => {
    if (message !== undefined && import.meta.env.MODE === 'development') {
      console.warn(message)
    }
  }, [message])

  if (message === undefined) {
    return null
  }

  const icon = <Icon name="warning" size={size} filled />
  const iconClassName = cn('inline-flex flex-none text-warning', className)

  if (!interactive) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label={`Warning: ${message}`}
            className={iconClassName}
          >
            {icon}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[280px]">{message}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Warning: ${message}`}
              className={cn(
                iconClassName,
                'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
              )}
            >
              {icon}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent className="max-w-[280px]">{message}</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-auto max-w-[280px] px-3 py-2 text-[12px]">
        {message}
      </PopoverContent>
    </Popover>
  )
}

export default ValidationWarning
