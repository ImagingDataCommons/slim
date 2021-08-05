import * as dmv from 'dicom-microscopy-viewer'

export interface InstancesMetadata {
  volumeMetadata: object[]
  labelMetadata: object[]
  overviewMetadata: object[]
}

export interface SlideMetadata {
  frameofReferenceUID: string
  containerIdentifier: string
  volumeMetadata: object[]
  labelMetadata: object[]
  overviewMetadata: object[]
}

export interface SlideOptions {
  frameofReferenceUID: string
  containerIdentifier: string
  areImagesMonochrome: boolean
  isMultiplexedSamples: boolean
  selectedSeriesInstanceUID: string
  seriesInstanceUIDs: string[]
  selectedOpticalPathIdentifier: string
  opticalPathIdentifiers: string[]
  description?: string
  volumeMetadata: object[]
  labelMetadata: object[]
  overviewMetadata: object[]
}

/**
 * Slide - handles grouping of instances.
 * A Slide is identified by two parameters:
 * frameofReferenceUID and the containerIdentifier.
 */
class Slide {
  slideOptions: SlideOptions

  /**
   * @param SlideOptions
   * @param SlideOptions.frameofReferenceUID - reference frame
   * @param SlideOptions.containerIdentifier - container identifier
   * @param SlideOptions.areImagesMonochrome - type of images
   * @param SlideOptions.isMultiplexedSamples - is multi channel datasets
   * @param SlideOptions.selectedSeriesInstanceUID - selected series connected to the slide
   * @param SlideOptions.seriesInstanceUIDs - array of series UIDs connected to the slide
   * @param SlideOptions.selectedOpticalPathIdentifier - selected optical path indentifier
   * @param SlideOptions.opticalPathIdentifiers - array of all optical path identifiers
   * @param SlideOptions.description - slide description, i.e.,
   *                                   Multiplexed-Samples, Monochrome Slide, RGB Slide
   * @param SlideOptions.volumeMetadata - array of volume metadata
   * @param SlideOptions.labelMetadata - array of label metadata
   * @param SlideOptions.overviewMetadata - array of overview metadata
   */
  constructor (
    slideOptionsItem: SlideOptions
  ) {
    if (
      slideOptionsItem.frameofReferenceUID === '' ||
      slideOptionsItem.frameofReferenceUID === undefined
    ) {
      throw new Error('Unvalid frameofReferenceUID value parsed to slide.')
    }

    if (
      slideOptionsItem.containerIdentifier === '' ||
      slideOptionsItem.containerIdentifier === undefined
    ) {
      throw new Error('Unvalid containerIdentifier value parsed to slide.')
    }

    if (
      slideOptionsItem.selectedSeriesInstanceUID === '' ||
      slideOptionsItem.selectedSeriesInstanceUID === undefined
    ) {
      throw new Error('Unvalid selectedSeriesInstanceUID value parsed to slide.')
    }

    if (
      slideOptionsItem.selectedOpticalPathIdentifier === '' ||
      slideOptionsItem.selectedOpticalPathIdentifier === undefined
    ) {
      throw new Error('Unvalid selectedOpticalPathIdentifier value parsed to slide.')
    }

    if (slideOptionsItem.seriesInstanceUIDs.length === 0) {
      throw new Error('No seriesInstanceUIDs have been parsed to slide.')
    }

    if (slideOptionsItem.opticalPathIdentifiers.length === 0) {
      throw new Error('No opticalPathIdentifiers have been parsed to slide.')
    }

    if (slideOptionsItem.volumeMetadata.length === 0) {
      throw new Error('No volumeMetadata have been parsed to slide.')
    }

    this.slideOptions = slideOptionsItem
  }

  /**
   * Gets the frame of reference UID of the slide
   * @returns frameofReferenceUID
   */
  get frameofReferenceUID (): string {
    return this.slideOptions.frameofReferenceUID
  }

  /**
   * Gets the container identifier parameter of the slide
   * @returns containerIdentifier
   */
  get containerIdentifier (): string {
    return this.slideOptions.containerIdentifier
  }

  /**
   * Gets if the images of the slide are monochrome
   * @returns areImagesMonochrome
   */
  areImagesMonochrome (): boolean {
    return this.slideOptions.areImagesMonochrome
  }

