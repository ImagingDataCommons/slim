import React from 'react'
import { Progress, message } from 'antd'

interface AnnotationProgressProps {
  annotationGroupUID: string
  processed: number
  total: number
  percentage: number
}

interface AnnotationProgressState {
  progressMap: Map<string, {
    retrieval?: { isLoading: boolean, description: string }
    processing?: { processed: number, total: number, percentage: number }
  }>
}

/**
 * Component to display progress of annotation retrieval and processing
 * Listens to annotation retrieval and processing progress events from the viewer
 */
class AnnotationProgress extends React.Component<AnnotationProgressProps, AnnotationProgressState> {
  private processingHandler?: (event: CustomEvent) => void
  private retrievalHandler?: (event: CustomEvent) => void

  constructor (props: AnnotationProgressProps) {
    super(props)
    this.state = {
      progressMap: new Map()
    }
  }

  componentDidMount (): void {
    const handleProcessingProgress = (event: CustomEvent): void => {
      const detail = event.detail?.payload ?? event.detail
      const { annotationGroupUID = '', processed = 0, total = 0, percentage = 0 } = (detail != null) ? detail : {}

      if (annotationGroupUID === undefined || annotationGroupUID === null || annotationGroupUID === '') {
        return
      }

      this.setState(prevState => {
        const newMap = new Map(prevState.progressMap)
        const current = (newMap.get(annotationGroupUID) != null) ? newMap.get(annotationGroupUID) : {}

        if (processed === total && percentage === 100) {
          // Show completion message and remove after delay
          void message.success(`Finished processing ${String(total ?? 0)} annotations`, 2)
          setTimeout(() => {
            this.setState(prevState => {
              const updatedMap = new Map(prevState.progressMap)
              const updated = updatedMap.get(annotationGroupUID)
              if (updated != null) {
                // Remove processing, keep retrieval if it exists
                if (updated.retrieval != null) {
                  updatedMap.set(annotationGroupUID, { retrieval: updated.retrieval })
                } else {
                  updatedMap.delete(annotationGroupUID)
                }
              }
              return { progressMap: updatedMap }
            })
          }, 2000)
        } else {
          newMap.set(annotationGroupUID, { ...current, processing: { processed, total, percentage } })
        }
        return { progressMap: newMap }
      })
    }

    const handleRetrievalProgress = (event: CustomEvent): void => {
      const detail = event.detail?.payload ?? event.detail
      const { annotationGroupUID = '', isLoading = false, description = '' } = (detail != null) ? detail : {}

      if (annotationGroupUID === undefined || annotationGroupUID === null || annotationGroupUID === '') {
        return
      }

      this.setState(prevState => {
        const newMap = new Map(prevState.progressMap)
        const current = (newMap.get(annotationGroupUID) != null) ? newMap.get(annotationGroupUID) : {}

        if (isLoading === false) {
          /**
           * Retrieval complete, remove after a short delay if processing hasn't started
           */
          setTimeout(() => {
            this.setState(prevState => {
              const updatedMap = new Map(prevState.progressMap)
              const updated = updatedMap.get(annotationGroupUID)
              if ((updated != null) && (updated.processing == null)) {
                updatedMap.delete(annotationGroupUID)
              } else if (updated != null) {
                /**
                 * Keep processing, remove retrieval
                 */
                updatedMap.set(annotationGroupUID, { processing: updated.processing })
              }
              return { progressMap: updatedMap }
            })
          }, 1000)
        } else {
          newMap.set(annotationGroupUID, { ...current, retrieval: { isLoading, description } })
        }
        return { progressMap: newMap }
      })
    }

    window.addEventListener('dicommicroscopyviewer_annotation_processing_progress', handleProcessingProgress as EventListener)
    window.addEventListener('dicommicroscopyviewer_annotation_retrieval_progress', handleRetrievalProgress as EventListener)
    this.processingHandler = handleProcessingProgress
    this.retrievalHandler = handleRetrievalProgress
  }

  componentWillUnmount (): void {
    if (this.processingHandler != null) {
      window.removeEventListener('dicommicroscopyviewer_annotation_processing_progress', this.processingHandler as EventListener)
    }
    if (this.retrievalHandler != null) {
      window.removeEventListener('dicommicroscopyviewer_annotation_retrieval_progress', this.retrievalHandler as EventListener)
    }
  }

  render (): React.ReactNode {
    if (this.state.progressMap.size === 0) {
      return null
    }

    return (
      <div style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 1000,
        backgroundColor: 'white',
        padding: '20px 24px',
        borderRadius: '0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        minWidth: '400px',
        maxWidth: '500px'
      }}
      >
        {Array.from(this.state.progressMap.entries()).map(([uid, progress]) => (
          <div key={uid} style={{ marginBottom: '16px' }}>
            {progress.retrieval?.isLoading === true && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#333' }}>
                  {(progress.retrieval.description !== undefined && progress.retrieval.description !== null && progress.retrieval.description !== '') ? progress.retrieval.description : 'Retrieving annotations...'}
                </div>
                <Progress
                  percent={100}
                  status='active'
                  showInfo={false}
                  strokeWidth={8}
                  strokeColor={{
                    '0%': '#722ed1',
                    '100%': '#9254de'
                  }}
                />
              </div>
            )}
            {(progress.processing != null) && (
              <div>
                <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#333' }}>
                  Processing annotations: {progress.processing.processed} / {progress.processing.total}
                </div>
                <Progress
                  percent={progress.processing.percentage}
                  status='active'
                  showInfo
                  strokeWidth={8}
                  strokeColor={{
                    '0%': '#108ee9',
                    '100%': '#87d068'
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }
}

export default AnnotationProgress
