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
 * React component representing a list of slides in the redesigned card layout.
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
      <div className="flex flex-col gap-2 px-3 pb-4">
        {this.props.metadata.map((slide) => {
          const seriesInstanceUID = seriesUidForSlide(slide)
          const isSelected =
            this.state.selectedSeriesInstanceUID === seriesInstanceUID ||
            slide.seriesInstanceUIDs.includes(
              this.state.selectedSeriesInstanceUID,
            )
          return (
            <SlideItem
              key={seriesInstanceUID}
              slide={slide}
              clients={this.props.clients}
              isSelected={isSelected}
              onClick={() => this.handleSlideClick(seriesInstanceUID)}
            />
          )
        })}
      </div>
    )
  }
}

export default SlideList
