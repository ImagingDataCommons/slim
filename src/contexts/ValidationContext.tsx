import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { Modal } from 'antd'
import { useSlides } from '../hooks/useSlides'
import DicomWebManager from '../DicomWebManager'

interface ValidationResult {
  isValid: boolean
  message?: string
  type: 'warning' | 'error' | 'info'
}

interface ValidationContextType {
  runValidations: (options: { dialog?: boolean, context: { annotationGroup?: any, slide?: any } }) => ValidationResult
}

const ValidationContext = createContext<ValidationContextType | undefined>(undefined)

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
  studyInstanceUID
}) => {
  const [isDialogVisible, setIsDialogVisible] = useState(false)
  const [currentValidationResult, setCurrentValidationResult] = useState<ValidationResult | null>(null)
  const { slides } = useSlides({ clients, studyInstanceUID })

  // Memoize slides to prevent unnecessary re-renders when slides array reference changes but content is the same
  const memoizedSlides = useMemo(() => {
    // Only update if slides actually changed (deep comparison would be expensive, so we use a simple approach)
    // For now, we'll use the slides directly but memoize the validation functions more efficiently
    return slides
  }, [slides])

  // Memoize the slides length and existence to avoid unnecessary validation function recreations
  const slidesInfo = useMemo(() => {
    const slidesLength = slides?.length
    let hasSlides = false
    if (slides != null && typeof slidesLength === 'number' && !Number.isNaN(slidesLength)) {
      hasSlides = slidesLength !== 0
    }
    return {
      hasSlides,
      slidesLength: slidesLength ?? 0
    }
  }, [slides])

  const showValidationDialog = useCallback((result: ValidationResult) => {
    setCurrentValidationResult(result)
    setIsDialogVisible(true)
  }, [])

  const validateMultiResolutionPyramid = useCallback((slide: any): ValidationResult => {
    if ((slide?.volumeImages?.length ?? 0) <= 1) {
      return {
        isValid: false,
        message: 'This slide is missing a multi-resolution pyramid. Display and performance may be degraded.',
        type: 'warning'
      }
    }
    return { isValid: true, type: 'info' }
  }, [])

  const validateAnnotationGroupAssociation = useCallback((annotationGroup: any): ValidationResult => {
    if (annotationGroup != null && slidesInfo.hasSlides) {
      const hasMatchingSlide = memoizedSlides.some((slide: any) => {
        const hasMatchingImage = slide.volumeImages?.some(
          (volumeImage: any) =>
            volumeImage.SOPInstanceUID != null &&
            volumeImage.SOPInstanceUID === annotationGroup.referencedSOPInstanceUID
        )
        return hasMatchingImage
      })

      if (!hasMatchingSlide) {
        return {
          isValid: false,
          message: 'The annotation group is not associated with any slide.',
          type: 'warning'
        }
      }
    }
    return { isValid: true, type: 'info' }
  }, [memoizedSlides, slidesInfo.hasSlides])

  const runValidations = useCallback((options: { dialog?: boolean, context: { annotationGroup?: any, slide?: any } }): ValidationResult => {
    const { dialog = false, context } = options
    const { annotationGroup, slide } = context

    if (slide != null) {
      const pyramidValidation = validateMultiResolutionPyramid(slide)
      if (!pyramidValidation.isValid) {
        if (dialog) {
          showValidationDialog(pyramidValidation)
        }
        return pyramidValidation
      }
    }

    const associationValidation = validateAnnotationGroupAssociation(annotationGroup)
    if (!associationValidation.isValid) {
      if (dialog) {
        showValidationDialog(associationValidation)
      }
      return associationValidation
    }

    return { isValid: true, type: 'info' }
  }, [validateMultiResolutionPyramid, validateAnnotationGroupAssociation, showValidationDialog])

  /**
   * Set global validation context for class components
   */
  useEffect(() => {
    const context: ValidationContextType = {
      runValidations
    }
    setGlobalValidationContext(context)
  }, [runValidations])

  const handleDialogClose = (): void => {
    setIsDialogVisible(false)
    setCurrentValidationResult(null)
  }

  const getModalType = (type: ValidationResult['type']): { error?: boolean, warning?: boolean, info?: boolean } => {
    switch (type) {
      case 'error':
        return { error: true }
      case 'warning':
        return { warning: true }
      case 'info':
        return { info: true }
      default:
        return { info: true }
    }
  }

  const value: ValidationContextType = {
    runValidations
  }

  return (
    <ValidationContext.Provider value={value}>
      {children}
      {(currentValidationResult != null) && (
        <Modal
          open={isDialogVisible}
          onCancel={handleDialogClose}
          onOk={handleDialogClose}
          title={`Validation ${currentValidationResult.type.charAt(0).toUpperCase() + currentValidationResult.type.slice(1)}`}
          okText='OK'
          cancelButtonProps={{ style: { display: 'none' } }}
          {...getModalType(currentValidationResult.type)}
        >
          <p>{currentValidationResult.message}</p>
        </Modal>
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

/**
 * Global validation function for class components
 */
let globalValidationContext: ValidationContextType | null = null

export const setGlobalValidationContext = (context: ValidationContextType): void => {
  globalValidationContext = context
}

export const runValidations = (options: { dialog?: boolean, context: { annotationGroup?: any, slide?: any } }): ValidationResult => {
  if (globalValidationContext == null) {
    console.warn('Validation context not available. Make sure ValidationProvider is mounted.')
    return { isValid: true, type: 'info' }
  }
  return globalValidationContext.runValidations(options)
}
