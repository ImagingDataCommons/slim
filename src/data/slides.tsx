import * as dmv from 'dicom-microscopy-viewer'

export interface InstancesMetadata {
  volumeMetadata: object[]
  labelMetadata: object[]
  overviewMetadata: object[]
}

/**
 * Slide - handles grouping of instances that share the same frame of reference.
 *
 * @params frameofReferenceUID - reference frame
 * @params containerIdentifier - container identifier
 * @params areImagesMonochrome - type of images
 * @params isMultiplexedSamples - is multi channel datasets
 * @params selectedSeriesUID - selected series connected to the slide
 * @params seriesUIDsList - array of series UIDs connected to the slide
 * @params selectedOpticalPathidentifier - selected optical path indentifier
 * @params opticalPathIdentifiersList - array of all optical path identifiers
 * @params description - slide description, i.e.,
 *                       Multiplexed-Samples, Monochrome Slide, RGB Slide
 * @params volumeMetadata - array of volume metadata
 * @params labelMetadata - array of label metadata
 * @params overviewMetadata - array of overview metadata
 */
class Slide {
  frameofReferenceUID?: string
  containerIdentifier?: string
  areImagesMonochrome?: boolean
  isMultiplexedSamples?: boolean
  selectedSeriesUID?: string
  seriesUIDsList: string[] = []
  selectedOpticalPathidentifier?: string
  opticalPathIdentifiersList: string[] = []
  description?: string
  volumeMetadata: object[] = []
  labelMetadata: object[] = []
  overviewMetadata: object[] = []

  /**
   * A Slide is identified by two parameters:
   * frameofReferenceUID and the containerIdentifier.
   *
   * @params instancesMetadata - array of volume, label and overview instances
   * @params initiallySelectedSeriesInstanceUID - selected series UID
   */
  constructor (
    instancesMetadata: InstancesMetadata,
    initiallySelectedSeriesInstanceUID?: string
  ) {
    if (instancesMetadata.volumeMetadata.length === 0) {
      console.warn('No volume instance found while creating a Slide. ')
      return
    }

    const instance = dmv.metadata.formatMetadata(
      instancesMetadata.volumeMetadata[0]
    ) as dmv.metadata.VLWholeSlideMicroscopyImage

    this.frameofReferenceUID = instance.FrameOfReferenceUID
    this.containerIdentifier = instance.ContainerIdentifier

    this.addInstanceMetadata(
      instancesMetadata,
      initiallySelectedSeriesInstanceUID
    )
  }

  /**
   * Gets the all formatted metadata of volume instance
   * @returns volume instance
   */
  getVolumeInstances (): dmv.metadata.VLWholeSlideMicroscopyImage[] | undefined {
    if (this.volumeMetadata.length === 0) {
      return undefined
    }

    const volumeFormattedMetadata = [] as dmv.metadata.VLWholeSlideMicroscopyImage[]
    this.volumeMetadata.forEach((metadata) => {
      const image = dmv.metadata.formatMetadata(
        metadata
      ) as dmv.metadata.VLWholeSlideMicroscopyImage
      volumeFormattedMetadata.push(image)
    })

    return volumeFormattedMetadata
  }

  /**
   * Gets the formatted metadata of the first volume instance stored in the volumeMetadata array
   * @returns volume instance
   */
  getFirstVolumeInstance (): dmv.metadata.VLWholeSlideMicroscopyImage | undefined {
    if (this.volumeMetadata.length === 0) {
      return undefined
    }

    return dmv.metadata.formatMetadata(this.volumeMetadata[0]) as dmv.metadata.VLWholeSlideMicroscopyImage
  }

  /**
   * Adds input instances to the slide object. Specifically, it parses volume, overview and
   * label instances into three arrays. Additionally, it sets the attributes of the object which
   * describe the type of the slide (Multiplexed-Samples, Monochrome Slide and RGB Slide).
   *
   * @params instancesMetadata - array of volume, label and overview instances
   * @params initiallySelectedSeriesInstanceUID - selected series UID
   */
  addInstanceMetadata (
    instancesMetadata: InstancesMetadata,
    initiallySelectedSeriesInstanceUID?: string
  ): void {
    const volumeInstanceReference =
      this.addVolumeInstanceMetadata(instancesMetadata.volumeMetadata)
    this.addLabelInstanceMetadata(instancesMetadata.labelMetadata)
    this.addOverviewInstanceMetadata(instancesMetadata.overviewMetadata)

    // store series uid
    if (volumeInstanceReference !== undefined) {
      const seriesUID = volumeInstanceReference.SeriesInstanceUID
      this.seriesUIDsList.push(seriesUID)
      if (initiallySelectedSeriesInstanceUID === seriesUID) {
        this.selectedSeriesUID = initiallySelectedSeriesInstanceUID
        this.selectedOpticalPathidentifier =
          volumeInstanceReference.OpticalPathSequence[0].OpticalPathIdentifier
      }

      if (initiallySelectedSeriesInstanceUID === undefined) {
        this.selectedSeriesUID = seriesUID
      }
    }

    // set description (slide type)
    if (this.opticalPathIdentifiersList.length > 1) {
      this.description = 'Multiplexed-Samples'
      this.isMultiplexedSamples = true
    } else if (
      this.areImagesMonochrome !== undefined &&
      this.areImagesMonochrome
    ) {
      this.description = 'Monochrome Slide'
      this.isMultiplexedSamples = false
    } else if (
      this.areImagesMonochrome !== undefined &&
      !this.areImagesMonochrome
    ) {
      this.description = 'RGB Slide'
      this.isMultiplexedSamples = false
    }
  }

