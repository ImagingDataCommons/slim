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
import SeriesList from './SeriesList'
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
  series: dmv.metadata.Series[]
  isLoading: boolean
}

class Viewer extends React.Component<ViewerProps, ViewerState> {
  state = {
    series: [],
    isLoading: false
  }

  constructor (props: ViewerProps) {
    super(props)
    this.handleSeriesSelection = this.handleSeriesSelection.bind(this)
  }

  componentDidMount (): void {
    const studyInstanceUID = this.props.studyInstanceUID
    console.info(`search for series of study "${studyInstanceUID}"...`)
    this.setState(state => ({ isLoading: true }))
    this.props.client.searchForSeries({
      queryParams: {
        Modality: 'SM',
        StudyInstanceUID: studyInstanceUID
      }
    }).then((matchedSeries): void => {
      matchedSeries.forEach(s => {
        const series = dmv.metadata.formatMetadata(s) as dmv.metadata.Series
        this.setState(state => ({
          series: [
            ...state.series,
            series
          ],
          isLoading: true
        }))
      })
      this.setState(state => ({ isLoading: false }))
    }).catch((error): void => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      message.error('Image metadata could not be loaded')
      console.error('search for image series failed: ', error)
    })
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
    if (this.state.series.length === 0) {
      return null
    }
    const studyMetadata = this.state.series[0] as dmv.metadata.Study

    /* If a series is encoded in the path, route the viewer to this series.
     * Otherwise select the first series contained in the study.
     */
    let selectedSeriesInstanceUID
    if (this.props.location.pathname.includes('series/')) {
      const fragments = this.props.location.pathname.split('/')
      selectedSeriesInstanceUID = fragments[4]
    } else {
      const seriesMetadata = this.state.series[0] as dmv.metadata.Series
      selectedSeriesInstanceUID = seriesMetadata.SeriesInstanceUID
    }

    return (
      <Layout style={{ height: '100%' }} hasSider>
        <Layout.Sider width={300} theme='light' style={{
          borderRight: 'solid',
          borderRightWidth: 0.5,
          borderRightColor: 'grey'
        }}>
          <Menu
            mode='inline'
            defaultOpenKeys={['patient', 'case', 'slides']}
            style={{ height: '100%' }}
            inlineIndent={14}
            theme='light'
          >
            <Menu.SubMenu key="patient" title="Patient">
              <Patient metadata={studyMetadata} />
            </Menu.SubMenu>
            <Menu.SubMenu key="case" title="Case">
              <Study metadata={studyMetadata} />
            </Menu.SubMenu>
            <Menu.SubMenu key="slides" title="Slides">
              <SeriesList
                client={this.props.client}
                metadata={this.state.series}
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
