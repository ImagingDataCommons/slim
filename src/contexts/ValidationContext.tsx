// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Button } from '../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  SlimDialogFooter,
} from '../components/ui/dialog'
import { Icon } from '../components/ui/icon'
import type DicomWebManager from '../DicomWebManager'
import type { Slide } from '../data/slides'
import { useSlides } from '../hooks/useSlides'
import { cn } from '../lib/utils'

interface ValidationResult {
  isValid: boolean
  message?: string
  type: 'warning' | 'error' | 'info'
}

interface ValidationContextType {
  runValidations: (options: {
    dialog?: boolean
    context: { annotationGroup?: dmv.annotation.AnnotationGroup; slide?: Slide }
  }) => ValidationResult
}

const ValidationContext = createContext<ValidationContextType | undefined>(
  undefined,
)

/**
 * Global validation function for class components
 */
let globalValidationContext: ValidationContextType | null = null

function setGlobalValidationContext(context: ValidationContextType): void {
  globalValidationContext = context
}

interface ValidationProviderProps {
  children: React.ReactNode
  clients?: { [key: string]: DicomWebManager }
  studyInstanceUID?: string
}

/**
 * ValidationProvider - Provides validation context for running validations and showing dialogs
 *
 * Usage:
 * 1. Wrap your component tree with ValidationProvider
 * 2. Use useValidation hook to access validation functions
 *
 * Example:
 * ```tsx
 * // Simple usage - just call runValidations with options
 * const { runValidations } = useValidation()
 *
 * const handleAction = () => {
 *   const result = runValidations({
 *     dialog: true,
 *     context: { annotationGroup, slide }
 *   })
 *   if (result.isValid) {
 *     // proceed with action
 *   }
 * }
 * ```
 */
