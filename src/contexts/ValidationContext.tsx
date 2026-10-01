/** skipcq: JS-C1003 */
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
import { logger } from '../utils/logger'
import {
  runValidationChecks,
  VALID_RESULT,
  type ValidatableAnnotationGroup,
  type ValidationResult,
} from '../utils/validation'

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

  const runValidations = useCallback(
    (options: {
      dialog?: boolean
      context: {
        annotationGroup?: dmv.annotation.AnnotationGroup
        slide?: Slide
      }
    }): ValidationResult => {
      const { dialog = false, context } = options
      const result = runValidationChecks({
        slide: context.slide,
        annotationGroup: context.annotationGroup as
          | ValidatableAnnotationGroup
          | undefined,
        slides,
      })
      if (!result.isValid && dialog) {
        setCurrentValidationResult(result)
        setIsDialogVisible(true)
      }
      return result
    },
    [slides],
  )

  const value = useMemo<ValidationContextType>(
    () => ({ runValidations }),
    [runValidations],
  )

  /** Only clear on unmount if a newer provider has not replaced the global */
  useEffect(() => {
    globalValidationContext = value
    return () => {
      if (globalValidationContext === value) {
        globalValidationContext = null
      }
    }
  }, [value])

  const handleDialogClose = useCallback((): void => {
    setIsDialogVisible(false)
    setCurrentValidationResult(null)
  }, [])

  const getDialogVariant = (
    type: ValidationResult['type'],
  ): 'default' | 'destructive' => (type === 'error' ? 'destructive' : 'default')

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
    logger.warn(
      'Validation context not available. Make sure ValidationProvider is mounted.',
    )
    return VALID_RESULT
  }
  return globalValidationContext.runValidations(options)
}
