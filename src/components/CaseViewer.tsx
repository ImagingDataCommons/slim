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
import { ViewerMessage } from '../features/viewer/components/ViewerMessage'
import { ViewportLoadingIndicator } from '../features/viewer/components/ViewportLoadingIndicator'
import { STUDY_PANEL_ID } from '../features/viewer/utils/panelIds'
import {
  isReferencingInstance,
  type ReferencingInstance,
  resolveReferencedSlide,
} from '../features/viewer/utils/referencedSlide'
import { useSlides } from '../hooks/useSlides'
import { cn } from '../lib/utils'
import type { AppInfo } from '../utils/appInfo'
import { buildStudySummary } from '../utils/displayFormat'
import { logger } from '../utils/logger'
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
  app: AppInfo
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
    useState<ReferencingInstance | null>(null)
  /** Series from the URL that resolved to no slide of this study */
  const [unresolvedSeriesUID, setUnresolvedSeriesUID] = useState<string | null>(
    null,
  )

  useEffect(() => {
    const currentSlideMatchesSeries =
      selectedSlide !== null &&
      selectedSlide !== undefined &&
      findSlideBySeriesInstanceUID([selectedSlide], seriesInstanceUID) ===
        selectedSlide

    if (
      selectedSlide !== null &&
      selectedSlide !== undefined &&
      currentSlideMatchesSeries
    ) {
      return
    }

    const imageSlide = findSeriesSlide(slides, seriesInstanceUID)
    if (imageSlide !== null && imageSlide !== undefined) {
      const resolvedSeriesUID = seriesUidFromSlide(
        imageSlide,
        seriesInstanceUID,
      )
      setSelectedSlide(imageSlide)
      setDerivedDataset(null)
      setUnresolvedSeriesUID(null)
      if (resolvedSeriesUID !== seriesInstanceUID) {
        logger.warn(
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

    /** Set on cleanup so a superseded lookup cannot select a stale slide */
    let isCancelled = false
    const findReferencedSlide = async (): Promise<void> => {
      try {
        const client = clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]
        const derivedSeriesMetadata = await client.retrieveSeriesMetadata({
          studyInstanceUID,
          seriesInstanceUID,
        })
        if (isCancelled) return
        const naturalizedDerivedMetadata = naturalizeDataset(
          derivedSeriesMetadata[0],
        )
        if (isReferencingInstance(naturalizedDerivedMetadata)) {
          const referencedSlide = resolveReferencedSlide(
            slides,
            naturalizedDerivedMetadata,
          )
          if (referencedSlide !== undefined) {
            setSelectedSlide(referencedSlide)
            setDerivedDataset(naturalizedDerivedMetadata)
            setUnresolvedSeriesUID(null)
            return
          }
        }
        setUnresolvedSeriesUID(seriesInstanceUID)
      } catch (error) {
        if (isCancelled) return
        logger.warn(
          `Failed to resolve referenced slide for series "${seriesInstanceUID}"`,
          error,
        )
        setUnresolvedSeriesUID(seriesInstanceUID)
      }
    }

    // skipcq: JS-0098 - void operator intentionally discards the Promise
    void findReferencedSlide()
    return () => {
      isCancelled = true
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

  if (unresolvedSeriesUID === seriesInstanceUID) {
    return (
      <ViewerMessage
        status="warning"
        title="Series not found"
        description={
          `Series ${seriesInstanceUID} is not a slide in this study, and no ` +
          'slide it refers to could be found. Pick a slide from the list.'
        }
      />
    )
  }

  let viewer = (
    <div className="relative h-full w-full bg-viewport">
      <ViewportLoadingIndicator isVisible label="Loading series" />
    </div>
  )
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
  app: AppInfo
  annotations: AnnotationSettings[]
  enableAnnotationTools: boolean
  enableMemoryMonitoring: boolean
  preload: boolean
  user?: User
}

function Viewer(props: ViewerProps): JSX.Element | null {
  const { clients, studyInstanceUID, location, navigate } = props
  const { slides, isLoading, error, retry } = useSlides({
    clients,
    studyInstanceUID,
  })
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

  const serverUrl =
    clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]?.baseURL
  const serverName =
    serverUrl != null && serverUrl !== '' ? serverUrl : 'the server'

  const handleSeriesSelection = ({
    seriesInstanceUID,
  }: {
    seriesInstanceUID: string
  }): void => {
    logger.log(`switch to series "${seriesInstanceUID}"`)
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

  if (error !== null) {
    return (
      <ViewerMessage
        status="error"
        title="Couldn't load this study"
        description={
          `The request to ${serverName} failed. Check that the server is ` +
          'reachable and that you have access to it, then try again.'
        }
        onRetry={retry}
      />
    )
  }

  const volumeInstances = slides[0]?.volumeImages ?? []
  if (volumeInstances.length === 0) {
    return (
      <ViewerMessage
        status="warning"
        title="No slides found"
        description={
          `Study ${studyInstanceUID} has no slide microscopy (SM) images on ` +
          `${serverName}. Check the study UID in the URL, or select the ` +
          'server that holds this study.'
        }
        onRetry={retry}
      />
    )
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
            <>
              <SlimCollapsibleSection
                title="Clinical trial"
                padding="indent"
                defaultOpen={false}
                divider={false}
              >
                <ClinicalTrial metadata={refImage} />
              </SlimCollapsibleSection>
              <PanelDivider className="mb-1" />
            </>
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
