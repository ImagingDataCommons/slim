const HoveredRoiTooltip = ({
  xPosition,
  yPosition,
  rois
}: {
  xPosition: number
  yPosition: number
  rois: Array<{ index: number, roiUid: string, attributes: Array<{ name: string, value: string }>, seriesDescription?: string }>
}): JSX.Element => {
  // Always group ROIs by series description
  const groupedRois = rois.reduce<{ [key: string]: typeof rois }>((acc, roi) => {
    const seriesDesc = (roi.seriesDescription !== null && roi.seriesDescription !== undefined && roi.seriesDescription !== '') ? roi.seriesDescription : 'Unknown Series'
    if (acc[seriesDesc] === undefined) {
      acc[seriesDesc] = []
    }
    acc[seriesDesc].push(roi)
    return acc
  }, {})

  const baseStyle: React.CSSProperties = {
    position: 'fixed',
    top: `${yPosition}px`,
    left: `${xPosition}px`,
    backgroundColor: 'rgba(230, 230, 230, 0.95)',
    padding: '10px',
    fontWeight: 'bold',
    pointerEvents: 'none',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    zIndex: 10000
  }

  return (
    <div
      style={{
        ...baseStyle,
        minWidth: '200px',
        maxWidth: '400px'
      }}
    >
      {Object.entries(groupedRois).map(([seriesDesc, seriesRois], seriesIndex) => (
        <div key={seriesDesc} style={{ marginBottom: seriesIndex > 0 ? '12px' : '0' }}>
          {seriesIndex > 0 && (
            <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid rgba(0, 0, 0, 0.2)' }} />
          )}
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'rgba(0, 0, 0, 0.8)', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid rgba(0, 0, 0, 0.15)' }}>
            {seriesDesc}
          </div>
          <div style={{ marginLeft: '4px' }}>
            {seriesRois.map((roi: { index: number, roiUid: string, attributes: Array<{ name: string, value: string }>, seriesDescription?: string }, roiIndex: number) => {
              const annotationGroupLabelAttr = roi.attributes.find((attr: { name: string, value: string }) => attr.name === 'Annotation Group Label')
              const otherAttributes = roi.attributes.filter(
                (attr: { name: string, value: string }) => attr.name !== 'Series Description' && attr.name !== 'Annotation Group Label'
              )
              return (
                <div key={roi.roiUid} style={{ marginBottom: roiIndex < seriesRois.length - 1 ? '6px' : '0', fontSize: '12px' }}>
                  <div style={{ fontWeight: 'bold' }}>
                    ROI {roi.index}
                    {(annotationGroupLabelAttr != null) && (
                      <span style={{ fontWeight: 500, marginLeft: '6px', color: 'rgba(0, 0, 0, 0.7)' }}>
                        - {annotationGroupLabelAttr.value}
                      </span>
                    )}
                  </div>
                  {otherAttributes.length > 0 && (
                    <div style={{ marginLeft: '12px', fontSize: '11px', color: 'rgba(0, 0, 0, 0.8)', marginTop: '2px' }}>
                      {otherAttributes.map((attr: { name: string, value: string }) => (
                        <div key={String(attr.name) + '-' + String(roi.roiUid)}>
                          {attr.name}: <span style={{ fontWeight: 500 }}>{attr.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default HoveredRoiTooltip
