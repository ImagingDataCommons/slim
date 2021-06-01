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

import { AnnotationSettings } from '../AppConfig'
import DicomWebManager from '../DicomWebManager'
import Patient from './Patient'
import Study from './Study'
import SlideList from './SlideList'
import SlideViewer from './SlideViewer'

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
  user?: {
    name: string
    email: string
  }
}

interface ViewerState {
  seriesList: dmv.metadata.SeriesState[]
  isLoading: boolean
}

class Viewer extends React.Component<ViewerProps, ViewerState> {
  state = {
    seriesList: [],
    isLoading: false
  }

  constructor (props: ViewerProps) {
    super(props)
    this.handleSeriesSelection = this.handleSeriesSelection.bind(this)
  }

  async componentDidMount () {
    this.setState(state => ({ isLoading: true }))

    const seriesList = await this.fetchSeriesList()

    this.setState(state => ({
      seriesList: seriesList,
      isLoading: false
    }))
  }

  async fetchSeriesList () {
    const seriesList: dmv.metadata.SeriesState[] = []
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
          
      const volumeMetadata: object[] = []
      const labelMetadata: object[] = []
      const overviewMetadata: object[] = []
      retrievedMetadata.forEach(item => {
        const instance = dmv.metadata.formatMetadata(item) as dmv.metadata.Instance
        if (instance.ImageType !== undefined && 
            instance.SOPClassUID === '1.2.840.10008.5.1.4.1.1.77.1.6') {
          if (instance.ImageType[2] === 'VOLUME') {
            volumeMetadata.push(item)
          } else if (instance.ImageType[2] === 'LABEL') {
            labelMetadata.push(item)
          } else if (instance.ImageType[2] === 'OVERVIEW') {
            overviewMetadata.push(item)
          }
        }
      })

      const series: dmv.metadata.SeriesState = {
        Series: loadingSeries,
        VolumeMetadata: volumeMetadata,
        LabelMetadata: labelMetadata,
        OverviewMetadata: overviewMetadata
      }
      seriesList.push(series)   
    }));

    return seriesList
  }

  handleSeriesSelection (
    { seriesInstanceUID }: { seriesInstanceUID: string }
  ): void {
    console.info(`switch to series "${seriesInstanceUID}"`)
    this.props.history.push(
      `/studies/${this.props.studyInstanceUID}/series/${seriesInstanceUID}`
    )
  }

  render (): React.ReactNode {
    if (this.state.seriesList.length === 0) {
      return null
    }
    const firstSeriesState = this.state.seriesList[0] as dmv.metadata.SeriesState
    const studyMetadata = firstSeriesState.Series as dmv.metadata.Study

    /* If a series is encoded in the path, route the viewer to this series.
     * Otherwise select the first series contained in the study.
     */
    let selectedSeriesInstanceUID
    if (this.props.location.pathname.includes('series/')) {
      const fragments = this.props.location.pathname.split('/')
      selectedSeriesInstanceUID = fragments[4]
    } else {
      const seriesMetadata = firstSeriesState.Series as dmv.metadata.Series
      selectedSeriesInstanceUID = seriesMetadata.SeriesInstanceUID
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
                metadata={this.state.seriesList}
                initiallySelectedSeriesInstanceUID={selectedSeriesInstanceUID}
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
                studyInstanceUID={this.props.studyInstanceUID}
                seriesInstanceUID={routeProps.match.params.SeriesInstanceUID}
                metadata={this.state.seriesList}
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
