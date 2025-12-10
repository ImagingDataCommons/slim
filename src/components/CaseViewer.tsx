import { Routes, Route, useLocation, useParams } from 'react-router-dom'
import { Layout, Menu } from 'antd'
// skipcq: JS-C1003
import * as dcmjs from 'dcmjs'
import { useEffect, useState } from 'react'

import { AnnotationSettings } from '../AppConfig'
import ClinicalTrial from './ClinicalTrial'
import DicomWebManager from '../DicomWebManager'
import Patient from './Patient'
import Study from './Study'
import SlideList from './SlideList'
import SlideViewer from './SlideViewer'

import { User } from '../auth'
import { Slide } from '../data/slides'
import { RouteComponentProps, withRouter } from '../utils/router'
import { useSlides } from '../hooks/useSlides'
import { StorageClasses } from '../data/uids'

const { naturalizeDataset } = dcmjs.data.DicomMetaDictionary

interface NaturalizedInstance {
  SeriesInstanceUID: string
  SOPInstanceUID: string
  FrameOfReferenceUID?: string
  ContainerIdentifier?: string
  ReferencedSeriesSequence?: Array<{
    SeriesInstanceUID: string
  }>
  ContentSequence?: Array<{
    ConceptNameCodeSequence: Array<{
      CodeValue: string
    }>
    ContentSequence?: Array<{
      ContentSequence: Array<{
        ReferencedSOPSequence: Array<{
          ReferencedSOPInstanceUID: string
        }>
      }>
    }>
  }>
}

interface ReferencedSlideResult {
  slide: Slide | undefined
  metadata: NaturalizedInstance
}

const findSeriesSlide = (slides: Slide[], seriesInstanceUID: string): Slide | undefined => {
  return slides.find((slide: Slide) => {
    return slide.seriesInstanceUIDs.find((uid: string) => {
      return uid === seriesInstanceUID
    })
  })
}