  /**
   * Gets if slide is a multiplexed samples
   * @returns isMultiplexedSamples
   */
  isMultiplexedSamples (): boolean {
    return this.slideOptions.isMultiplexedSamples
  }

  /**
   * Gets the selected series instance UID
   * @returns selectedSeriesInstanceUID
   */
  get selectedSeriesInstanceUID (): string {
    return this.slideOptions.selectedSeriesInstanceUID
  }

  /**
   * Gets the series instance UIDs array
   * @returns seriesInstanceUIDs
   */
  get seriesInstanceUIDs (): string[] {
    return this.slideOptions.seriesInstanceUIDs
  }

  /**
   * Gets the selected optical path identifier
   * @returns selectedOpticalPathIdentifier
   */
  get selectedOpticalPathIdentifier (): string {
    return this.slideOptions.selectedOpticalPathIdentifier
  }

  /**
   * Gets the optical path identifiers array
   * @returns opticalPathIdentifiers
   */
  get opticalPathIdentifiers (): string[] {
    return this.slideOptions.opticalPathIdentifiers
  }

  /**
   * Gets the slide description
   * @returns description
   */
  get description (): string {
    return this.slideOptions.description !== undefined ? this.slideOptions.description : ''
  }

  /**
   * Gets the all metadata of volume instances
   * @returns volumeMetadata
   */
  get volumeInstances (): object[] {
    return this.slideOptions.volumeMetadata
  }

  /**
   * Gets the all metadata of label instances
   * @returns labelMetadata
   */
  get labelInstances (): object[] {
    return this.slideOptions.labelMetadata
  }

  /**
   * Gets the all metadata of overview instances
   * @returns overviewMetadata
   */
  get overviewInstances (): object[] {
    return this.slideOptions.overviewMetadata
  }

  /**
   * Gets the all formatted metadata of volume instances
   * @returns volumeMetadata
   */
  get formattedVolumeInstances (): dmv.metadata.VLWholeSlideMicroscopyImage[] {
    const formattedVolumeMetadata = [] as dmv.metadata.VLWholeSlideMicroscopyImage[]
    this.slideOptions.volumeMetadata.forEach((metadata) => {
      const image = dmv.metadata.formatMetadata(
        metadata
      ) as dmv.metadata.VLWholeSlideMicroscopyImage
      formattedVolumeMetadata.push(image)
    })

    return formattedVolumeMetadata
  }

  /**
   * Gets the formatted metadata of the first volume instance stored in the volumeMetadata array
   * @returns volumeMetadata
   */
  get firstFormattedVolumeInstance (): dmv.metadata.VLWholeSlideMicroscopyImage {
    if (this.slideOptions.volumeMetadata.length === 0) {
      throw new Error('the volume metadata array has zero elements.')
    }

    return dmv.metadata.formatMetadata(
      this.slideOptions.volumeMetadata[0]
    ) as dmv.metadata.VLWholeSlideMicroscopyImage
  }
}

/**
 * Transforms series states array into a slide states array
 * A series state has 3 array of metadata (volume, label
 * and overview) already donwloaded.
 *
 * First we group in slides by FrameofReferenceUID and ContainerIdentifier:
 * i.e. putting togheter images (overview, label, volume) instances from N series.
 *
 * Secondly we indentify the slides as:
 *   A) If the number of opticalPathIdentifier > 1 and SamplesPerPixel === 1
 *      and PhotometricInterpretation === MONOCHROME2, then the observation is a
 *      multiplexed samples with N "channels";
 *   B) If the number of opticalPathIdentifier === 1 and SamplesPerPixel === 1
 *      and PhotometricInterpretation === MONOCHROME2, then the observation is a
 *      simple single monochorme image sample;
 *   C) If the number of opticalPathIdentifier === 1 and SamplesPerPixel !== 1
 *      and PhotometricInterpretation === RGB or YBR,
 *      then the observation is a RGB single image sample.
 *
 * @param instancesMetadata - array of instances from series, each element
 *        of the array corresponds to a series
 * @param initiallySelectedSeriesInstanceUID - to visualize
 *        at first loading data coming from a specific series.
 * @returns slides - array of slide states
 */