  /**
   * Adds instances to the volumeMetadata array attribute of the slide.
   *
   * @params volumeMetadataList - array of volume instances
   * @returns volumeInstanceReference - first volume instance of the list
   */
  private addVolumeInstanceMetadata (
    volumeMetadataList: object[]
  ): dmv.metadata.VLWholeSlideMicroscopyImage | undefined {
    let volumeInstanceReference
    for (let j = 0; j < volumeMetadataList.length; ++j) {
      const metadata = volumeMetadataList[j]
      if (!this.doesInstanceBelongToSlide(metadata)) {
        continue
      }

      const instance = dmv.metadata.formatMetadata(
        metadata
      ) as dmv.metadata.VLWholeSlideMicroscopyImage
      const instanceOpticalPathIdentifier =
        instance.OpticalPathSequence[0].OpticalPathIdentifier
      const instanceIsMonochorme = instance.SamplesPerPixel === 1 &&
        instance.PhotometricInterpretation === 'MONOCHROME2'
      if (this.selectedOpticalPathidentifier === undefined) {
        this.areImagesMonochrome = instanceIsMonochorme
        this.selectedOpticalPathidentifier = instanceOpticalPathIdentifier
      } else if (instanceIsMonochorme !== this.areImagesMonochrome) {
        console.warn('Volume instance' +
                     instance.SOPInstanceUID +
                     ' of the slide has different image type. ' +
                     'The instance will be discarded.')
        continue
      }
      if (volumeInstanceReference === undefined) {
        volumeInstanceReference = instance
      }
      if (this.opticalPathIdentifiersList.findIndex(
        (opi) => opi === instanceOpticalPathIdentifier) === -1
      ) {
        this.opticalPathIdentifiersList.push(instanceOpticalPathIdentifier)
      }
      this.volumeMetadata.push(metadata)
    }
    return volumeInstanceReference
  }

  /**
   * Adds instances to the labelMetadata array attribute of the slide.
   *
   * @params labelMetadataList - array of label instances
   */
  private addLabelInstanceMetadata (
    labelMetadataList: object[]
  ): void {
    labelMetadataList.forEach((metadata) => {
      if (this.doesInstanceBelongToSlide(metadata)) {
        this.labelMetadata.push(metadata)
      }
    })
  }

  /**
   * Adds instances to the overviewMetadata array attribute of the slide.
   *
   * @params overviewMetadataList - array of overview instances
   */
  private addOverviewInstanceMetadata (
    overviewMetadataList: object[]
  ): void {
    overviewMetadataList.forEach((metadata) => {
      if (this.doesInstanceBelongToSlide(metadata)) {
        this.overviewMetadata.push(metadata)
      }
    })
  }

  /**
   * Checks if instance belongs to the slide (i.e., cross checks
   * the FrameOfReferenceUID and ContainerIdentifier strings).
   *
   * @params metadata - volume, label or overview instance
   */
  private doesInstanceBelongToSlide (
    metadata: object
  ): boolean {
    const instance = dmv.metadata.formatMetadata(
      metadata
    ) as dmv.metadata.VLWholeSlideMicroscopyImage
    if (this.frameofReferenceUID !== instance.FrameOfReferenceUID) {
      console.warn('FrameOfReferenceUID of instance' +
                   instance.SOPInstanceUID +
                   ' does not correspond to slide FrameOfReferenceUID. ' +
                   'The instance will be discarded.')
      return false
    }
    if (this.containerIdentifier !== instance.ContainerIdentifier) {
      console.warn('ContainerIdentifier of instance' +
                   instance.SOPInstanceUID +
                   ' does not correspond to slide ContainerIdentifier. ' +
                   'The instance will be discarded.')
      return false
    }
    return true
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
 * @params instancesMetadataArray - array of instances from series, each element
 *         of the array corresponds to a series
 * @params initiallySelectedSeriesInstanceUID - to visualize
 *         at first loading data coming from a specific series.
 * @returns slides - array of slide states
 */
function createSlides (
  instancesMetadataArray: InstancesMetadata[],
  initiallySelectedSeriesInstanceUID?: string
): Slide[] {
  const slides: Slide[] = []
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

    const slideIndex = slides.findIndex((slide) =>
      slide.frameofReferenceUID === seriesFrameofReferenceUID &&
      slide.containerIdentifier === seriesContainerIdentifier
    )

    let slide
    if (slideIndex === -1) {
      // create new slide
      slide = new Slide(
        instancesMetadata,
        initiallySelectedSeriesInstanceUID
      )
      slides.push(slide)
    } else {
      // add info to already created slide
      slide = slides[slideIndex]
      slide.addInstanceMetadata(
        instancesMetadata,
        initiallySelectedSeriesInstanceUID
      )
    }
  }
  return slides
}

export { Slide, createSlides }
