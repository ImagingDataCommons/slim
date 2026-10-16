import { type JSX, useCallback, useEffect, useState } from 'react'
import {
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router'

import type { AnnotationSettings } from '../AppConfig'
import type { User } from '../auth'
import { useStudySummary } from '../contexts/StudySummaryContext'
import type DicomWebManager from '../DicomWebManager'
import type { Slide } from '../data/slides'
import { StorageClasses } from '../data/uids'
import { ViewerLoadingLayout } from '../features/viewer/components/ViewerLoadingLayout'
import { ViewerMessage } from '../features/viewer/components/ViewerMessage'
import { ViewportLoadingIndicator } from '../features/viewer/components/ViewportLoadingIndicator'
import {
  resolvedSeriesInstanceUID,
  useRouteSlideResolution,
} from '../features/viewer/hooks/useRouteSlideResolution'
import { STUDY_PANEL_ID } from '../features/viewer/utils/panelIds'
import {
  presentationStateUIDFromSearch,
  selectedSeriesForStudyPath,
} from '../features/viewer/utils/routeSlide'
import {
  buildSeriesSelectionPath,
  defaultSeriesRedirectPath,
} from '../features/viewer/utils/seriesPath'
import { useSlides } from '../hooks/useSlides'
import { cn } from '../lib/utils'
import type { AppInfo } from '../utils/appInfo'
import { buildStudySummary } from '../utils/displayFormat'
import { logger } from '../utils/logger'
import { type RouteComponentProps, withRouter } from '../utils/router'
import { RoutePaths } from '../utils/routes'
import ClinicalTrial from './ClinicalTrial'
import Patient from './Patient'
import SlideList from './SlideList'
/** skipcq: JS-W1028 - SlideViewer has a default export */
import SlideViewer from './SlideViewer'
import Study from './Study'
import {
  CountBadge,
  PanelDivider,
  SlimCollapsibleSection,
} from './slim/SlimCollapsibleSection'

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
  const { selectedSlide, derivedDataset, unresolvedSeriesUID } =
    useRouteSlideResolution({
      clients,
      slides,
      studyInstanceUID,
      seriesInstanceUID,
      location,
      navigate,
    })

  const presentationStateUID = presentationStateUIDFromSearch(location.search)

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
    viewer = (
      <SlideViewer
        clients={clients}
        studyInstanceUID={studyInstanceUID}
        seriesInstanceUID={resolvedSeriesInstanceUID(
          selectedSlide,
          seriesInstanceUID,
        )}
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

  const defaultSeriesInstanceUID = summaryImage?.SeriesInstanceUID
  useEffect(() => {
    if (isLoading || error !== null) return
    const redirectPath = defaultSeriesRedirectPath({
      studyInstanceUID,
      defaultSeriesInstanceUID,
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    })
    if (redirectPath !== undefined) navigate(redirectPath, { replace: true })
  }, [
    isLoading,
    error,
    studyInstanceUID,
    defaultSeriesInstanceUID,
    location.pathname,
    location.search,
    location.hash,
    navigate,
  ])

  const handleSeriesSelection = ({
    seriesInstanceUID,
  }: {
    seriesInstanceUID: string
  }): void => {
    logger.log(`switch to series "${seriesInstanceUID}"`)
    navigate(
      buildSeriesSelectionPath({
        studyInstanceUID,
        seriesInstanceUID,
        pathname: location.pathname,
        search: location.search,
      }),
      { replace: true },
    )
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

  const selectedSeriesInstanceUID = selectedSeriesForStudyPath({
    slides,
    pathname: location.pathname,
    fallbackSeriesInstanceUID: volumeInstances[0].SeriesInstanceUID,
  })

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
            <span className="text-11 font-semibold uppercase leading-none tracking-[0.06em] text-ink-secondary">
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
