import { Layout, Menu, Select } from 'antd'
// skipcq: JS-C1003
import * as dcmjs from 'dcmjs'
// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { Route, Routes, useLocation, useParams } from 'react-router-dom'

import type { AnnotationSettings, VivSettings } from '../AppConfig'
import type { User } from '../auth'
import type DicomWebManager from '../DicomWebManager'
import type { Slide } from '../data/slides'
import { StorageClasses } from '../data/uids'
import { useSlides } from '../hooks/useSlides'
import DicomMetadataStore from '../services/DICOMMetadataStore'
import { type RouteComponentProps, withRouter } from '../utils/router'
import type { VivBulkAnnotationCatalogPayload } from '../viv/loadBulkAnnotationLayers'
import VivSlideViewport from '../viv/VivSlideViewport'
import AnnotationGroupList from './AnnotationGroupList'
import ClinicalTrial from './ClinicalTrial'
import Patient from './Patient'
import SlideList from './SlideList'
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
): Slide | undefined => {
  return slides.find((slide: Slide) => {
    return slide.seriesInstanceUIDs.find((uid: string) => {
      return uid === seriesInstanceUID
    })
  })
}

/** Viv path: main viewport + slim right rail (classic viewer uses ~300px sider). */
const vivChrome = (main: JSX.Element, rightPanel?: ReactNode): JSX.Element => (
  <div
    style={{
      display: 'flex',
      flex: '1 1 0%',
      minHeight: 0,
      minWidth: 0,
      width: '100%',
      height: '100%',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        flex: '1 1 0%',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {main}
    </div>
    <aside
      style={{
        width: 300,
        flexShrink: 0,
        borderLeft: 'solid 0.25px',
        padding: '10px 12px',
        fontSize: 12,
        color: 'rgba(0,0,0,0.55)',
        overflow: 'auto',
      }}
    >
      {rightPanel ?? (
        <span>Viv preview — classic slide tools are not wired here yet.</span>
      )}
    </aside>
  </div>
)

function ParametrizedSlideViewer({
  clients,
  slides,
  user,
  app,
  preload,
  enableAnnotationTools,
  annotations,
  useViv,
  vivSettings,
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
  useViv: boolean
  vivSettings?: VivSettings
}): JSX.Element | null {
  const { studyInstanceUID = '', seriesInstanceUID = '' } = useParams<{
    studyInstanceUID: string
    seriesInstanceUID: string
  }>()
  const location = useLocation()

  const [selectedSlide, setSelectedSlide] = useState(
    findSeriesSlide(slides, seriesInstanceUID),
  )
  const [derivedDataset, setDerivedDataset] =
    useState<NaturalizedInstance | null>(null)
  const [vivBulkCatalog, setVivBulkCatalog] =
    useState<VivBulkAnnotationCatalogPayload | null>(null)
  const [vivVisibleAnnotationGroupUIDs, setVivVisibleAnnotationGroupUIDs] =
    useState<Set<string>>(new Set())
  const [vivAnnotationGroupStyles, setVivAnnotationGroupStyles] = useState<
    Record<string, { opacity: number; color: number[] }>
  >({})
  const [vivAnnGroupSeriesSelection, setVivAnnGroupSeriesSelection] =
    useState<string>('all')

  const getVivSeriesDescription = (seriesInstanceUID: string): string => {
    const study = DicomMetadataStore.getStudy(studyInstanceUID)
    if (study?.series != null && study !== undefined) {
      const series = study.series.find(
        (s) => s.SeriesInstanceUID === seriesInstanceUID,
      )
      if (
        series?.SeriesDescription !== undefined &&
        series.SeriesDescription !== ''
      ) {
        return series.SeriesDescription
      }
    }
    return `Series ${seriesInstanceUID.slice(0, 8)}…`
  }

  const handleVivBulkCatalogChange = useCallback(
    (c: VivBulkAnnotationCatalogPayload | null) => {
      setVivBulkCatalog(c)
      if (c != null && c.annotationGroups.length > 0) {
        setVivAnnGroupSeriesSelection('all')
        setVivVisibleAnnotationGroupUIDs(new Set())
        setVivAnnotationGroupStyles({ ...c.defaultStylesByGroupUID })
      } else if (c != null) {
        setVivVisibleAnnotationGroupUIDs(new Set())
        setVivAnnotationGroupStyles({})
      } else {
        setVivVisibleAnnotationGroupUIDs(new Set())
        setVivAnnotationGroupStyles({})
        setVivAnnGroupSeriesSelection('all')
      }
    },
    [],
  )

  const handleVivAnnotationGroupVisibilityChange = useCallback(
    ({
      annotationGroupUID,
      isVisible,
    }: {
      annotationGroupUID: string
      isVisible: boolean
    }) => {
      setVivVisibleAnnotationGroupUIDs((prev) => {
        const next = new Set(prev)
        if (isVisible) {
          next.add(annotationGroupUID)
        } else {
          next.delete(annotationGroupUID)
        }
        return next
      })
    },
    [],
  )

  const handleVivAnnotationGroupStyleChange = useCallback(
    ({
      uid,
      styleOptions,
    }: {
      uid: string
      styleOptions: {
        opacity?: number
        color?: number[]
        measurement?: dcmjs.sr.coding.CodedConcept
        limitValues?: number[]
      }
    }) => {
      setVivAnnotationGroupStyles((prev) => {
        const base = prev[uid] ??
          vivBulkCatalog?.defaultStylesByGroupUID[uid] ?? {
            opacity: 1,
            color: [220, 60, 60],
          }
        return {
          ...prev,
          [uid]: {
            opacity: styleOptions.opacity ?? base.opacity,
            color: styleOptions.color ?? base.color,
          },
        }
      })
    },
    [vivBulkCatalog],
  )

  const handleVivAnnotationGroupSeriesSelect = useCallback((value: string) => {
    setVivVisibleAnnotationGroupUIDs(new Set())
    setVivAnnGroupSeriesSelection(value)
  }, [])

  const handleVivAnnotationGroupClick = useCallback((_uid: string) => {
    /* Viv preview: no VolumeImageViewer.zoomToROI equivalent yet */
  }, [])

  useEffect(() => {
    const currentSlideMatchesSeries =
      selectedSlide?.seriesInstanceUIDs.some(
        (uid: string) => uid === seriesInstanceUID,
      ) ?? false

    if (
      selectedSlide === null ||
      selectedSlide === undefined ||
      !currentSlideMatchesSeries
    ) {
      const imageSlide = findSeriesSlide(slides, seriesInstanceUID)
      if (imageSlide !== null && imageSlide !== undefined) {
        setSelectedSlide(imageSlide)
        setDerivedDataset(null)
        return
      }

      const findReferencedSlide = async (): Promise<void> => {
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
            const referencedImageSeriesUID = referencedSeries.SeriesInstanceUID
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
      }

      void findReferencedSlide()
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
    if (useViv) {
      const microscopyClient =
        clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE] ??
        clients.default
      if (microscopyClient === undefined) {
        return null
      }
      const bulkAnnotationClient =
        clients[StorageClasses.MICROSCOPY_BULK_SIMPLE_ANNOTATION] ??
        microscopyClient

      let vivAnnotationGroupListSection: ReactNode = null
      if (
        vivBulkCatalog != null &&
        vivBulkCatalog.annotationGroups.length > 0
      ) {
        const annotationGroups = vivBulkCatalog.annotationGroups
        const annotationGroupsBySeries: {
          [seriesInstanceUID: string]: dmv.annotation.AnnotationGroup[]
        } = {}
        for (const ag of annotationGroups) {
          const seriesUID = ag.seriesInstanceUID
          if (!(seriesUID in annotationGroupsBySeries)) {
            annotationGroupsBySeries[seriesUID] = []
          }
          annotationGroupsBySeries[seriesUID]?.push(ag)
        }
        const dropdownOptions = [
          { value: 'all', label: 'All' },
          ...Object.keys(annotationGroupsBySeries).map((seriesUID) => ({
            value: seriesUID,
            label: `${getVivSeriesDescription(seriesUID)} (${annotationGroupsBySeries[seriesUID]?.length ?? 0} groups)`,
          })),
        ]
        const selectedSeriesAnnotationGroups =
          vivAnnGroupSeriesSelection === 'all'
            ? annotationGroups
            : (annotationGroupsBySeries[vivAnnGroupSeriesSelection] ?? [])

        vivAnnotationGroupListSection = (
          <>
            <div
              style={{
                paddingLeft: '14px',
                paddingRight: '14px',
                paddingTop: '7px',
                paddingBottom: '7px',
              }}
            >
              <Select
                style={{ width: '100%' }}
                placeholder="Select a series"
                value={vivAnnGroupSeriesSelection}
                onChange={(v) => {
                  handleVivAnnotationGroupSeriesSelect(String(v))
                }}
                options={dropdownOptions}
              />
            </div>
            {selectedSeriesAnnotationGroups.length > 0 ? (
              <AnnotationGroupList
                annotationGroups={selectedSeriesAnnotationGroups}
                metadata={vivBulkCatalog.metadataByGroupUID}
                onAnnotationGroupClick={handleVivAnnotationGroupClick}
                defaultAnnotationGroupStyles={vivAnnotationGroupStyles}
                visibleAnnotationGroupUIDs={vivVisibleAnnotationGroupUIDs}
                onAnnotationGroupVisibilityChange={
                  handleVivAnnotationGroupVisibilityChange
                }
                onAnnotationGroupStyleChange={
                  handleVivAnnotationGroupStyleChange
                }
              />
            ) : null}
          </>
        )
      }

      const padSubmenuBlock = {
        paddingLeft: '14px' as const,
        paddingRight: '14px' as const,
        paddingTop: '7px' as const,
        paddingBottom: '7px' as const,
      }

      const vivAnnotationGroupPanel: ReactNode = (
        <Menu
          mode="inline"
          selectable={false}
          defaultOpenKeys={['annotation-groups']}
          inlineIndent={14}
          forceSubMenuRender
          style={{
            borderInlineEnd: 0,
            background: 'none',
            marginTop: 10,
          }}
        >
          <Menu.SubMenu key="annotation-groups" title="Annotation Groups">
            {vivBulkCatalog === null ? (
              <div style={padSubmenuBlock}>
                <p
                  style={{
                    fontSize: 11,
                    lineHeight: 1.45,
                    margin: 0,
                    color: 'rgba(0,0,0,0.75)',
                  }}
                >
                  Loading annotation metadata and geometry…
                </p>
              </div>
            ) : vivBulkCatalog.annotationGroups.length === 0 ? (
              <div style={padSubmenuBlock}>
                <p style={{ fontSize: 11, lineHeight: 1.45, margin: 0 }}>
                  No bulk annotation groups for this slide were returned (or all
                  were skipped). Filter the console with{' '}
                  <code style={{ fontSize: 10 }}>[Viv bulk ANN]</code> to see
                  why.
                </p>
              </div>
            ) : (
              vivAnnotationGroupListSection
            )}
          </Menu.SubMenu>
        </Menu>
      )

      viewer = vivChrome(
        <VivSlideViewport
          client={microscopyClient}
          bulkAnnotationClient={bulkAnnotationClient}
          loadBulkAnnotations
          visibleBulkAnnotationGroupUIDs={vivVisibleAnnotationGroupUIDs}
          bulkAnnotationGroupStyles={vivAnnotationGroupStyles}
          onBulkAnnotationCatalogChange={handleVivBulkCatalogChange}
          studyInstanceUID={studyInstanceUID}
          seriesInstanceUID={seriesInstanceUID}
          vivSettings={vivSettings}
        />,
        <div>
          <div
            style={{
              fontWeight: 600,
              marginBottom: 8,
              color: 'rgba(0,0,0,0.85)',
            }}
          >
            Viv Preview
          </div>
          <p style={{ marginBottom: 12 }}>
            Classic slide tools are not wired here yet.
          </p>
          {vivAnnotationGroupPanel}
        </div>,
      )
    } else {
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
  useViv: boolean
  vivSettings?: VivSettings
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
    let urlPath = `/studies/${studyInstanceUID}/series/${seriesInstanceUID}`

    if (location.pathname.includes('/projects/')) {
      urlPath = location.pathname
      if (!location.pathname.includes('/series/')) {
        urlPath += `/series/${seriesInstanceUID}`
      } else {
        urlPath = urlPath.replace(
          /\/series\/[^/]+/,
          `/series/${seriesInstanceUID}`,
        )
      }
    }

    if (
      location.pathname.includes('/series/') &&
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
  if (location.pathname.includes('series/')) {
    const seriesFragment = location.pathname.split('series/')[1]
    selectedSeriesInstanceUID = seriesFragment.includes('/')
      ? seriesFragment.split('/')[0]
      : seriesFragment
  } else {
    selectedSeriesInstanceUID = volumeInstances[0].SeriesInstanceUID
  }

  let clinicalTrialMenu: React.ReactNode
  if (refImage.ClinicalTrialSponsorName != null) {
    clinicalTrialMenu = (
      <Menu.SubMenu key="clinical-trial" title="Clinical Trial">
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
          background: 'none',
        }}
      >
        <Menu
          mode="inline"
          defaultOpenKeys={['patient', 'study', 'clinical-trial', 'slides']}
          style={{ height: '100%' }}
          inlineIndent={14}
        >
          <Menu.SubMenu key="patient" title="Patient">
            <Patient metadata={refImage} />
          </Menu.SubMenu>
          <Menu.SubMenu key="study" title="Study">
            <Study metadata={refImage} />
          </Menu.SubMenu>
          {clinicalTrialMenu}
          <Menu.SubMenu key="slides" title="Slides">
            <SlideList
              clients={props.clients}
              metadata={slides}
              selectedSeriesInstanceUID={selectedSeriesInstanceUID}
              onSeriesSelection={handleSeriesSelection}
            />
          </Menu.SubMenu>
        </Menu>
      </Layout.Sider>

      <Layout.Content
        style={{
          height: '100%',
          minHeight: 0,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Routes>
          <Route
            path="/series/:seriesInstanceUID"
            element={
              <ParametrizedSlideViewer
                clients={props.clients}
                slides={slides}
                preload={props.preload}
                annotations={props.annotations}
                enableAnnotationTools={props.enableAnnotationTools}
                app={props.app}
                user={props.user}
                useViv={props.useViv}
                vivSettings={props.vivSettings}
              />
            }
          />
        </Routes>
      </Layout.Content>
    </Layout>
  )
}

export default withRouter(Viewer)
