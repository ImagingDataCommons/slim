import React from 'react'

import type DicomWebManager from '../DicomWebManager'
import type { Slide } from '../data/slides'
import SlideItem from './SlideItem'

interface SlideListProps {
  metadata: Slide[]
  clients: { [key: string]: DicomWebManager }
  selectedSeriesInstanceUID: string
  onSeriesSelection: ({
    seriesInstanceUID,
  }: {
    seriesInstanceUID: string
  }) => void
}

interface SlideListState {
  selectedSeriesInstanceUID: string
}

function seriesUidForSlide(slide: Slide): string {
  return slide.seriesInstanceUIDs[0]
}

/**
 * React component representing a list of DICOM Series Information Entities.
 *
 * Intentionally not an antd Menu: nesting Menu inside the case sider Menu is
 * invalid HTML (ul>ul) and DICOM UIDs as Menu keys have caused mangled routes
 * (e.g. series UID + ".0" → 404 metadata requests).
 */
class SlideList extends React.Component<SlideListProps, SlideListState> {
  state = {
    selectedSeriesInstanceUID: this.props.selectedSeriesInstanceUID,
  }

  componentDidMount(): void {
    this.props.onSeriesSelection({
      seriesInstanceUID: this.state.selectedSeriesInstanceUID,
    })
  }

  componentDidUpdate(prevProps: SlideListProps): void {
    if (
      prevProps.selectedSeriesInstanceUID !==
      this.props.selectedSeriesInstanceUID
    ) {
      this.setState({
        selectedSeriesInstanceUID: this.props.selectedSeriesInstanceUID,
      })
    }
  }

  private handleSlideClick = (seriesInstanceUID: string): void => {
    console.info(`select slide "${seriesInstanceUID}"`)
    this.setState({ selectedSeriesInstanceUID: seriesInstanceUID })
    this.props.onSeriesSelection({ seriesInstanceUID })
  }

  render(): React.ReactNode {
    return (
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          width: '100%',
        }}
      >
        {this.props.metadata.map((slide) => {
          const seriesInstanceUID = seriesUidForSlide(slide)
          const isSelected =
            this.state.selectedSeriesInstanceUID === seriesInstanceUID ||
            slide.seriesInstanceUIDs.includes(
              this.state.selectedSeriesInstanceUID,
            )
          return (
            <li key={seriesInstanceUID} style={{ width: '100%' }}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  this.handleSlideClick(seriesInstanceUID)
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  margin: 0,
                  padding: 0,
                  border: 'none',
                  background: isSelected
                    ? 'rgba(24, 144, 255, 0.1)'
                    : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <SlideItem
                  slide={slide}
                  clients={this.props.clients}
                  disableCardHover
                />
              </button>
            </li>
          )
        })}
      </ul>
    )
  }
}

export default SlideList
