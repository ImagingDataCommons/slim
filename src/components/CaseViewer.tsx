import { type JSX, useEffect } from 'react'
import { Route, Routes, useLocation, useParams } from 'react-router'

import type { AnnotationSettings } from '../AppConfig'
import type { User } from '../auth'
import { useStudySummary } from '../contexts/StudySummaryContext'
import type DicomWebManager from '../DicomWebManager'
import { StorageClasses } from '../data/uids'
import { OverlayPanel } from '../features/viewer/components/OverlayPanel'
import { ViewerLoadingLayout } from '../features/viewer/components/ViewerLoadingLayout'
import { ViewerMessage } from '../features/viewer/components/ViewerMessage'
import { ViewportLoadingIndicator } from '../features/viewer/components/ViewportLoadingIndicator'
import {
  useViewerPanelChrome,
  ViewerPanelChromeProvider,
} from '../features/viewer/contexts/ViewerPanelChromeContext'
import { useCaseViewerRouting } from '../features/viewer/hooks/useCaseViewerRouting'
import {
  type RouteSlideResolution,
  resolvedSeriesInstanceUID,
  useRouteSlideResolution,
} from '../features/viewer/hooks/useRouteSlideResolution'
import { presentationStateUIDFromSearch } from '../features/viewer/utils/routeSlide'
import { useSlides } from '../hooks/useSlides'
import type { AppInfo } from '../utils/appInfo'
import { buildStudySummary } from '../utils/displayFormat'
import { type RouteComponentProps, withRouter } from '../utils/router'
import { parseSeriesInstanceUID, RoutePaths } from '../utils/routes'
import { StudySidePanel } from './CaseViewer/StudySidePanel'
/** skipcq: JS-W1028 - SlideViewer has a default export */
import SlideViewer from './SlideViewer'

function ParametrizedSlideViewer({
  clients,
  user,
  app,
  preload,
  enableAnnotationTools,
  enableMemoryMonitoring,
  annotations,
  isLeftPanelOpen,
  onToggleLeftPanel,
  seriesInstanceUID,
  resolution,
}: {
  /** Series UID of the route, as the resolution read it */
  seriesInstanceUID: string
  /** Slide of the series route, resolved where the slide list reads it too */
  resolution: RouteSlideResolution
  clients: { [key: string]: DicomWebManager }
  user?: User
  app: AppInfo
  preload: boolean
  enableAnnotationTools: boolean
  enableMemoryMonitoring: boolean
  annotations: AnnotationSettings[]
  isLeftPanelOpen: boolean
  onToggleLeftPanel: () => void
}): JSX.Element | null {
  const { studyInstanceUID = '' } = useParams<{ studyInstanceUID: string }>()
  const location = useLocation()
  const { selectedSlide, derivedDataset, unresolvedSeriesUID } = resolution

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
  return (
    <ViewerPanelChromeProvider>
      <ViewerBody {...props} />
    </ViewerPanelChromeProvider>
  )
}

function ViewerBody(props: ViewerProps): JSX.Element | null {
  const { clients, studyInstanceUID, location, navigate } = props
  const { slides, isLoading, error, retry } = useSlides({
    clients,
    studyInstanceUID,
  })
  const { setSummary } = useStudySummary()
  const routeSeriesInstanceUID = parseSeriesInstanceUID(location.pathname)
  const resolution = useRouteSlideResolution({
    clients,
    slides,
    studyInstanceUID,
    seriesInstanceUID: routeSeriesInstanceUID,
    location,
    navigate,
  })
  const chrome = useViewerPanelChrome()

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
  const { handleSeriesSelection } = useCaseViewerRouting({
    isLoading,
    error,
    studyInstanceUID,
    defaultSeriesInstanceUID,
    location,
    navigate,
  })

  const handleStudySeriesSelection = (change: {
    seriesInstanceUID: string
  }): void => {
    handleSeriesSelection(change)
    if (chrome.overlayPanels) chrome.closeLeftPanel()
  }

  if (isLoading) {
    return (
      <ViewerLoadingLayout
        isLeftPanelOpen={chrome.isLeftPanelOpen}
        overlayPanels={chrome.overlayPanels}
      />
    )
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
   * The slide list highlights the series resolved for the route: none while
   * a derived series is looked up or when it is not found
   */
  const selectedSeriesInstanceUID =
    resolution.shownSeriesInstanceUID ??
    (routeSeriesInstanceUID !== ''
      ? routeSeriesInstanceUID
      : volumeInstances[0].SeriesInstanceUID)

  const studyPanel = (
    <StudySidePanel
      isOpen={chrome.overlayPanels || chrome.isLeftPanelOpen}
      clients={props.clients}
      slides={slides}
      refImage={refImage}
      selectedSeriesInstanceUID={selectedSeriesInstanceUID}
      onSeriesSelection={handleStudySeriesSelection}
      className={
        chrome.overlayPanels ? 'min-h-0 w-full flex-1 border-0' : undefined
      }
    />
  )

  return (
    <div className="flex h-full min-h-0">
      {chrome.overlayPanels ? (
        <OverlayPanel
          open={chrome.isLeftPanelOpen}
          onOpenChange={(open) =>
            open ? chrome.setLeftPanelOpen(true) : chrome.closeLeftPanel()
          }
          side="left"
          title="Study"
        >
          {studyPanel}
        </OverlayPanel>
      ) : (
        studyPanel
      )}

      <main className="flex min-w-0 flex-1 overflow-hidden">
        <Routes>
          <Route
            path={RoutePaths.SERIES}
            element={
              <ParametrizedSlideViewer
                clients={props.clients}
                preload={props.preload}
                annotations={props.annotations}
                enableAnnotationTools={props.enableAnnotationTools}
                enableMemoryMonitoring={props.enableMemoryMonitoring}
                app={props.app}
                user={props.user}
                isLeftPanelOpen={chrome.isLeftPanelOpen}
                onToggleLeftPanel={chrome.toggleLeftPanel}
                seriesInstanceUID={routeSeriesInstanceUID}
                resolution={resolution}
              />
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export default withRouter(Viewer)
