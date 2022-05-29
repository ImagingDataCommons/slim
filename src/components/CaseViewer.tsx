import React from 'react'
import {
  Switch,
  Route,
  RouteComponentProps,
  withRouter
} from 'react-router-dom'
import {
  Layout,
  message,
  Menu
} from 'antd'

import * as dmv from 'dicom-microscopy-viewer'

import { AnnotationSettings } from '../AppConfig'
import DicomWebManager from '../DicomWebManager'
import Patient from './Patient'
import Study from './Study'
import SlideList from './SlideList'
import SlideViewer from './SlideViewer'

import { Slide, createSlides } from '../data/slides'
import { SOPClassUIDs } from '../data/uids'

interface ViewerProps extends RouteComponentProps {
  client: DicomWebManager
  studyInstanceUID: string
  app: {
    name: string
    version: string
    uid: string
    organization?: string
  }
  annotations: AnnotationSettings[]
  enableAnnotationTools: boolean
  preload?: boolean
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
    isLoading: false
  }

  constructor (props: ViewerProps) {
    super(props)
    this.handleSeriesSelection = this.handleSeriesSelection.bind(this)
  }

  componentDidMount (): void {
    this.setState({ isLoading: true })
    this.fetchImageMetadata().then(
      (metadata: dmv.metadata.VLWholeSlideMicroscopyImage[][]) => {
        this.setState({
          slides: createSlides(metadata),
          isLoading: false
        })
      }
    ).catch((error) => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      message.error(
        'An error occured. ' +
          'Image metadata could not be retrieved or decoded.'
      )
      console.error(error)
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
    const matchedSeries = await this.props.client.searchForSeries({
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
      const retrievedMetadata = await this.props.client.retrieveSeriesMetadata({
        studyInstanceUID: this.props.studyInstanceUID,
        seriesInstanceUID: loadingSeries.SeriesInstanceUID
      })

      const seriesImages: dmv.metadata.VLWholeSlideMicroscopyImage[] = []
      retrievedMetadata.forEach((item, index) => {
        if (item['00080016'] !== undefined) {
          const sopClassUID = item['00080016'].Value[0]
          if (sopClassUID === SOPClassUIDs.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE) {
            const image = new dmv.metadata.VLWholeSlideMicroscopyImage({
              metadata: item
            })
            seriesImages.push(image)
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
      this.props.location.search
    ) {
      urlPath += this.props.location.search
    }
    this.props.history.push(urlPath)
  }

  render (): React.ReactNode {
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
            defaultOpenKeys={['patient', 'case', 'slides']}
            style={{ height: '100%' }}
            inlineIndent={14}
          >
            <Menu.SubMenu key='patient' title='Patient'>
              <Patient metadata={refImage} />
            </Menu.SubMenu>
            <Menu.SubMenu key='case' title='Case'>
              <Study metadata={refImage} />
            </Menu.SubMenu>
            <Menu.SubMenu key='slides' title='Slides'>
              <SlideList
                client={this.props.client}
                metadata={this.state.slides}
                selectedSeriesInstanceUID={selectedSeriesInstanceUID}
                onSeriesSelection={this.handleSeriesSelection}
              />
            </Menu.SubMenu>
          </Menu>
        </Layout.Sider>

        <Switch>
          <Route
            exact
            path='/studies/:StudyInstanceUID/series/:SeriesInstanceUID'
            render={(routeProps) => {
              const selectedSlide = this.state.slides.find((slide: Slide) => {
                return slide.seriesInstanceUIDs.find((uid: string) => {
                  return uid === routeProps.match.params.SeriesInstanceUID
                })
              })
              const params = new URLSearchParams(routeProps.location.search)
              let presentationStateUID: string|null|undefined = params.get(
                'state'
              )
              if (presentationStateUID === null) {
                presentationStateUID = undefined
              }
              let viewer = null
              if (selectedSlide != null) {
                viewer = (
                  <SlideViewer
                    client={this.props.client}
                    studyInstanceUID={this.props.studyInstanceUID}
                    seriesInstanceUID={routeProps.match.params.SeriesInstanceUID}
                    selectedPresentationStateUID={presentationStateUID}
                    slide={selectedSlide}
                    preload={this.props.preload}
                    annotations={this.props.annotations}
                    enableAnnotationTools={this.props.enableAnnotationTools}
                    app={this.props.app}
                    user={this.props.user}
                  />
                )
              }
              return viewer
            }}
          />
        </Switch>
      </Layout>
    )
  }
}

export default withRouter(Viewer)
