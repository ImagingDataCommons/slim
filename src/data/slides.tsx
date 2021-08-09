import * as dmv from 'dicom-microscopy-viewer'

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
  private _description?: string
  private _frameOfReferenceUID: string
  private _containerIdentifier: string
  private _seriesInstanceUIDs: string[]
  private _opticalPathIdentifiers: string[]
  private _isMultiplexed: boolean
  private _areImagesMonochrome: boolean
  private _volumeImages: dmv.metadata.VLWholeSlideMicroscopyImage[] = []
  private _labelImages: dmv.metadata.VLWholeSlideMicroscopyImage[] = []
  private _overviewImages: dmv.metadata.VLWholeSlideMicroscopyImage[] = []

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
    options.images.forEach((image) => {
      frameOfReferenceUIDs.add(image.FrameOfReferenceUID)
      containerIdentifiers.add(image.ContainerIdentifier)
      seriesInstanceUIDs.add(image.SeriesInstanceUID)
      opticalPathIdentifiers.add(
        image.OpticalPathSequence[0].OpticalPathIdentifier
      )
      if (image.ImageType[2] === 'VOLUME') {
        this._volumeImages.push(image)
      } else if (image.ImageType[2] === 'LABEL') {
        this._labelImages.push(image)
      } else if (image.ImageType[2] === 'OVERVIEW') {
        this._overviewImages.push(image)
      }
    })

    if (this._volumeImages.length === 0) {
        throw new Error(
          'At least one volume image must be provided for a slide.'
        )
    } else {
      const photometricInterpretations = new Set([] as string[])
      this._volumeImages.forEach((image) => {
        photometricInterpretations.add(image.PhotometricInterpretation)
      })
      if (photometricInterpretations.size > 1) {
        throw new Error(
          'All volume images of a slide must have the same ' +
          'Photometric Interpretation.'
        )
      }
    }

    this._seriesInstanceUIDs = [...seriesInstanceUIDs]
    this._opticalPathIdentifiers = [...opticalPathIdentifiers]
    if (containerIdentifiers.size === 1) {
      this._containerIdentifier = [...containerIdentifiers][0]
    } else {
      throw new Error(
        'All images of a slide must have the same Container Identifier.'
      )
    }
    if (frameOfReferenceUIDs.size === 1) {
      this._frameOfReferenceUID = [...frameOfReferenceUIDs][0]
    } else {
      throw new Error(
        'All images of a slide must have the same Frame of Reference UID.'
      )
    }

    this._areImagesMonochrome = (
      this._volumeImages[0].SamplesPerPixel === 1 &&
      this._volumeImages[0].PhotometricInterpretation === 'MONOCHROME2'
    )

    if (opticalPathIdentifiers.size > 1) {
      this._isMultiplexed = true
    } else {
      this._isMultiplexed = false
    }

    this._description = options.description
  }

  /**
   * Frame of Reference UID shared by all images of the slide.
   */
  get frameOfReferenceUID (): string {
    return this._frameOfReferenceUID
  }

  /**
   * Container Identifier shared by all images of the slide.
   */
  get containerIdentifier (): string {
    return this._containerIdentifier
  }

  /**
   * Whether volume images are monochrome.
   */
  get areVolumeImagesMonochrome (): boolean {
    return this._areImagesMonochrome
  }

  /**
   * Whether slide is multiplexed, i.e., has more than one monochrome sample.
   */
  get isMultiplexed (): boolean {
    return this._isMultiplexed
  }

  /**
   * Unique set of Series Instance UIDs of images of the slide.
   */
  get seriesInstanceUIDs (): string[] {
    return this._seriesInstanceUIDs
  }

  /**
   * Optical Path Identifiers of images of the slide.
   */
  get opticalPathIdentifiers (): string[] {
    return this._opticalPathIdentifiers
  }

  /**
   * Description of the slide.
   */
  get description (): string {
    return this._description !== undefined ?  this._description : ''
  }

  /**
   * Metadata of volume images.
   */
  get volumeImages (): dmv.metadata.VLWholeSlideMicroscopyImage[] {
    return this._volumeImages
  }

  /**
   * Metadata of label images.
   */
  get labelImages (): dmv.metadata.VLWholeSlideMicroscopyImage[] {
    return this._labelImages
  }

  /**
   * Metadata of overview images.
   */
  get overviewImages (): dmv.metadata.VLWholeSlideMicroscopyImage[] {
    return this._overviewImages
  }
}

/**
 * Create slides.
 *
 * @param imagesPerSeries - Image instances grouped per series
 * @param referenceSeriesInstanceUID - Unique identifier of the series that serves as a reference for the slide
 * @returns Slides
 */
function createSlides (
  images: dmv.metadata.VLWholeSlideMicroscopyImage[][]
): Slide[] {
  const slideMetadata: SlideImageCollection[] = []
  images.forEach((series) => {
    if (series.length > 0) {
      const volumeImages = series.filter((image) => {
        return image.ImageType[2] === 'VOLUME'
      })
      const labelImages = series.filter((image) => {
        return image.ImageType[2] === 'LABEL'
      })
      const overviewImages = series.filter((image) => {
        return image.ImageType[2] === 'OVERVIEW'
      })

      if (volumeImages.length > 0) {
        const refImage = volumeImages[0]
        const filteredVolumeImages = volumeImages.filter((image) => {
          return (
            refImage.SamplesPerPixel === image.SamplesPerPixel &&
            refImage.PhotometricInterpretation === image.PhotometricInterpretation
          )
        })
        const filteredOverviewImages = overviewImages.filter((image) => {
          return (
            refImage.SamplesPerPixel === image.SamplesPerPixel &&
            refImage.PhotometricInterpretation === image.PhotometricInterpretation
          )
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
    slide.containerIdentifier !== image.ContainerIdentifier
  ) {
    return true
  }
  return false
}

export { Slide, createSlides }
