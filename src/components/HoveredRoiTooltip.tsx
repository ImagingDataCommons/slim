const HoveredRoiTooltip = ({
  xPosition,
  yPosition,
  attributes
}: {
  xPosition: number
  yPosition: number
  attributes: Array<{ name: string, value: string }>
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
      {attributes.map((attr) => (
        <div key={attr.name}>
          {attr.name}: <span style={{ fontWeight: 500 }}>{attr.value}</span>
        </div>
      ))}
    </div>
  )
}

export default HoveredRoiTooltip
