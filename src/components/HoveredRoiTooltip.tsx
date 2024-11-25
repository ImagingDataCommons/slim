const HoveredRoiTooltip = ({
  xPosition,
  yPosition,
  rois
}: {
  xPosition: number
  yPosition: number
  rois: Array<{ index: number, roiUid: string, attributes: Array<{ name: string, value: string }>}>
}): JSX.Element => {
  return (
    <div
      style={{
        position: 'fixed',
        top: `${yPosition}px`,
        left: `${xPosition}px`,
        backgroundColor: 'rgba(230, 230, 230, 0.65)',
        minWidth: '150px',
        minHeight: '60px',
        padding: '20px',
        fontWeight: 'bold',
        pointerEvents: 'none'
      }}
    >
      {rois.map((roi, i) => {
        const attributes = roi.attributes
        return (
          <div key={roi.roiUid}>
            <span>ROI {roi.index}</span>
            {attributes.map((attr) => {
              return (
                <div key={attr.name + roi.roiUid}>
                  {attr.name}: <span style={{ fontWeight: 500 }}>{attr.value}</span>
                </div>
              )
            })}
          </div>

        )
      })}
    </div>
  )
}

export default HoveredRoiTooltip
