import type { MenuProps } from 'antd'
import { Layout, Menu } from 'antd'
// skipcq: JS-C1003
import * as dcmjs from 'dcmjs'
import { useEffect, useState } from 'react'
import {
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

import type { AnnotationSettings } from '../AppConfig'
import type { User } from '../auth'
import type DicomWebManager from '../DicomWebManager'
import type { Slide } from '../data/slides'
import { StorageClasses } from '../data/uids'
import { useSlides } from '../hooks/useSlides'
import {
  findSlideBySeriesInstanceUID,
  seriesUidFromSlide,
} from '../utils/recoverSeriesInstanceUID'
import { type RouteComponentProps, withRouter } from '../utils/router'
import {
  buildSeriesPath,
  hasSeriesInPath,
  isProjectsPath,
  parseSeriesInstanceUID,
  RoutePaths,
  withSeriesInProjectPath,
} from '../utils/routes'
import ClinicalTrial from './ClinicalTrial'
import Patient from './Patient'
import SlideList from './SlideList'
// skipcq: JS-W1028 - SlideViewer has a default export
import SlideViewer from './SlideViewer'
import Study from './Study'

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

const findSeriesSlide = (
  slides: Slide[],
  seriesInstanceUID: string,
): Slide | undefined => findSlideBySeriesInstanceUID(slides, seriesInstanceUID)

function ParametrizedSlideViewer({
  clients,
  slides,
  user,
  app,
  preload,
  enableAnnotationTools,
  annotations,
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
  const { studyInstanceUID = '', seriesInstanceUID = '' } = useParams<{
    studyInstanceUID: string
    seriesInstanceUID: string
  }>()
  const location = useLocation()
  const navigate = useNavigate()

  const [selectedSlide, setSelectedSlide] = useState(
    findSeriesSlide(slides, seriesInstanceUID),
  )
  const [derivedDataset, setDerivedDataset] =
    useState<NaturalizedInstance | null>(null)

  useEffect(() => {
    const currentSlideMatchesSeries =
      selectedSlide !== null &&
      selectedSlide !== undefined &&
      findSlideBySeriesInstanceUID([selectedSlide], seriesInstanceUID) ===
        selectedSlide

    if (
      selectedSlide === null ||
      selectedSlide === undefined ||
      !currentSlideMatchesSeries
    ) {
      const imageSlide = findSeriesSlide(slides, seriesInstanceUID)
      if (imageSlide !== null && imageSlide !== undefined) {
        const resolvedSeriesUID = seriesUidFromSlide(
          imageSlide,
          seriesInstanceUID,
        )
        setSelectedSlide(imageSlide)
        setDerivedDataset(null)
        if (resolvedSeriesUID !== seriesInstanceUID) {
          console.warn(
            `Corrected mangled series UID in route: "${seriesInstanceUID}" → "${resolvedSeriesUID}"`,
          )
          navigate(
            {
              pathname: location.pathname.replace(
                `/series/${seriesInstanceUID}`,
                `/series/${resolvedSeriesUID}`,
              ),
              search: location.search,
            },
            { replace: true },
          )
        }
        return
      }

      const findReferencedSlide = async (): Promise<void> => {
        try {
          const client = clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]
          const derivedSeriesMetadata = await client.retrieveSeriesMetadata({
            studyInstanceUID,
            seriesInstanceUID,
          })
          const naturalizedDerivedMetadata = naturalizeDataset(
            derivedSeriesMetadata[0],
          ) as NaturalizedInstance
          if (
            naturalizedDerivedMetadata.ReferencedSeriesSequence != null &&
            naturalizedDerivedMetadata.ReferencedSeriesSequence.length > 0
          ) {
            for (const referencedSeries of naturalizedDerivedMetadata.ReferencedSeriesSequence) {
              const referencedImageSeriesUID =
                referencedSeries.SeriesInstanceUID
              const referencedSlide = slides.find((slide: Slide) => {
                return slide.seriesInstanceUIDs.some(
                  (uid: string) => uid === referencedImageSeriesUID,
                )
              })
              if (referencedSlide !== null && referencedSlide !== undefined) {
                setSelectedSlide(referencedSlide)
                setDerivedDataset(naturalizedDerivedMetadata)
                return
              }
            }
          }
          const IMAGE_LIBRARY_CONCEPT_NAME_CODE = '111028'
          const imageLibrary = naturalizedDerivedMetadata.ContentSequence?.find(
            (contentItem) =>
              contentItem.ConceptNameCodeSequence[0].CodeValue ===
              IMAGE_LIBRARY_CONCEPT_NAME_CODE,
          )
          if (
            imageLibrary?.ContentSequence?.[0]?.ContentSequence?.[0]
              ?.ReferencedSOPSequence?.[0] !== undefined &&
            imageLibrary?.ContentSequence?.[0]?.ContentSequence?.[0]
              ?.ReferencedSOPSequence?.[0] !== null
          ) {
            const referencedSOPInstanceUID =
              imageLibrary.ContentSequence[0].ContentSequence[0]
                .ReferencedSOPSequence[0].ReferencedSOPInstanceUID
            const referencedSlide = slides.find((slide: Slide) => {
              return slide.volumeImages.find(
                (image: { SOPInstanceUID: string }) => {
                  return image.SOPInstanceUID === referencedSOPInstanceUID
                },
              )
            })
            setSelectedSlide(referencedSlide)
            setDerivedDataset(naturalizedDerivedMetadata)
          }
        } catch (error) {
          console.warn(
            `Failed to resolve referenced slide for series "${seriesInstanceUID}"`,
            error,
          )
        }
      }

      // skipcq: JS-0098 - void operator intentionally discards the Promise
      void findReferencedSlide()
    }
  }, [
    slides,
    clients,
    studyInstanceUID,
    seriesInstanceUID,
    selectedSlide,
    navigate,
    location.pathname,
    location.search,
  ])

  const searchParams = new URLSearchParams(location.search)
  let presentationStateUID: string | undefined
  if (!searchParams.has('access_token')) {
    const stateParam = searchParams.get('state')
    presentationStateUID = stateParam !== null ? stateParam : undefined
  }

  let viewer = null
  if (selectedSlide != null && selectedSlide !== undefined) {
    const resolvedSeriesInstanceUID = seriesUidFromSlide(
      selectedSlide,
      seriesInstanceUID,
    )
    viewer = (
      <SlideViewer
        clients={clients}
        studyInstanceUID={studyInstanceUID}
        seriesInstanceUID={resolvedSeriesInstanceUID}
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
  user?: User
}

function Viewer(props: ViewerProps): JSX.Element | null {
  const { clients, studyInstanceUID, location, navigate } = props
  const { slides, isLoading } = useSlides({ clients, studyInstanceUID })

  const handleSeriesSelection = ({
    seriesInstanceUID,
  }: {
    seriesInstanceUID: string
  }): void => {
    console.info(`switch to series "${seriesInstanceUID}"`)
    let urlPath = buildSeriesPath(studyInstanceUID, seriesInstanceUID)

    if (isProjectsPath(location.pathname)) {
      urlPath = withSeriesInProjectPath(location.pathname, seriesInstanceUID)
    }

    if (
      hasSeriesInPath(location.pathname) &&
      location.search !== null &&
      location.search !== undefined
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
  const seriesFromPath = parseSeriesInstanceUID(location.pathname)
  if (seriesFromPath !== '') {
    const slideForPath = findSeriesSlide(slides, seriesFromPath)
    selectedSeriesInstanceUID =
      slideForPath !== undefined
        ? seriesUidFromSlide(slideForPath, seriesFromPath)
        : seriesFromPath
  } else {
    selectedSeriesInstanceUID = volumeInstances[0].SeriesInstanceUID
  }

  const siderMenuItems: MenuProps['items'] = [
    {
      key: 'patient',
      label: 'Patient',
      children: [
        {
          key: 'patient-info',
          style: { cursor: 'default', height: 'auto' },
          label: <Patient metadata={refImage} />,
        },
      ],
    },
    {
      key: 'study',
      label: 'Study',
      children: [
        {
          key: 'study-info',
          style: { cursor: 'default', height: 'auto' },
          label: <Study metadata={refImage} />,
        },
      ],
    },
    ...(refImage.ClinicalTrialSponsorName != null
      ? [
          {
            key: 'clinical-trial',
            label: 'Clinical Trial',
            children: [
              {
                key: 'clinical-trial-info',
                style: { cursor: 'default', height: 'auto' },
                label: <ClinicalTrial metadata={refImage} />,
              },
            ],
          },
        ]
      : []),
  ]

  return (
    <Layout style={{ height: '100%', minHeight: 0 }} hasSider>
      <Layout.Sider
        width={300}
        style={{
          height: '100%',
          borderRight: 'solid',
          borderRightWidth: 0.25,
          overflow: 'auto',
          background: 'none',
        }}
      >
        <Menu
          mode="inline"
          defaultOpenKeys={['patient', 'study', 'clinical-trial']}
          style={{ borderInlineEnd: 'none' }}
          inlineIndent={14}
          selectable={false}
          items={siderMenuItems}
        />
        <div
          style={{
            padding: '8px 14px',
            fontWeight: 600,
          }}
        >
          Slides
        </div>
        <SlideList
          clients={props.clients}
          metadata={slides}
          selectedSeriesInstanceUID={selectedSeriesInstanceUID}
          onSeriesSelection={handleSeriesSelection}
        />
      </Layout.Sider>

      <Routes>
        <Route
          path={RoutePaths.SERIES}
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