function createSlides (
  instancesMetadata: InstancesMetadata[],
  initiallySelectedSeriesInstanceUID?: string
): Slide[] {
  const slideMetadata: SlideMetadata[] = []
  for (let i = 0; i < instancesMetadata.length; ++i) {
    const instanceMetadata = instancesMetadata[i]
    if (instanceMetadata.volumeMetadata.length === 0) {
      console.warn('Series has zero volume instance. ' +
                   'The series will be discarded.')
      continue
    }
    const instance = dmv.metadata.formatMetadata(
      instanceMetadata.volumeMetadata[0]
    ) as dmv.metadata.VLWholeSlideMicroscopyImage
    const seriesFrameofReferenceUID = instance.FrameOfReferenceUID
    const seriesContainerIdentifier = instance.ContainerIdentifier
    const slideMetadataIndex = slideMetadata.findIndex((slide) =>
      slide.frameofReferenceUID === seriesFrameofReferenceUID &&
      slide.containerIdentifier === seriesContainerIdentifier
    )

    if (slideMetadataIndex === -1) {
      const slideMetadataItem: SlideMetadata = {
        frameofReferenceUID: seriesFrameofReferenceUID,
        containerIdentifier: seriesContainerIdentifier,
        volumeMetadata: [],
        labelMetadata: [],
        overviewMetadata: []
      }
      _addInstanceMetadata(
        instanceMetadata,
        slideMetadataItem
      )
      slideMetadata.push(slideMetadataItem)
    } else {
      const slideMetadataItem = slideMetadata[slideMetadataIndex]
      _addInstanceMetadata(
        instanceMetadata,
        slideMetadataItem
      )
    }
  }

  const slides: Slide[] = []
  slideMetadata.forEach((metadata) => {
    if (metadata.volumeMetadata.length === 0) {
      console.warn('Slide has zero volume instance. ' +
                   'The slide will be discarded.')
    } else {
      console.info('bella', metadata)
      const referenceInstance = dmv.metadata.formatMetadata(
        metadata.volumeMetadata[0]
      ) as dmv.metadata.VLWholeSlideMicroscopyImage

      let slideInstanceOpticalPathIdentifier =
        referenceInstance.OpticalPathSequence[0].OpticalPathIdentifier
      const slideIsMonochrome = (
        referenceInstance.SamplesPerPixel === 1 &&
        referenceInstance.PhotometricInterpretation === 'MONOCHROME2'
      )

      const slideSeriesInstanceUIDs = []
      const slideOpticalPathIdentifiers = []
      let slideSelectedSeriesInstanceUID = referenceInstance.SeriesInstanceUID
      for (let i = 0; i < metadata.volumeMetadata.length; ++i) {
        const instance = dmv.metadata.formatMetadata(
          metadata.volumeMetadata[i]
        ) as dmv.metadata.VLWholeSlideMicroscopyImage

        const instanceIsMonochrome = (
          instance.SamplesPerPixel === 1 &&
          instance.PhotometricInterpretation === 'MONOCHROME2'
        )
        if (slideIsMonochrome !== instanceIsMonochrome) {
          console.warn('Volume instance' +
                       instance.SOPInstanceUID +
                       ' of the slide has diff`erent image type. ' +
                       'The instance will be discarded.')
        }

        const instanceSeriesInstanceUID = instance.SeriesInstanceUID
        const seriesIndex = slideSeriesInstanceUIDs.findIndex(
          series => series === instanceSeriesInstanceUID
        )
        if (seriesIndex === -1) {
          slideSeriesInstanceUIDs.push(instanceSeriesInstanceUID)
        }

        const instanceOpticalPathIdentifier =
          instance.OpticalPathSequence[0].OpticalPathIdentifier
        const opticalIdIndex = slideOpticalPathIdentifiers.findIndex(
          opticalId => opticalId === instanceOpticalPathIdentifier
        )
        if (opticalIdIndex === -1) {
          slideOpticalPathIdentifiers.push(instanceOpticalPathIdentifier)
        }

        if (initiallySelectedSeriesInstanceUID !== undefined &&
            initiallySelectedSeriesInstanceUID === instanceSeriesInstanceUID) {
          slideInstanceOpticalPathIdentifier = instanceOpticalPathIdentifier
          slideSelectedSeriesInstanceUID = instanceSeriesInstanceUID
        }
      }

      let slideIsMultiplexedSamples
      let slideDescription
      if (slideOpticalPathIdentifiers.length > 1) {
        slideDescription = 'Multiplexed-Samples'
        slideIsMultiplexedSamples = true
      } else if (slideIsMonochrome) {
        slideDescription = 'Monochrome Slide'
        slideIsMultiplexedSamples = false
      } else if (!slideIsMonochrome) {
        slideDescription = 'RGB Slide'
        slideIsMultiplexedSamples = false
      } else {
        throw new Error('Unvalid slide type.')
      }

      const slideOptions: SlideOptions = {
        frameofReferenceUID: metadata.frameofReferenceUID,
        containerIdentifier: metadata.containerIdentifier,
        areImagesMonochrome: slideIsMonochrome,
        isMultiplexedSamples: slideIsMultiplexedSamples,
        selectedSeriesInstanceUID: slideSelectedSeriesInstanceUID,
        seriesInstanceUIDs: slideSeriesInstanceUIDs,
        selectedOpticalPathIdentifier: slideInstanceOpticalPathIdentifier,
        opticalPathIdentifiers: slideOpticalPathIdentifiers,
        description: slideDescription,
        volumeMetadata: metadata.volumeMetadata,
        labelMetadata: metadata.labelMetadata,
        overviewMetadata: metadata.overviewMetadata
      }

      console.info(slideOptions)

      const slide = new Slide(slideOptions)
      slides.push(slide)
    }
  })

  return slides
}

