import { applyAnnotationViewerPrefs } from '../applyAnnotationViewerPrefs'

describe('applyAnnotationViewerPrefs', () => {
  it('calls DMV setters when present', () => {
    const volumeViewer = {
      setMeasurementUnit: vi.fn(),
      setMarkupLabelColor: vi.fn(),
      setMarkupLabelFontSize: vi.fn(),
    }
    applyAnnotationViewerPrefs(volumeViewer, {
      units: 'mm',
      markupLabelColor: '#d9453b',
      markupLabelFontSize: 13,
    })
    expect(volumeViewer.setMeasurementUnit).toHaveBeenCalledWith('mm')
    expect(volumeViewer.setMarkupLabelColor).toHaveBeenCalledWith('#d9453b')
    expect(volumeViewer.setMarkupLabelFontSize).toHaveBeenCalledWith(13)
  })

  it('does not throw when the DMV bundle lacks the setters', () => {
    expect(() =>
      applyAnnotationViewerPrefs({} as never, {
        units: 'µm',
        markupLabelColor: '#1f5ad1',
        markupLabelFontSize: 13,
      }),
    ).not.toThrow()
  })
})
