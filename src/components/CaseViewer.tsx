// skipcq: JS-C1003
import * as dcmjs from 'dcmjs'
import { useCallback, useEffect, useState } from 'react'
import {
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

import type { AnnotationSettings } from '../AppConfig'
import type { User } from '../auth'
import { useStudySummary } from '../contexts/StudySummaryContext'
import type DicomWebManager from '../DicomWebManager'
import type { Slide } from '../data/slides'
import { StorageClasses } from '../data/uids'
import { ViewerLoadingLayout } from '../features/viewer/components/ViewerLoadingLayout'
import { STUDY_PANEL_ID } from '../features/viewer/utils/panelIds'
import { useSlides } from '../hooks/useSlides'
import { cn } from '../lib/utils'
import { buildStudySummary } from '../utils/displayFormat'
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
import {
  CountBadge,
  PanelDivider,
  SlimCollapsibleSection,
} from './slim/SlimCollapsibleSection'

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
  enableMemoryMonitoring,
  annotations,
  isLeftPanelOpen,
  onToggleLeftPanel,
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
  enableMemoryMonitoring: boolean
  annotations: AnnotationSettings[]
  isLeftPanelOpen: boolean
  onToggleLeftPanel: () => void
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
        enableMemoryMonitoring={enableMemoryMonitoring}
        app={app}
        user={user}
        derivedDataset={derivedDataset ?? undefined}
        isLeftPanelOpen={isLeftPanelOpen}
        onToggleLeftPanel={onToggleLeftPanel}
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
  enableMemoryMonitoring: boolean
  preload: boolean
  user?: User
}

function Viewer(props: ViewerProps): JSX.Element | null {
  const { clients, studyInstanceUID, location, navigate } = props
  const { slides, isLoading } = useSlides({ clients, studyInstanceUID })
  const { setSummary } = useStudySummary()
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true)
  const toggleLeftPanel = useCallback(
    () => setIsLeftPanelOpen((isOpen) => !isOpen),
    [],
  )

  const summaryImage = slides[0]?.volumeImages[0]
  useEffect(() => {
    if (summaryImage === undefined) {
      setSummary(null)
      return
    }
    setSummary(buildStudySummary(summaryImage))
  }, [summaryImage, setSummary])
  useEffect(() => () => setSummary(null), [setSummary])

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
    return <ViewerLoadingLayout isLeftPanelOpen={isLeftPanelOpen} />
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

  /**
   * If a series is encoded in the path, route the viewer to this series.
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

  return (
    <div className="flex h-full min-h-0">
      <aside
        id={STUDY_PANEL_ID}
        aria-label="Study panel"
        className={cn(
          'flex min-h-0 w-sidebar flex-none flex-col border-r border-line bg-panel',
          !isLeftPanelOpen && 'hidden',
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <SlimCollapsibleSection title="Patient" padding="indent">
            <Patient metadata={refImage} />
          </SlimCollapsibleSection>
          <SlimCollapsibleSection title="Study" padding="indent">
            <Study metadata={refImage} />
          </SlimCollapsibleSection>
          {refImage.ClinicalTrialSponsorName != null && (
            <SlimCollapsibleSection
              title="Clinical trial"
              padding="indent"
              defaultOpen={false}
              divider={false}
            >
              <ClinicalTrial metadata={refImage} />
            </SlimCollapsibleSection>
          )}
          {refImage.ClinicalTrialSponsorName != null && (
            <PanelDivider className="mb-1" />
          )}

          <div className="flex items-center gap-2 px-4 pb-2.5 pt-3">
            <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.06em] text-ink-secondary">
              Slides
            </span>
            <CountBadge count={slides.length} />
          </div>
          <SlideList
            clients={props.clients}
            metadata={slides}
            selectedSeriesInstanceUID={selectedSeriesInstanceUID}
            onSeriesSelection={handleSeriesSelection}
          />
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 overflow-hidden">
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
                enableMemoryMonitoring={props.enableMemoryMonitoring}
                app={props.app}
                user={props.user}
                isLeftPanelOpen={isLeftPanelOpen}
                onToggleLeftPanel={toggleLeftPanel}
              />
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export default withRouter(Viewer)
