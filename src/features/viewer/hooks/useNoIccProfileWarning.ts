import { useEffect, useState } from 'react'

import type { Slide } from '../../../data/slides'
import { publishToast } from '../services/toast'
import { hasIccProfile } from '../utils/iccProfile'

/** Warn once, for the slide shown first, when color images lack an ICC profile */
export function useNoIccProfileWarning(slide: Slide): void {
  const [initialSlide] = useState(slide)
  useEffect(() => {
    if (
      !initialSlide.areVolumeImagesMonochrome &&
      !hasIccProfile(initialSlide.volumeImages[0])
    ) {
      publishToast('No ICC Profile was found for color images', 'warning')
    }
  }, [initialSlide])
}