export const ValidationProvider: React.FC<ValidationProviderProps> = ({
  children,
  clients,
  studyInstanceUID,
}) => {
  const [isDialogVisible, setIsDialogVisible] = useState(false)
  const [currentValidationResult, setCurrentValidationResult] =
    useState<ValidationResult | null>(null)
  const { slides } = useSlides({ clients, studyInstanceUID })

  /** Memoize slides to prevent unnecessary re-renders when slides array reference changes but content is the same */
  const memoizedSlides = useMemo(() => {
    /**
     * Only update if slides actually changed (deep comparison would be expensive, so we use a simple approach)
     * For now, we'll use the slides directly but memoize the validation functions more efficiently
     */
    return slides
  }, [slides])

  /** Memoize the slides length and existence to avoid unnecessary validation function recreations */
  const slidesInfo = useMemo(() => {
    const slidesLength = slides?.length
    let hasSlides = false
    if (
      slides !== null &&
      slides !== undefined &&
      typeof slidesLength === 'number' &&
      !Number.isNaN(slidesLength)
    ) {
      hasSlides = slidesLength !== 0
    }
    return {
      hasSlides,
      slidesLength: slidesLength ?? 0,
    }
  }, [slides])

  const showValidationDialog = useCallback((result: ValidationResult) => {
    setCurrentValidationResult(result)
    setIsDialogVisible(true)
  }, [])

  const validateMultiResolutionPyramid = useCallback(
    (slide: Slide): ValidationResult => {
      if ((slide?.volumeImages?.length ?? 0) <= 1) {
        return {
          isValid: false,
          message:
            'This slide is missing a multi-resolution pyramid. Display and performance may be degraded.',
          type: 'warning',
        }
      }
      return { isValid: true, type: 'info' }
    },
    [],
  )

  const validateAnnotationGroupAssociation = useCallback(
    (annotationGroup?: dmv.annotation.AnnotationGroup): ValidationResult => {
      if (
        annotationGroup !== null &&
        annotationGroup !== undefined &&
        slidesInfo.hasSlides
      ) {
        const checkSlideMatch = (slide: Slide): boolean => {
          const checkImageMatch = (
            volumeImage: dmv.metadata.VLWholeSlideMicroscopyImage,
          ): boolean =>
            volumeImage.SOPInstanceUID !== null &&
            volumeImage.SOPInstanceUID !== undefined &&
            volumeImage.SOPInstanceUID ===
              (
                annotationGroup as dmv.annotation.AnnotationGroup & {
                  referencedSOPInstanceUID: string
                }
              ).referencedSOPInstanceUID

          return slide.volumeImages?.some(checkImageMatch)
        }

        const hasMatchingSlide = memoizedSlides.some(checkSlideMatch)

        if (!hasMatchingSlide) {
          return {
            isValid: false,
            message: 'The annotation group is not associated with any slide.',
            type: 'warning',
          }
        }
      }
      return { isValid: true, type: 'info' }
    },
    [memoizedSlides, slidesInfo.hasSlides],
  )

  const runValidations = useCallback(
    (options: {
      dialog?: boolean
      context: {
        annotationGroup?: dmv.annotation.AnnotationGroup
        slide?: Slide
      }
    }): ValidationResult => {
      const { dialog = false, context } = options
      const { annotationGroup, slide } = context

      if (slide !== null && slide !== undefined) {
        const pyramidValidation = validateMultiResolutionPyramid(slide)
        if (!pyramidValidation.isValid) {
          if (dialog) {
            showValidationDialog(pyramidValidation)
          }
          return pyramidValidation
        }
      }

      const associationValidation =
        validateAnnotationGroupAssociation(annotationGroup)
      if (!associationValidation.isValid) {
        if (dialog) {
          showValidationDialog(associationValidation)
        }
        return associationValidation
      }

      return { isValid: true, type: 'info' }
    },
    [
      validateMultiResolutionPyramid,
      validateAnnotationGroupAssociation,
      showValidationDialog,
    ],
  )

  /**
   * Set global validation context for class components
   */
  useEffect(() => {
    const context: ValidationContextType = {
      runValidations,
    }
    setGlobalValidationContext(context)
  }, [runValidations])

  const handleDialogClose = useCallback((): void => {
    setIsDialogVisible(false)
    setCurrentValidationResult(null)
  }, [])

  const getDialogVariant = (
    type: ValidationResult['type'],
  ): 'default' | 'destructive' => {
    switch (type) {
      case 'error':
        return 'destructive'
      case 'warning':
      case 'info':
      default:
        return 'default'
    }
  }

  const value: ValidationContextType = {
    runValidations,
  }

  return (
    <ValidationContext.Provider value={value}>
      {children}
      {currentValidationResult !== null &&
        currentValidationResult !== undefined && (
          <Dialog open={isDialogVisible} onOpenChange={setIsDialogVisible}>
            <DialogContent className="max-w-[420px]">
              <div className="flex gap-3 px-5 pb-5 pt-[18px]">
                <span
                  className={cn(
                    'grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px]',
                    currentValidationResult.type === 'error'
                      ? 'bg-destructive-soft text-destructive-text'
                      : currentValidationResult.type === 'warning'
                        ? 'bg-warning-soft text-warning-text'
                        : 'bg-primary-soft text-primary',
                  )}
                >
                  <Icon
                    name={
                      currentValidationResult.type === 'info'
                        ? 'info'
                        : 'warning'
                    }
                    size={20}
                    filled
                  />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1.5">
                  <DialogTitle>
                    {`Validation ${currentValidationResult.type.charAt(0).toUpperCase() + currentValidationResult.type.slice(1)}`}
                  </DialogTitle>
                  <DialogDescription>
                    {currentValidationResult.message}
                  </DialogDescription>
                </div>
              </div>
              <SlimDialogFooter>
                <Button
                  variant={getDialogVariant(currentValidationResult.type)}
                  onClick={handleDialogClose}
                >
                  OK
                </Button>
              </SlimDialogFooter>
            </DialogContent>
          </Dialog>
        )}
    </ValidationContext.Provider>
  )
}

export const useValidation = (): ValidationContextType => {
  const context = useContext(ValidationContext)
  if (context === undefined) {
    throw new Error('useValidation must be used within a ValidationProvider')
  }
  return context
}

export const runValidations = (options: {
  dialog?: boolean
  context: { annotationGroup?: dmv.annotation.AnnotationGroup; slide?: Slide }
}): ValidationResult => {
  if (
    globalValidationContext === null ||
    globalValidationContext === undefined
  ) {
    console.warn(
      'Validation context not available. Make sure ValidationProvider is mounted.',
    )
    return { isValid: true, type: 'info' }
  }
  return globalValidationContext.runValidations(options)
}