function ParametrizedSlideViewer ({
  clients,
  slides,
  user,
  app,
  preload,
  enableAnnotationTools,
  annotations
}: {
  clients: { [key: string]: DicomWebManager }
  slides: Slide[]
  user?: User
  app: {
    name: string
    version: string
    uid: string
    organization?: string
  }
  preload: boolean
  enableAnnotationTools: boolean
  annotations: AnnotationSettings[]
}): JSX.Element | null {
  const { studyInstanceUID = '', seriesInstanceUID = '' } = useParams<{ studyInstanceUID: string, seriesInstanceUID: string }>()
  const location = useLocation()

  const [selectedSlide, setSelectedSlide] = useState(findSeriesSlide(slides, seriesInstanceUID))
  const [derivedDataset, setDerivedDataset] = useState<NaturalizedInstance | null>(null)

  useEffect(() => {
    const seriesSlide = findSeriesSlide(slides, seriesInstanceUID)
    if (seriesSlide !== null) {
      setSelectedSlide(seriesSlide)
    }
  }, [seriesInstanceUID, slides])

  useEffect(() => {
    const findReferencedSlide = async ({ clients, studyInstanceUID, seriesInstanceUID }: {
      clients: { [key: string]: DicomWebManager }
      studyInstanceUID: string
      seriesInstanceUID: string
    }): Promise<ReferencedSlideResult | null> => {
      try {
        const allClients = Object.values(StorageClasses).map((storageClass) => clients[storageClass])
        
        // Try each client sequentially to avoid race conditions
        for (const client of allClients) {
          try {
            const seriesMetadata = await client.retrieveSeriesMetadata({
              studyInstanceUID: studyInstanceUID,
              seriesInstanceUID: seriesInstanceUID
            })
            
            if (seriesMetadata.length === 0) {
              continue
            }
            
            const naturalizedSeriesMetadataArray = seriesMetadata.map((metadata) => naturalizeDataset(metadata)) as NaturalizedInstance[]
            // Use the first instance for ReferencedSeriesSequence check
            const naturalizedSeriesMetadata = naturalizedSeriesMetadataArray[0]

            // Check ReferencedSeriesSequence - iterate through all items, not just the first
            if (naturalizedSeriesMetadata.ReferencedSeriesSequence != null && naturalizedSeriesMetadata.ReferencedSeriesSequence.length > 0) {
              // For each referenced series, get its metadata and match against slides
              for (const referencedSeries of naturalizedSeriesMetadata.ReferencedSeriesSequence) {
                const referencedSeriesInstanceUID = referencedSeries.SeriesInstanceUID
                
                try {
                  // Get metadata from the referenced series to extract FrameOfReferenceUID/ContainerIdentifier
                  const referencedSeriesMetadata = await client.retrieveSeriesMetadata({
                    studyInstanceUID: studyInstanceUID,
                    seriesInstanceUID: referencedSeriesInstanceUID
                  })
                  
                  if (referencedSeriesMetadata.length === 0) {
                    continue
                  }
                  
                  const [referencedNaturalized] = referencedSeriesMetadata.map((metadata) => naturalizeDataset(metadata)) as NaturalizedInstance[]
                  const refFrameOfReferenceUID = referencedNaturalized.FrameOfReferenceUID
                  const refContainerIdentifier = referencedNaturalized.ContainerIdentifier
                  
                  if (refFrameOfReferenceUID == null || refContainerIdentifier == null) {
                    console.warn(`Referenced series ${referencedSeriesInstanceUID} missing FrameOfReferenceUID or ContainerIdentifier`)
                    continue
                  }
                  
                  // Find slides that match both the seriesInstanceUID AND FrameOfReferenceUID/ContainerIdentifier
                  const matchingSlides = slides.filter((slide: Slide) => {
                    // First check if slide contains this referenced series
                    const hasReferencedSeries = slide.seriesInstanceUIDs.some((uid: string) => {
                      return uid === referencedSeriesInstanceUID
                    })
                    
                    if (!hasReferencedSeries) {
                      return false
                    }
                    
                    // Then verify FrameOfReferenceUID and ContainerIdentifier match
                    return (
                      slide.frameOfReferenceUID === refFrameOfReferenceUID &&
                      slide.containerIdentifier === refContainerIdentifier
                    )
                  })
                  
                  // If we found a matching slide, return it immediately
                  if (matchingSlides.length > 0) {
                    if (matchingSlides.length > 1) {
                      console.warn(`Multiple slides match referenced series ${referencedSeriesInstanceUID} with same FrameOfReferenceUID/ContainerIdentifier, using first`)
                    }
                    return { slide: matchingSlides[0], metadata: naturalizedSeriesMetadata }
                  }
                } catch (refError) {
                  console.warn(`Failed to retrieve referenced series metadata for ${referencedSeriesInstanceUID}:`, refError)
                  continue
                }
              }
              
              // If we couldn't match any referenced series, try fallback: match by seriesInstanceUID only
              // but only if we can verify using FrameOfReferenceUID/ContainerIdentifier from derived display set
              let frameOfReferenceUID: string | undefined
              let containerIdentifier: string | undefined
              
              for (const instanceMetadata of naturalizedSeriesMetadataArray) {
                if (instanceMetadata.FrameOfReferenceUID != null) {
                  frameOfReferenceUID = instanceMetadata.FrameOfReferenceUID
                }
                if (instanceMetadata.ContainerIdentifier != null) {
                  containerIdentifier = instanceMetadata.ContainerIdentifier
                }
                if (frameOfReferenceUID != null && containerIdentifier != null) {
                  break
                }
              }
              
              if (frameOfReferenceUID != null && containerIdentifier != null) {
                // Try to find slide matching derived display set's FrameOfReferenceUID/ContainerIdentifier
                for (const referencedSeries of naturalizedSeriesMetadata.ReferencedSeriesSequence) {
                  const referencedSeriesInstanceUID = referencedSeries.SeriesInstanceUID
                  const candidateSlides = slides.filter((slide: Slide) => {
                    return slide.seriesInstanceUIDs.some((uid: string) => {
                      return uid === referencedSeriesInstanceUID
                    })
                  })
                  
                  const matchedSlide = candidateSlides.find((slide: Slide) => {
                    return (
                      slide.frameOfReferenceUID === frameOfReferenceUID &&
                      slide.containerIdentifier === containerIdentifier
                    )
                  })
                  
                  if (matchedSlide !== undefined) {
                    return { slide: matchedSlide, metadata: naturalizedSeriesMetadata }
                  }
                }
              }
            }

            // Check IMAGE_LIBRARY fallback
            const IMAGE_LIBRARY_CONCEPT_NAME_CODE = '111028'
            const imageLibrary = naturalizedSeriesMetadata.ContentSequence?.find(
              contentItem => contentItem.ConceptNameCodeSequence?.[0]?.CodeValue === IMAGE_LIBRARY_CONCEPT_NAME_CODE
            )
            if ((imageLibrary?.ContentSequence?.[0]?.ContentSequence?.[0]?.ReferencedSOPSequence?.[0]) != null) {
              const referencedSOPInstanceUID = imageLibrary.ContentSequence[0].ContentSequence[0].ReferencedSOPSequence[0].ReferencedSOPInstanceUID
              
              // Find all slides that contain this SOP instance
              const candidateSlides = slides.filter((slide: Slide) => {
                return slide.volumeImages.some((image: { SOPInstanceUID: string }) => {
                  return image.SOPInstanceUID === referencedSOPInstanceUID
                })
              })
              
              if (candidateSlides.length === 0) {
                // Continue to next client
                continue
              }
              
              // If only one candidate, use it
              if (candidateSlides.length === 1) {
                return { slide: candidateSlides[0], metadata: naturalizedSeriesMetadata }
              }
              
              // Multiple candidates - try to match by FrameOfReferenceUID and ContainerIdentifier
              // Check all instances for these values
              let frameOfReferenceUID: string | undefined
              let containerIdentifier: string | undefined
              
              for (const instanceMetadata of naturalizedSeriesMetadataArray) {
                if (instanceMetadata.FrameOfReferenceUID != null) {
                  frameOfReferenceUID = instanceMetadata.FrameOfReferenceUID
                }
                if (instanceMetadata.ContainerIdentifier != null) {
                  containerIdentifier = instanceMetadata.ContainerIdentifier
                }
                if (frameOfReferenceUID != null && containerIdentifier != null) {
                  break
                }
              }
              
              if (frameOfReferenceUID != null && containerIdentifier != null) {
                const matchedSlide = candidateSlides.find((slide: Slide) => {
                  return (
                    slide.frameOfReferenceUID === frameOfReferenceUID &&
                    slide.containerIdentifier === containerIdentifier
                  )
                })
                
                if (matchedSlide !== undefined) {
                  return { slide: matchedSlide, metadata: naturalizedSeriesMetadata }
                }
              }
              
              // Last resort: return the first candidate
              console.warn(`Multiple slides match referenced SOP ${referencedSOPInstanceUID}, using first match`)
              return { slide: candidateSlides[0], metadata: naturalizedSeriesMetadata }
            }
          } catch (clientError) {
            // Continue to next client if this one fails
            console.warn(`Failed to retrieve metadata from client:`, clientError)
            continue
          }
        }
        
        // No valid slide found
        return null
      } catch (error) {
        console.error('Error finding referenced slide:', error)
        return null
      }
    }

    if (selectedSlide === null || selectedSlide === undefined) {
      void findReferencedSlide({ clients, studyInstanceUID, seriesInstanceUID }).then((result: ReferencedSlideResult | null) => {
        if (result !== null && result !== undefined) {
          setSelectedSlide(result.slide)
          setDerivedDataset(result.metadata)
        }
      }).catch(error => {
        console.error('Error finding referenced slide:', error)
      })
    }
  }, [slides, clients, studyInstanceUID, seriesInstanceUID, selectedSlide])

  const searchParams = new URLSearchParams(location.search)
  let presentationStateUID: string | undefined
  if (!searchParams.has('access_token')) {
    const stateParam = searchParams.get('state')
    presentationStateUID = stateParam !== null ? stateParam : undefined
  }

  let viewer = null
  if (selectedSlide != null && selectedSlide !== undefined) {
    viewer = (
      <SlideViewer
        clients={clients}
        studyInstanceUID={studyInstanceUID}
        seriesInstanceUID={seriesInstanceUID}
        selectedPresentationStateUID={presentationStateUID}
        slide={selectedSlide}
        preload={preload}
        annotations={annotations}
        enableAnnotationTools={enableAnnotationTools}
        app={app}
        user={user}
        derivedDataset={derivedDataset ?? undefined}
      />
    )
  }
  return viewer
}

