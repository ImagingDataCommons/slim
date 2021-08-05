import * as dmv from 'dicom-microscopy-viewer'

export interface InstancesMetadata {
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
  selectedOpticalPathidentifier: string
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
   * @param SlideOptions.selectedOpticalPathidentifier - selected optical path indentifier
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
      slideOptionsItem.selectedOpticalPathidentifier === '' ||
      slideOptionsItem.selectedOpticalPathidentifier === undefined
    ) {
      throw new Error('Unvalid selectedOpticalPathidentifier value parsed to slide.')
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
   * @returns selectedOpticalPathidentifier
   */
  get selectedOpticalPathidentifier (): string {
    return this.slideOptions.selectedOpticalPathidentifier
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
 * @param instancesMetadataArray - array of instances from series, each element
 *        of the array corresponds to a series
 * @param initiallySelectedSeriesInstanceUID - to visualize
 *        at first loading data coming from a specific series.
 * @returns slides - array of slide states
 */
function createSlides (
  instancesMetadataArray: InstancesMetadata[],
  initiallySelectedSeriesInstanceUID?: string
): Slide[] {
  const slideOptionsArray: SlideOptions[] = []
  for (let i = 0; i < instancesMetadataArray.length; ++i) {
    const instancesMetadata = instancesMetadataArray[i]
    if (instancesMetadata.volumeMetadata.length === 0) {
      console.warn('Series has zero volume instance. ' +
                   'The series will be discarded.')
      continue
    }
    const instance = dmv.metadata.formatMetadata(
      instancesMetadata.volumeMetadata[0]
    ) as dmv.metadata.VLWholeSlideMicroscopyImage
    const seriesFrameofReferenceUID = instance.FrameOfReferenceUID
    const seriesContainerIdentifier = instance.ContainerIdentifier

    const slideOptionIndex = slideOptionsArray.findIndex((slideOptions) =>
      slideOptions.frameofReferenceUID === seriesFrameofReferenceUID &&
      slideOptions.containerIdentifier === seriesContainerIdentifier
    )

    if (slideOptionIndex === -1) {
      // create new slideOptionsItem
      const slideOptionsItem: SlideOptions = {
        frameofReferenceUID: seriesFrameofReferenceUID,
        containerIdentifier: seriesContainerIdentifier,
        areImagesMonochrome: false,
        isMultiplexedSamples: false,
        selectedSeriesInstanceUID: '',
        seriesInstanceUIDs: [],
        selectedOpticalPathidentifier: '',
        opticalPathIdentifiers: [],
        volumeMetadata: [],
        labelMetadata: [],
        overviewMetadata: []
      }

      _addInstanceMetadata(
        instancesMetadata,
        slideOptionsItem,
        initiallySelectedSeriesInstanceUID
      )
      slideOptionsArray.push(slideOptionsItem)
    } else {
      // add info to already created slide
      const slideOptionsItem = slideOptionsArray[slideOptionIndex]
      _addInstanceMetadata(
        instancesMetadata,
        slideOptionsItem,
        initiallySelectedSeriesInstanceUID
      )
    }
  }

  const slides: Slide[] = []
  slideOptionsArray.forEach((slideOptionsItem) => {
    const slide = new Slide(slideOptionsItem)
    slides.push(slide)
  })

  return slides
}

/**
 * Adds input instances to the slideOptions object. Specifically, it parses volume, overview and
 * label instances into three arrays. Additionally, it sets the attributes of the object which
 * describe the type of the slide (Multiplexed-Samples, Monochrome Slide and RGB Slide).
 *
 * @param instancesMetadata - array of volume, label and overview instances
 * @param slideOptionsItem - slide options object
 * @param initiallySelectedSeriesInstanceUID - selected series UID
 */
function _addInstanceMetadata (
  instancesMetadata: InstancesMetadata,
  slideOptionsItem: SlideOptions,
  initiallySelectedSeriesInstanceUID?: string
): void {
  const volumeInstanceReference =
    _addVolumeInstanceMetadata(slideOptionsItem, instancesMetadata.volumeMetadata)
  _addLabelInstanceMetadata(slideOptionsItem, instancesMetadata.labelMetadata)
  _addOverviewInstanceMetadata(slideOptionsItem, instancesMetadata.overviewMetadata)

  // store series uid
  if (volumeInstanceReference !== undefined) {
    const seriesUID = volumeInstanceReference.SeriesInstanceUID
    slideOptionsItem.seriesInstanceUIDs.push(seriesUID)
    if (initiallySelectedSeriesInstanceUID === seriesUID) {
      slideOptionsItem.selectedSeriesInstanceUID = initiallySelectedSeriesInstanceUID
      slideOptionsItem.selectedOpticalPathidentifier =
        volumeInstanceReference.OpticalPathSequence[0].OpticalPathIdentifier
    }

    if (initiallySelectedSeriesInstanceUID === undefined) {
      slideOptionsItem.selectedSeriesInstanceUID = seriesUID
    }
  }

  // set description (slide type)
  if (slideOptionsItem.opticalPathIdentifiers.length > 1) {
    slideOptionsItem.description = 'Multiplexed-Samples'
    slideOptionsItem.isMultiplexedSamples = true
  } else if (slideOptionsItem.areImagesMonochrome) {
    slideOptionsItem.description = 'Monochrome Slide'
    slideOptionsItem.isMultiplexedSamples = false
  } else if (!slideOptionsItem.areImagesMonochrome) {
    slideOptionsItem.description = 'RGB Slide'
    slideOptionsItem.isMultiplexedSamples = false
  }
}

/**
 * Adds instances to the volumeMetadata array attribute of the slide options object.
 *
 * @param slideOptionsItem - slide options object
 * @param volumeMetadataList - array of volume instances
 * @returns volumeInstanceReference - first volume instance of the list
 */
function _addVolumeInstanceMetadata (
  slideOptionsItem: SlideOptions,
  volumeMetadataList: object[]
): dmv.metadata.VLWholeSlideMicroscopyImage | undefined {
  let volumeInstanceReference
  for (let j = 0; j < volumeMetadataList.length; ++j) {
    const metadata = volumeMetadataList[j]
    if (!_doesInstanceBelongToSlide(slideOptionsItem, metadata)) {
      continue
    }

    const instance = dmv.metadata.formatMetadata(
      metadata
    ) as dmv.metadata.VLWholeSlideMicroscopyImage
    const instanceOpticalPathIdentifier =
      instance.OpticalPathSequence[0].OpticalPathIdentifier
    const instanceIsMonochorme = instance.SamplesPerPixel === 1 &&
      instance.PhotometricInterpretation === 'MONOCHROME2'
    if (slideOptionsItem.selectedOpticalPathidentifier === '') {
      slideOptionsItem.areImagesMonochrome = instanceIsMonochorme
      slideOptionsItem.selectedOpticalPathidentifier = instanceOpticalPathIdentifier
    } else if (instanceIsMonochorme !== slideOptionsItem.areImagesMonochrome) {
      console.warn('Volume instance' +
                   instance.SOPInstanceUID +
                   ' of the slide has different image type. ' +
                   'The instance will be discarded.')
      continue
    }
    if (volumeInstanceReference === undefined) {
      volumeInstanceReference = instance
    }
    if (slideOptionsItem.opticalPathIdentifiers.findIndex(
      (opi) => opi === instanceOpticalPathIdentifier) === -1
    ) {
      slideOptionsItem.opticalPathIdentifiers.push(instanceOpticalPathIdentifier)
    }
    slideOptionsItem.volumeMetadata.push(metadata)
  }
  return volumeInstanceReference
}

/**
 * Adds instances to the labelMetadata array attribute of the slide options object.
 *
 * @param slideOptionsItem - slide options object
 * @param labelMetadataList - array of label instances
 */
function _addLabelInstanceMetadata (
  slideOptionsItem: SlideOptions,
  labelMetadataList: object[]
): void {
  labelMetadataList.forEach((metadata) => {
    if (_doesInstanceBelongToSlide(slideOptionsItem, metadata)) {
      slideOptionsItem.labelMetadata.push(metadata)
    }
  })
}

/**
 * Adds instances to the overviewMetadata array attribute of the slide options object.
 *
 * @param slideOptionsItem - slide options object
 * @param overviewMetadataList - array of overview instances
 */
function _addOverviewInstanceMetadata (
  slideOptionsItem: SlideOptions,
  overviewMetadataList: object[]
): void {
  overviewMetadataList.forEach((metadata) => {
    if (_doesInstanceBelongToSlide(slideOptionsItem, metadata)) {
      slideOptionsItem.overviewMetadata.push(metadata)
    }
  })
}

/**
 * Checks if instance belongs to the slide (i.e., cross checks
 * the FrameOfReferenceUID and ContainerIdentifier strings).
 *
 * @param slideOptionsItem - slide options object
 * @param metadata - volume, label or overview instance
 */
function _doesInstanceBelongToSlide (
  slideOptionsItem: SlideOptions,
  metadata: object
): boolean {
  const instance = dmv.metadata.formatMetadata(
    metadata
  ) as dmv.metadata.VLWholeSlideMicroscopyImage
  if (slideOptionsItem.frameofReferenceUID !== instance.FrameOfReferenceUID) {
    console.warn('FrameOfReferenceUID of instance' +
                 instance.SOPInstanceUID +
                 ' does not correspond to slide FrameOfReferenceUID. ' +
                 'The instance will be discarded.')
    return false
  }
  if (slideOptionsItem.containerIdentifier !== instance.ContainerIdentifier) {
    console.warn('ContainerIdentifier of instance' +
                 instance.SOPInstanceUID +
                 ' does not correspond to slide ContainerIdentifier. ' +
                 'The instance will be discarded.')
    return false
  }
  return true
}

export { Slide, createSlides }
