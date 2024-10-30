import { useState, useMemo, useEffect } from 'react'
import { Select, Input, Slider, Typography, Table } from 'antd'
import { SearchOutlined } from '@ant-design/icons'

import DicomWebManager from '../../DicomWebManager'
import './DicomTagBrowser.css'
import { useSlides } from '../../hooks/useSlides'
import { getSortedTags } from './dicomTagUtils'
import { formatDicomDate } from '../../utils/formatDicomDate'

const { Option } = Select

interface DisplaySet {
  displaySetInstanceUID: number
  SeriesDate: string
  SeriesTime: string
  SeriesNumber: number
  SeriesDescription: string
  Modality: string
  images: any[]
}

interface TableDataItem {
  key: string
  tag: string
  vr: string
  keyword: string
  value: string
  children?: TableDataItem[]
}

interface DicomTagBrowserProps {
  clients: { [key: string]: DicomWebManager }
  studyInstanceUID: string
}

const DicomTagBrowser = ({ clients, studyInstanceUID }: DicomTagBrowserProps): JSX.Element => {
  const { slides, isLoading } = useSlides({ clients, studyInstanceUID })

  const [displaySets, setDisplaySets] = useState<DisplaySet[]>([])
  const [selectedDisplaySetInstanceUID, setSelectedDisplaySetInstanceUID] = useState(0)
  const [instanceNumber, setInstanceNumber] = useState(1)
  const [filterValue, setFilterValue] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const [searchExpandedKeys, setSearchExpandedKeys] = useState<string[]>([])

  useEffect(() => {
    if (slides.length === 0) return

    const updatedDisplaySets = slides
      .map((slide, index) => {
        const { volumeImages } = slide
        if (volumeImages?.[0] === undefined) return null

        const {
          SeriesDate,
          SeriesTime,
          SeriesNumber,
          SeriesDescription,
          Modality
        } = volumeImages[0]

        return {
          displaySetInstanceUID: index,
          SeriesDate,
          SeriesTime,
          SeriesNumber,
          SeriesDescription,
          Modality,
          images: volumeImages
        }
      })
      .filter((set): set is DisplaySet => set !== null)

    setDisplaySets(updatedDisplaySets)
  }, [slides])

  const displaySetList = useMemo(() => {
    displaySets.sort((a, b) => a.SeriesNumber - b.SeriesNumber)
    return displaySets.map((displaySet) => {
      const {
        displaySetInstanceUID,
        SeriesDate,
        SeriesTime,
        SeriesNumber,
        SeriesDescription,
        Modality
      } = displaySet

      const dateStr = `${SeriesDate}:${SeriesTime}`.split('.')[0]
      const displayDate = formatDicomDate(dateStr)

      return {
        value: displaySetInstanceUID,
        label: `${SeriesNumber} (${Modality}): ${SeriesDescription}`,
        description: displayDate
      }
    })
  }, [displaySets])

  const showInstanceList =
    displaySets[selectedDisplaySetInstanceUID]?.images.length > 1

  const instanceSliderMarks = useMemo(() => {
    if (displaySets[selectedDisplaySetInstanceUID] === undefined) return {}
    const totalInstances = displaySets[selectedDisplaySetInstanceUID].images.length

    // Create marks for first, middle, and last instances
    const marks: Record<number, string> = {
      1: '1', // First
      [Math.ceil(totalInstances / 2)]: String(Math.ceil(totalInstances / 2)), // Middle
      [totalInstances]: String(totalInstances) // Last
    }

    return marks
  }, [selectedDisplaySetInstanceUID, displaySets])

  const columns = [
    {
      title: 'Tag',
      dataIndex: 'tag',
      key: 'tag',
      width: '20%',
    },
    {
      title: 'VR',
      dataIndex: 'vr',
      key: 'vr',
      width: '10%',
    },
    {
      title: 'Keyword',
      dataIndex: 'keyword',
      key: 'keyword',
      width: '30%',
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      width: '40%',
    },
  ]

  const transformTagsToTableData = (tags: any[], parentKey = ''): TableDataItem[] => {
    return tags.map((tag, index) => {
      // Create a unique key that includes the parent path
      const currentKey = parentKey ? `${parentKey}-${index}` : `${index}`
      
      const item: TableDataItem = {
        key: currentKey,
        tag: tag.tag,
        vr: tag.vr,
        keyword: tag.keyword,
        value: tag.value
      }

      if (tag.children && tag.children.length > 0) {
        // Pass the current key as parent for nested items
        item.children = transformTagsToTableData(tag.children, currentKey)
      }

      return item
    })
  }

  const tableData = useMemo(() => {
    if (displaySets[selectedDisplaySetInstanceUID] === undefined) return []
    const metadata = displaySets[selectedDisplaySetInstanceUID]?.images[instanceNumber - 1]
    const tags = getSortedTags(metadata)
    return transformTagsToTableData(tags)
  }, [instanceNumber, selectedDisplaySetInstanceUID, displaySets])

  const filteredData = useMemo(() => {
    if (!filterValue) return tableData

    const searchLower = filterValue.toLowerCase()
    const newSearchExpandedKeys: string[] = []
    
    const filterNodes = (nodes: TableDataItem[], parentKey = ''): TableDataItem[] => {
      return nodes.map(node => {
        const newNode = { ...node }
        
        const matchesSearch = 
          (node.tag?.toLowerCase() ?? '').includes(searchLower) ||
          (node.vr?.toLowerCase() ?? '').includes(searchLower) ||
          (node.keyword?.toLowerCase() ?? '').includes(searchLower) ||
          (node.value?.toString().toLowerCase() ?? '').includes(searchLower)

        if (node.children) {
          const filteredChildren = filterNodes(node.children, node.key)
          newNode.children = filteredChildren
          
          if (matchesSearch || filteredChildren.length > 0) {
            // Add all parent keys to maintain the expansion chain
            if (parentKey) {
              newSearchExpandedKeys.push(parentKey)
            }
            newSearchExpandedKeys.push(node.key)
            return newNode
          }
        }

        return matchesSearch ? newNode : null
      }).filter((node): node is TableDataItem => node !== null)
    }

    const filtered = filterNodes(tableData)
    setSearchExpandedKeys(newSearchExpandedKeys)
    return filtered
  }, [tableData, filterValue])

  // Reset search expanded keys when search is cleared
  useEffect(() => {
    if (!filterValue) {
      setSearchExpandedKeys([])
    }
  }, [filterValue])

  // Combine manual expansion with search expansion
  const allExpandedKeys = useMemo(() => {
    return [...new Set([...expandedKeys, ...searchExpandedKeys])]
  }, [expandedKeys, searchExpandedKeys])

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className='dicom-tag-browser'>
      <div className='dicom-tag-browser-content'>
        <div className='controls-row'>
          <div className='series-selector'>
            <Typography.Text strong>Slides</Typography.Text>
            <Select
              style={{ width: '100%' }}
              value={selectedDisplaySetInstanceUID}
              defaultValue={0}
              onChange={(value) => {
                setSelectedDisplaySetInstanceUID(value)
                setInstanceNumber(1)
              }}
              optionLabelProp='label'
              optionFilterProp='label'
            >
              {displaySetList.map((item) => (
                <Option key={item.value} value={item.value} label={item.label}>
                  <div>
                    <div>{item.label}</div>
                    <div
                      style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.45)' }}
                    >
                      {item.description}
                    </div>
                  </div>
                </Option>
              ))}
            </Select>
          </div>

          {showInstanceList && (
            <div className='instance-slider'>
              <Typography.Text strong>
                Instance Number: {instanceNumber}
              </Typography.Text>
              <Slider
                min={1}
                max={displaySets[selectedDisplaySetInstanceUID]?.images.length}
                value={instanceNumber}
                onChange={(value) => setInstanceNumber(value)}
                marks={instanceSliderMarks}
                tooltip={{
                  formatter: (value: number | undefined) => value !== undefined ? `Instance ${value}` : ''
                }}
              />
            </div>
          )}
        </div>

        <Input
          className='search-input'
          placeholder='Search DICOM tags...'
          prefix={<SearchOutlined />}
          onChange={(e) => setFilterValue(e.target.value)}
          value={filterValue}
        />

        <Table
          columns={columns}
          dataSource={filteredData}
          pagination={false}
          expandable={{
            expandedRowKeys: allExpandedKeys,
            onExpandedRowsChange: (keys) => setExpandedKeys(keys as string[]),
          }}
          size="small"
          scroll={{ y: 500 }}
        />
      </div>
    </div>
  )
}

export default DicomTagBrowser