/**
 * Adds input instances to the slideMetadata object. Specifically, it parses volume, overview and
 * label instances into three arrays.
 *
 * @param instancesMetadata - array of volume, label and overview instances
 * @param slideMetadataItem - slide metadata object
 */
function _addInstanceMetadata (
  instancesMetadata: InstancesMetadata,
  slideMetadataItem: SlideMetadata
): void {
  const filteredVolumeMetadata = instancesMetadata.volumeMetadata.filter(metadata => {
    const instance = dmv.metadata.formatMetadata(
      metadata
    ) as dmv.metadata.VLWholeSlideMicroscopyImage
    return _doesInstanceBelongToSlide(slideMetadataItem, instance)
  })
  filteredVolumeMetadata.forEach(metadata => {
    slideMetadataItem.volumeMetadata.push(metadata)
  })

  const filteredLabelMetadata = instancesMetadata.labelMetadata.filter(metadata => {
    const instance = dmv.metadata.formatMetadata(
      metadata
    ) as dmv.metadata.VLWholeSlideMicroscopyImage
    return _doesInstanceBelongToSlide(slideMetadataItem, instance)
  })
  filteredLabelMetadata.forEach(metadata => {
    slideMetadataItem.labelMetadata.push(metadata)
  })

  const filteredOverviewMetadata = instancesMetadata.overviewMetadata.filter(metadata => {
    const instance = dmv.metadata.formatMetadata(
      metadata
    ) as dmv.metadata.VLWholeSlideMicroscopyImage
    return _doesInstanceBelongToSlide(slideMetadataItem, instance)
  })
  filteredOverviewMetadata.forEach(metadata => {
    slideMetadataItem.overviewMetadata.push(metadata)
  })
}

/**
 * Checks if instance belongs to the slide (i.e., cross checks
 * the FrameOfReferenceUID and ContainerIdentifier strings).
 *
 * @param slideMetadataItem - slide metadata object
 * @param instance - volume, label or overview instance
 */
function _doesInstanceBelongToSlide (
  slideMetadataItem: SlideMetadata,
  instance: dmv.metadata.VLWholeSlideMicroscopyImage
): boolean {
  if (slideMetadataItem.frameofReferenceUID !== instance.FrameOfReferenceUID) {
    console.warn('FrameOfReferenceUID of instance' +
                 instance.SOPInstanceUID +
                 ' does not correspond to slide FrameOfReferenceUID. ' +
                 'The instance will be discarded.')
    return false
  }
  if (slideMetadataItem.containerIdentifier !== instance.ContainerIdentifier) {
    console.warn('ContainerIdentifier of instance' +
                 instance.SOPInstanceUID +
                 ' does not correspond to slide ContainerIdentifier. ' +
                 'The instance will be discarded.')
    return false
  }
  return true
}

export { Slide, createSlides }
