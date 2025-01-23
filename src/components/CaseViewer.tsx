import { Routes, Route, useLocation, useParams } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import * as dcmjs from 'dcmjs'
import * as dmv from 'dicom-microscopy-viewer'
import { useEffect, useState } from 'react'

import { AnnotationSettings } from '../AppConfig'
import ClinicalTrial from './ClinicalTrial'
import DicomWebManager from '../DicomWebManager'
import Patient from './Patient'
import Study from './Study'
import SlideList from './SlideList'
import SlideViewer from './SlideViewer'

import { User } from '../auth'
import { Slide } from '../data/slides'
import { RouteComponentProps, withRouter } from '../utils/router'
import { useSlides } from '../hooks/useSlides'
import { StorageClasses } from '../data/uids'

const { naturalizeDataset } = dcmjs.data.DicomMetaDictionary

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
  const [selectedSlide, setSelectedSlide] = useState(slides.find((slide: Slide) => {
    return slide.seriesInstanceUIDs.find((uid: string) => {
      return uid === seriesInstanceUID
    })
  }))
  const [derivedDataset, setDerivedDataset] = useState(null)

  useEffect(() => {
    const findReferencedSlide = async () => {
      const client = clients[StorageClasses.COMPREHENSIVE_3D_SR]
      const rawInstances = await client.searchForInstances({
        studyInstanceUID: studyInstanceUID,
        queryParams: { Modality: 'SR' }
      })
      const naturalizedInstancesMetadata = rawInstances.map((i) => naturalizeDataset(i)) 
      // @ts-expect-error
      const naturalizedInstances = await Promise.all(naturalizedInstancesMetadata.map(async (im: { SeriesInstanceUID: string; SOPInstanceUID: string }) => {
        const retrievedInstance = await client.retrieveInstance({
          // @ts-expect-error
          studyInstanceUID: studyInstanceUID,
          seriesInstanceUID: im.SeriesInstanceUID,
          sopInstanceUID: im.SOPInstanceUID
        })
        const data = dcmjs.data.DicomMessage.readFile(retrievedInstance)
        const { dataset } = dmv.metadata.formatMetadata(data.dict)
        return dataset
      }))
      const IMAGE_LIBRARY_CONCEPT_NAME_CODE = '111028'
      // @ts-expect-error
      const imageLibrary = naturalizedInstances[0].ContentSequence.find(
        // @ts-expect-error
        contentItem => contentItem.ConceptNameCodeSequence[0].CodeValue === IMAGE_LIBRARY_CONCEPT_NAME_CODE
      );
      const referecedSOPInstanceUID = imageLibrary.ContentSequence[0].ContentSequence[0].ReferencedSOPSequence[0].ReferencedSOPInstanceUID
      const referencedSlide = slides.find((slide: Slide) => {
        return slide.volumeImages.find((image: { SOPInstanceUID: string }) => {
          return image.SOPInstanceUID === referecedSOPInstanceUID
        })
      })
      setSelectedSlide(referencedSlide)
      // @ts-expect-error
      setDerivedDataset(naturalizedInstances[0])
    }
    if (selectedSlide == null) {
      findReferencedSlide()
    }
  }, [slides, studyInstanceUID, seriesInstanceUID])

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
        derivedDataset={derivedDataset}
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

function Viewer (props: ViewerProps): JSX.Element | null {
  const { clients, studyInstanceUID, location, navigate } = props
  const { slides, isLoading } = useSlides({ clients, studyInstanceUID })

  const handleSeriesSelection = ({ seriesInstanceUID }: { seriesInstanceUID: string }): void => {
    console.info(`switch to series "${seriesInstanceUID}"`)
    let urlPath = (
      `/studies/${studyInstanceUID}` +
      `/series/${seriesInstanceUID}`
    )

    if (location.pathname.includes('/projects/')) {
      urlPath = location.pathname
      if (!location.pathname.includes('/series/')) {
        urlPath += `/series/${seriesInstanceUID}`
      } else {
        urlPath = urlPath.replace(/\/series\/[^/]+/, `/series/${seriesInstanceUID}`)
      }
    }

    if (
      location.pathname.includes('/series/') &&
      location.search != null
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
    selectedSeriesInstanceUID = seriesFragment.includes('/') ? seriesFragment.split('/')[0] : seriesFragment
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
              clients={props.clients}
              metadata={slides}
              selectedSeriesInstanceUID={selectedSeriesInstanceUID}
              onSeriesSelection={handleSeriesSelection}
            />
          </Menu.SubMenu>
        </Menu>
      </Layout.Sider>

      <Routes>
        <Route
          path='/series/:seriesInstanceUID'
          element={
            <ParametrizedSlideViewer
              clients={props.clients}
              slides={slides}
              preload={props.preload}
              annotations={props.annotations}
              enableAnnotationTools={props.enableAnnotationTools}
              app={props.app}
              user={props.user}
            />
          }
        />
      </Routes>
    </Layout>
  )
}

export default withRouter(Viewer)
