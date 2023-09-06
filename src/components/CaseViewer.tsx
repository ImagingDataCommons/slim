import React from 'react'
import { Routes, Route, useLocation, useParams } from 'react-router-dom'
import { Layout, Menu } from 'antd'

import * as dmv from 'dicom-microscopy-viewer'

import { AnnotationSettings } from '../AppConfig'
import ClinicalTrial from './ClinicalTrial'
import DicomWebManager from '../DicomWebManager'
import Patient from './Patient'
import Study from './Study'
import SlideList from './SlideList'
import SlideViewer from './SlideViewer'

import { User } from '../auth'
import { Slide, createSlides } from '../data/slides'
import { StorageClasses } from '../data/uids'
import { RouteComponentProps, withRouter } from '../utils/router'
import { CustomError, errorTypes } from '../utils/CustomError'
import NotificationMiddleware, {
  NotificationMiddlewareContext
} from '../services/NotificationMiddleware'

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
  const { studyInstanceUID, seriesInstanceUID } = useParams()
  const location = useLocation()

  const selectedSlide = slides.find((slide: Slide) => {
    return slide.seriesInstanceUIDs.find((uid: string) => {
      return uid === seriesInstanceUID
    })
  })
  const searchParams = new URLSearchParams(location.search)
  let presentationStateUID: string | null | undefined
  if (!searchParams.has('access_token')) {
    presentationStateUID = searchParams.get('state')
    if (presentationStateUID === null) {
      presentationStateUID = undefined
    }
  }
  let viewer = null
  if (selectedSlide != null) {
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

interface ViewerState {
  slides: Slide[]
  isLoading: boolean
}

class Viewer extends React.Component<ViewerProps, ViewerState> {
  state = {
    slides: [],
    isLoading: true
  }

  constructor (props: ViewerProps) {
    super(props)
    this.handleSeriesSelection = this.handleSeriesSelection.bind(this)
  }

  componentDidMount (): void {
    this.fetchImageMetadata().then(
      (metadata: dmv.metadata.VLWholeSlideMicroscopyImage[][]) => {
        this.setState({
          slides: createSlides(metadata),
          isLoading: false
        })
      }
    ).catch((error) => {
      console.error(error)
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.ENCODINGANDDECODING,
          'Image metadata could not be retrieved or decoded.')
      )
      this.setState({ isLoading: false })
    })
  }

  /**
   * Fetch metadata for VL Whole Slide Microscopy Image instances of the study.
   *
   * @returns Metadata of image instances of the study grouped per series
   */
  async fetchImageMetadata (): Promise<dmv.metadata.VLWholeSlideMicroscopyImage[][]> {
    const images: dmv.metadata.VLWholeSlideMicroscopyImage[][] = []
    const studyInstanceUID = this.props.studyInstanceUID
    console.info(`search for series of study "${studyInstanceUID}"...`)
    const client = this.props.clients[
      StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE
    ]
    const matchedSeries = await client.searchForSeries({
      queryParams: {
        Modality: 'SM',
        StudyInstanceUID: studyInstanceUID
      }
    })

    await Promise.all(matchedSeries.map(async (s) => {
      const { dataset } = dmv.metadata.formatMetadata(s)
      const loadingSeries = dataset as dmv.metadata.Series
      console.info(
        `retrieve metadata of series "${loadingSeries.SeriesInstanceUID}"`
      )
      const retrievedMetadata = await client.retrieveSeriesMetadata({
        studyInstanceUID: this.props.studyInstanceUID,
        seriesInstanceUID: loadingSeries.SeriesInstanceUID
      })

      const seriesImages: dmv.metadata.VLWholeSlideMicroscopyImage[] = []
      retrievedMetadata.forEach((item, index) => {
        if (item['00080016'] != null) {
          const values = item['00080016'].Value
          if (values != null) {
            const sopClassUID = values[0]
            if (sopClassUID === StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE) {
              const image = new dmv.metadata.VLWholeSlideMicroscopyImage({
                metadata: item
              })
              seriesImages.push(image)
            }
          }
        }
      })

      if (seriesImages.length > 0) {
        images.push(seriesImages)
      }
    }))

    return images
  }

  handleSeriesSelection (
    { seriesInstanceUID }: { seriesInstanceUID: string }
  ): void {
    console.info(`switch to series "${seriesInstanceUID}"`)
    let urlPath = (
      `/studies/${this.props.studyInstanceUID}` +
      `/series/${seriesInstanceUID}`
    )
    if (
      this.props.location.pathname.includes('/series/') &&
      this.props.location.search != null
    ) {
      urlPath += this.props.location.search
    }
    this.props.navigate(urlPath, { replace: true })
  }

  render (): React.ReactNode {
    if (this.state.isLoading) {
      return null
    }

    if (this.state.slides.length === 0) {
      return null
    }
    const firstSlide = this.state.slides[0] as Slide
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
    if (this.props.location.pathname.includes('series/')) {
      const fragments = this.props.location.pathname.split('/')
      selectedSeriesInstanceUID = fragments[4]
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
                clients={this.props.clients}
                metadata={this.state.slides}
                selectedSeriesInstanceUID={selectedSeriesInstanceUID}
                onSeriesSelection={this.handleSeriesSelection}
              />
            </Menu.SubMenu>
          </Menu>
        </Layout.Sider>

        <Routes>
          <Route
            path='/series/:seriesInstanceUID'
            element={
              <ParametrizedSlideViewer
                clients={this.props.clients}
                slides={this.state.slides}
                preload={this.props.preload}
                annotations={this.props.annotations}
                enableAnnotationTools={this.props.enableAnnotationTools}
                app={this.props.app}
                user={this.props.user}
              />
            }
          />
        </Routes>
      </Layout>
    )
  }
}

export default withRouter(Viewer)
