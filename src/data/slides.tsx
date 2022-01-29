import * as dmv from 'dicom-microscopy-viewer'

enum ImageFlavors {
  VOLUME = 'VOLUME',
  LABEL = 'LABEL',
  OVERVIEW = 'OVERVIEW',
  THUMBNAIL = 'THUMBNAIL'
}

const hasImageFlavor = (
  image: dmv.metadata.VLWholeSlideMicroscopyImage,
  imageFlavor: ImageFlavors
): boolean => {
  return image.ImageType[2] === imageFlavor
}

interface SlideImageCollection {
  frameOfReferenceUID: string
  containerIdentifier: string
  volumeImages: dmv.metadata.VLWholeSlideMicroscopyImage[]
  labelImages: dmv.metadata.VLWholeSlideMicroscopyImage[]
  overviewImages: dmv.metadata.VLWholeSlideMicroscopyImage[]
}

interface SlideOptions {
  images: dmv.metadata.VLWholeSlideMicroscopyImage[]
  description?: string
}

/**
 * Slide - collection of images with the same Frame of Reference UID and
 * Container Identifier.
 */
class Slide {
  readonly description: string
  readonly frameOfReferenceUID: string
  readonly containerIdentifier: string
  readonly seriesInstanceUIDs: string[]
  readonly opticalPathIdentifiers: string[]
  readonly areVolumeImagesMonochrome: boolean
  readonly volumeImages: dmv.metadata.VLWholeSlideMicroscopyImage[]
  readonly labelImages: dmv.metadata.VLWholeSlideMicroscopyImage[]
  readonly overviewImages: dmv.metadata.VLWholeSlideMicroscopyImage[]

  /**
   * @param options
   * @param options.images - Metadata of images associated with the slide
   * @param options.description - Description of the slide
   */
  constructor (
    options: SlideOptions
  ) {
    if (options.images.length === 0) {
      throw new Error('Value of option "images" have been non-zero length.')
    }

    const seriesInstanceUIDs = new Set([] as string[])
    const opticalPathIdentifiers = new Set([] as string[])
    const containerIdentifiers = new Set([] as string[])
    const frameOfReferenceUIDs = new Set([] as string[])
    const volumeImages: dmv.metadata.VLWholeSlideMicroscopyImage[] = []
    const labelImages: dmv.metadata.VLWholeSlideMicroscopyImage[] = []
    const overviewImages: dmv.metadata.VLWholeSlideMicroscopyImage[] = []
    options.images.forEach((image) => {
      frameOfReferenceUIDs.add(image.FrameOfReferenceUID)
      containerIdentifiers.add(image.ContainerIdentifier)
      seriesInstanceUIDs.add(image.SeriesInstanceUID)
      opticalPathIdentifiers.add(
        image.OpticalPathSequence[0].OpticalPathIdentifier
      )
      if (hasImageFlavor(image, ImageFlavors.VOLUME)) {
        volumeImages.push(image)
      } else if (hasImageFlavor(image, ImageFlavors.THUMBNAIL)) {
        volumeImages.push(image)
      } else if (hasImageFlavor(image, ImageFlavors.LABEL)) {
        labelImages.push(image)
      } else if (hasImageFlavor(image, ImageFlavors.OVERVIEW)) {
        overviewImages.push(image)
      }
    })
    if (volumeImages.length === 0) {
      throw new Error(
        'At least one volume image must be provided for a slide.'
      )
    } else {
      const samplesPerPixel = new Set([] as number[])
      volumeImages.forEach((image) => {
        samplesPerPixel.add(image.SamplesPerPixel)
      })
      if (samplesPerPixel.size > 1) {
        throw new Error(
          'All volume images of a slide must have the same number of ' +
          'Samples per Pixel.'
        )
      }
    }
    this.volumeImages = volumeImages
    this.labelImages = labelImages
    this.overviewImages = overviewImages

    this.seriesInstanceUIDs = [...seriesInstanceUIDs]
    this.opticalPathIdentifiers = [...opticalPathIdentifiers]
    if (containerIdentifiers.size === 1) {
      this.containerIdentifier = [...containerIdentifiers][0]
    } else {
      throw new Error(
        'All images of a slide must have the same Container Identifier.'
      )
    }
    if (frameOfReferenceUIDs.size === 1) {
      this.frameOfReferenceUID = [...frameOfReferenceUIDs][0]
    } else {
      throw new Error(
        'All images of a slide must have the same Frame of Reference UID.'
      )
    }

    this.areVolumeImagesMonochrome = (
      this.volumeImages[0].SamplesPerPixel === 1 &&
      this.volumeImages[0].PhotometricInterpretation === 'MONOCHROME2'
    )

    this.description = (
      options.description !== undefined ? options.description : ''
    )
  }
}

