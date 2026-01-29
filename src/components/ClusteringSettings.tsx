import { InputNumber, Menu, Switch } from 'antd'

interface ClusteringSettingsProps {
  isClusteringEnabled: boolean
  clusteringPixelSizeThreshold: number | null
  onClusteringToggle: (checked: boolean) => void
  onThresholdChange: (value: number | null) => void
}

/**
 * Clustering settings menu items for annotation groups.
 * Extracted to reduce JSX nesting depth.
 */
const ClusteringSettings = ({
  isClusteringEnabled,
  clusteringPixelSizeThreshold,
  onClusteringToggle,
  onThresholdChange,
}: ClusteringSettingsProps): JSX.Element => {
  const toggleStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  }

  const helpTextStyle = {
    fontSize: '0.75rem',
    color: '#8c8c8c',
    marginTop: '0.5rem',
  }

  return (
    <>
      <Menu.Item
        key="clustering-enabled"
        className="slim-multiline-menu-item"
        style={{ height: 'auto', padding: '0.9rem' }}
      >
        <div style={toggleStyle}>
          <span>Enable Clustering</span>
          <Switch
            checked={Boolean(isClusteringEnabled)}
            onChange={onClusteringToggle}
          />
        </div>
      </Menu.Item>

      {isClusteringEnabled && (
        <Menu.Item
          key="clustering-threshold"
          className="slim-multiline-menu-item"
          style={{ height: 'auto', padding: '0.9rem' }}
        >
          <div style={{ marginBottom: '0.5rem' }}>
            Clustering Pixel Size Threshold (mm)
          </div>
          <InputNumber
            min={0}
            max={100}
            step={0.001}
            precision={3}
            style={{ width: '100%' }}
            value={clusteringPixelSizeThreshold ?? undefined}
            onChange={onThresholdChange}
            placeholder="Auto (zoom-based)"
            addonAfter="mm"
          />
          <div style={helpTextStyle}>
            When pixel size ≤ threshold, clustering is disabled. Leave empty for
            zoom-based detection.
          </div>
        </Menu.Item>
      )}
    </>
  )
}

export default ClusteringSettings