interface ViewerProps extends RouteComponentProps {
  clients: { [key: string]: DicomWebManager }
  studyInstanceUID: string
  app: {
    name: string
    version: string
    uid: string
    organization?: string
  }
  annotations: AnnotationSettings[]
  enableAnnotationTools: boolean
  preload: boolean
  user?: {
    name: string
    email: string
  }
}

function Viewer (props: ViewerProps): JSX.Element | null {
  const { clients, studyInstanceUID, location, navigate } = props
  const { slides, isLoading } = useSlides({ clients, studyInstanceUID })

  const handleSeriesSelection = ({ seriesInstanceUID }: { seriesInstanceUID: string }): void => {
    console.info(`switch to series "${seriesInstanceUID}"`)
    let urlPath = (
      `/studies/${studyInstanceUID}` +
      `/series/${seriesInstanceUID}`
    )

    if (location.pathname.includes('/projects/')) {
      urlPath = location.pathname
      if (!location.pathname.includes('/series/')) {
        urlPath += `/series/${seriesInstanceUID}`
      } else {
        urlPath = urlPath.replace(/\/series\/[^/]+/, `/series/${seriesInstanceUID}`)
      }
    }

    if (
      location.pathname.includes('/series/') &&
      location.search != null
    ) {
      urlPath += location.search
    }

    navigate(urlPath, { replace: true })
  }

  if (isLoading) {
    return null
  }

  if (slides.length === 0) {
    return null
  }

  const firstSlide = slides[0]
  const volumeInstances = firstSlide.volumeImages
  if (volumeInstances.length === 0) {
    return null
  }
  const refImage = volumeInstances[0]

  /* If a series is encoded in the path, route the viewer to this series.
   * Otherwise select the first series correspondent to
   * the first slide contained in the study.
   */
  let selectedSeriesInstanceUID: string
  if (location.pathname.includes('series/')) {
    const seriesFragment = location.pathname.split('series/')[1]
    selectedSeriesInstanceUID = seriesFragment.includes('/') ? seriesFragment.split('/')[0] : seriesFragment
  } else {
    selectedSeriesInstanceUID = volumeInstances[0].SeriesInstanceUID
  }

  let clinicalTrialMenu
  if (refImage.ClinicalTrialSponsorName != null) {
    clinicalTrialMenu = (
      <Menu.SubMenu key='clinical-trial' title='Clinical Trial'>
        <ClinicalTrial metadata={refImage} />
      </Menu.SubMenu>
    )
  }

  return (
    <Layout style={{ height: '100%' }} hasSider>
      <Layout.Sider
        width={300}
        style={{
          height: '100%',
          borderRight: 'solid',
          borderRightWidth: 0.25,
          overflow: 'hidden',
          background: 'none'
        }}
      >
        <Menu
          mode='inline'
          defaultOpenKeys={['patient', 'study', 'clinical-trial', 'slides']}
          style={{ height: '100%' }}
          inlineIndent={14}
        >
          <Menu.SubMenu key='patient' title='Patient'>
            <Patient metadata={refImage} />
          </Menu.SubMenu>
          <Menu.SubMenu key='study' title='Study'>
            <Study metadata={refImage} />
          </Menu.SubMenu>
          {clinicalTrialMenu}
          <Menu.SubMenu key='slides' title='Slides'>
            <SlideList
              clients={props.clients}
              metadata={slides}
              selectedSeriesInstanceUID={selectedSeriesInstanceUID}
              onSeriesSelection={handleSeriesSelection}
            />
          </Menu.SubMenu>
        </Menu>
      </Layout.Sider>

      <Routes>
        <Route
          path='/series/:seriesInstanceUID'
          element={
            <ParametrizedSlideViewer
              clients={props.clients}
              slides={slides}
              preload={props.preload}
              annotations={props.annotations}
              enableAnnotationTools={props.enableAnnotationTools}
              app={props.app}
              user={props.user}
            />
          }
        />
      </Routes>
    </Layout>
  )
}

export default withRouter(Viewer)