/**
 * Create slides.
 *
 * @param imagesPerSeries - Image instances grouped per series
 * @param referenceSeriesInstanceUID - Unique identifier of the series that serves as a reference for the slide
 * @returns Slides
 */
const createSlides = (
  images: dmv.metadata.VLWholeSlideMicroscopyImage[][]
): Slide[] => {
  const slideMetadata: SlideImageCollection[] = []
  images.forEach((series) => {
    if (series.length > 0) {
      const volumeImages = series.filter((image) => {
        return (
          hasImageFlavor(image, ImageFlavors.VOLUME) ||
          hasImageFlavor(image, ImageFlavors.THUMBNAIL)
        )
      })
      const labelImages = series.filter((image) => {
        return hasImageFlavor(image, ImageFlavors.LABEL)
      })
      const overviewImages = series.filter((image) => {
        return hasImageFlavor(image, ImageFlavors.OVERVIEW)
      })

      if (volumeImages.length > 0) {
        const refImage = volumeImages[0]
        const filteredVolumeImages = volumeImages.filter((image) => {
          return refImage.SamplesPerPixel === image.SamplesPerPixel
        })
        const filteredOverviewImages = overviewImages.filter((image) => {
          return refImage.SamplesPerPixel === image.SamplesPerPixel
        })
        const slideMetadataIndex = slideMetadata.findIndex((slide) => {
          return _doesImageBelongToSlide(slide, refImage)
        })
        if (slideMetadataIndex === -1) {
          const slideMetadataItem: SlideImageCollection = {
            frameOfReferenceUID: refImage.FrameOfReferenceUID,
            containerIdentifier: refImage.ContainerIdentifier,
            volumeImages: filteredVolumeImages,
            labelImages: labelImages,
            overviewImages: filteredOverviewImages
          }
          slideMetadata.push(slideMetadataItem)
        } else {
          const slideMetadataItem = slideMetadata[slideMetadataIndex]
          slideMetadataItem.volumeImages.push(...filteredVolumeImages)
          slideMetadataItem.labelImages.push(...labelImages)
          slideMetadataItem.overviewImages.push(...filteredOverviewImages)
        }
      }
    }
  })

  const slides: Slide[] = slideMetadata.map((item) => {
    return new Slide({
      images: [
        ...item.volumeImages,
        ...item.labelImages,
        ...item.overviewImages
      ]
    })
  })

  return slides
}

/**
 * Check if instance belongs to the slide.
 *
 * Compares values of Frame of Reference UID and Container Identifier attributes.
 *
 * @param slide - Slide metadata object
 * @param image - Metadata of VOLUME, LABEL or OVERVIEW image instance
 */
function _doesImageBelongToSlide (
  slide: SlideImageCollection,
  image: dmv.metadata.VLWholeSlideMicroscopyImage
): boolean {
  if (
    slide.frameOfReferenceUID === image.FrameOfReferenceUID &&
    slide.containerIdentifier === image.ContainerIdentifier
  ) {
    return true
  }
  return false
}

export { Slide, createSlides }
