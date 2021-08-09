import React from 'react'
import {
  Switch,
  Route,
  RouteComponentProps,
  withRouter
} from 'react-router-dom'
import {
  Layout,
  Menu
} from 'antd'

import * as dmv from 'dicom-microscopy-viewer'

import { AnnotationSettings, RendererSettings } from '../AppConfig'
import DicomWebManager from '../DicomWebManager'
import Patient from './Patient'
import Study from './Study'
import SlideList from './SlideList'
import SlideViewer from './SlideViewer'

import { Slide, createSlides } from '../data/slides'

interface ViewerProps extends RouteComponentProps {
  client: DicomWebManager
  studyInstanceUID: string
  app: {
    name: string
    version: string
    uid: string
    organization?: string
  }
  renderer: RendererSettings
  annotations: AnnotationSettings[]
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

  async componentDidMount (): Promise<void> {
    this.setState(state => ({ isLoading: true }))
    const imageMetadataPerSeries = await this.fetchImageMetadata()
    this.setState(state => ({
      slides: createSlides(imageMetadataPerSeries),
      isLoading: false
    }))
  }

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
      const loadingSeries = dmv.metadata.formatMetadata(s) as dmv.metadata.Series
      console.info(
        'search for instances in series ' +
        `"${loadingSeries.SeriesInstanceUID}"...`
      )
      const retrievedMetadata = await this.props.client.retrieveSeriesMetadata({
        studyInstanceUID: this.props.studyInstanceUID,
        seriesInstanceUID: loadingSeries.SeriesInstanceUID
      })

      const seriesImages: dmv.metadata.VLWholeSlideMicroscopyImage[] = []
      retrievedMetadata.forEach(item => {
        const image = dmv.metadata.formatMetadata(item) as dmv.metadata.VLWholeSlideMicroscopyImage
        if (image.SOPClassUID === '1.2.840.10008.5.1.4.1.1.77.1.6') {
          seriesImages.push(image)
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
    this.props.history.push(
      `/studies/${this.props.studyInstanceUID}/series/${seriesInstanceUID}`
    )
  }

  private getSelectedSeriesInstanceUIDFromUrl (): string {
    const fragments = this.props.location.pathname.split('/')
    return fragments[4]
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
    const studyMetadata = dmv.metadata.formatMetadata(
      volumeInstances[0]
    ) as dmv.metadata.Study

    /* If a series is encoded in the path, route the viewer to this series.
     * Otherwise select the first series correspondent to
     * the first slide contained in the study.
     */
    let selectedSeriesInstanceUID: string
    if (this.props.location.pathname.includes('series/')) {
      selectedSeriesInstanceUID = this.getSelectedSeriesInstanceUIDFromUrl()
    } else {
      selectedSeriesInstanceUID = volumeInstances[0].SeriesInstanceUID
    }

    return (
      <Layout style={{ height: '100%' }} hasSider>
        <Layout.Sider
          width={300}
          theme='light'
          style={{
            borderRight: 'solid',
            borderRightWidth: 0.25
          }}
        >
          <Menu
            mode='inline'
            defaultOpenKeys={['patient', 'case', 'slides']}
            style={{ height: '100%' }}
            inlineIndent={14}
            theme='light'
          >
            <Menu.SubMenu key='patient' title='Patient'>
              <Patient metadata={studyMetadata} />
            </Menu.SubMenu>
            <Menu.SubMenu key='case' title='Case'>
              <Study metadata={studyMetadata} />
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
            render={(routeProps) => (
              <SlideViewer
                client={this.props.client}
                renderer={this.props.renderer}
                studyInstanceUID={this.props.studyInstanceUID}
                seriesInstanceUID={routeProps.match.params.SeriesInstanceUID}
                slides={this.state.slides}
                annotations={this.props.annotations}
                app={this.props.app}
                user={this.props.user}
              />
            )}
          />
        </Switch>
      </Layout>
    )
  }
}

export default withRouter(Viewer)
