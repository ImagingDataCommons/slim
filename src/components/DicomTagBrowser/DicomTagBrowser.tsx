import { useState, useMemo, useEffect } from 'react'
import { Select, Input, Slider, Typography, Table } from 'antd'
import { SearchOutlined } from '@ant-design/icons'

import DicomWebManager from '../../DicomWebManager'
import './DicomTagBrowser.css'
import { useSlides } from '../../hooks/useSlides'
import { getSortedTags } from './dicomTagUtils'
import { formatDicomDate } from '../../utils/formatDicomDate'
import DicomMetadataStore, { Series, Study } from '../../services/DICOMMetadataStore'
import { useDebounce } from '../../hooks/useDebounce'

const { Option } = Select

interface DisplaySet {
  displaySetInstanceUID: number
  SeriesDate?: string
  SeriesTime?: string
  SeriesNumber: string
  SeriesDescription?: string
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
  const [study, setStudy] = useState<Study | undefined>(undefined)

  const [displaySets, setDisplaySets] = useState<DisplaySet[]>([])
  const [selectedDisplaySetInstanceUID, setSelectedDisplaySetInstanceUID] = useState(0)
  const [instanceNumber, setInstanceNumber] = useState(1)
  const [filterValue, setFilterValue] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const [searchInput, setSearchInput] = useState('')

  const debouncedSearchValue = useDebounce(searchInput, 300)

  useEffect(() => {
    if (debouncedSearchValue === '') {
      setFilterValue('')
      setExpandedKeys([])
    } else {
      setFilterValue(debouncedSearchValue)
    }
  }, [debouncedSearchValue])

  useEffect(() => {
    const handler = (event: any): void => {
      const study: Study | undefined = Object.assign({}, DicomMetadataStore.getStudy(studyInstanceUID))
      setStudy(study)
    }
    const seriesAddedSubscription = DicomMetadataStore.subscribe(DicomMetadataStore.EVENTS.SERIES_ADDED, handler)
    const instancesAddedSubscription = DicomMetadataStore.subscribe(DicomMetadataStore.EVENTS.INSTANCES_ADDED, handler)

    const study = Object.assign({}, DicomMetadataStore.getStudy(studyInstanceUID))
    setStudy(study)

    return () => {
      seriesAddedSubscription.unsubscribe()
      instancesAddedSubscription.unsubscribe()
    }
  }, [studyInstanceUID])

  useEffect(() => {
    let displaySets: DisplaySet[] = []
    let derivedDisplaySets: DisplaySet[] = []
    const processedSeries: string[] = []
    let index = 0

    if (slides.length > 0) {
      displaySets = slides
        .map((slide): DisplaySet | null => {
          const { volumeImages } = slide
          if (volumeImages?.[0] === undefined) return null

          const {
            SeriesDate,
            SeriesTime,
            SeriesNumber,
            SeriesInstanceUID,
            SeriesDescription,
            Modality
          } = volumeImages[0]

          processedSeries.push(SeriesInstanceUID)

          const ds: DisplaySet = {
            displaySetInstanceUID: index,
            SeriesDate,
            SeriesTime,
            SeriesInstanceUID,
            // @ts-expect-error
            SeriesNumber,
            SeriesDescription,
            Modality,
            images: volumeImages
          }
          index++
          return ds
        })
        .filter((set): set is DisplaySet => set !== null)
    }

    if (study !== undefined && study.series?.length > 0) {
      derivedDisplaySets = study.series.filter(s => !processedSeries.includes(s.SeriesInstanceUID))
        .map((series: Series): DisplaySet => {
          const ds: DisplaySet = {
            displaySetInstanceUID: index,
            SeriesDate: series.SeriesDate,
            SeriesTime: series.SeriesTime,
            // @ts-expect-error
            SeriesNumber: series.SeriesNumber,
            SeriesDescription: series.SeriesDescription,
            SeriesInstanceUID: series.SeriesInstanceUID,
            Modality: series.Modality,
            images: series?.instances?.length > 0 ? series.instances : [series]
          }
          index++
          return ds
        })
    }

    setDisplaySets([...displaySets, ...derivedDisplaySets])
  }, [slides, study])

  const displaySetList = useMemo(() => {
    displaySets.sort((a, b) => Number(a.SeriesNumber) - Number(b.SeriesNumber))
    return displaySets.map((displaySet, index) => {
      const {
        SeriesDate = '',
        SeriesTime = '',
        SeriesNumber = '',
        SeriesDescription = '',
        Modality = ''
      } = displaySet

      const dateStr = `${SeriesDate}:${SeriesTime}`.split('.')[0]
      const displayDate = formatDicomDate(dateStr)

      return {
        value: index,
        label: `${SeriesNumber} (${Modality}): ${SeriesDescription}`,
        description: displayDate
      }
    })
  }, [displaySets])

  const showInstanceList =
    displaySets[selectedDisplaySetInstanceUID]?.images.length > 1

  console.debug('displaySets:', displaySets)

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
      width: '30%'
    },
    {
      title: 'VR',
      dataIndex: 'vr',
      key: 'vr',
      width: '5%'
    },
    {
      title: 'Keyword',
      dataIndex: 'keyword',
      key: 'keyword',
      width: '30%'
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      width: '40%'
    }
  ]

  const tableData = useMemo(() => {
    const transformTagsToTableData = (tags: any[], parentKey = ''): TableDataItem[] => {
      return tags.map((tag, index) => {
        // Create a unique key using tag value if available, otherwise use index
        const keyBase: string = tag.tag !== '' ? tag.tag.replace(/[(),]/g, '') : index.toString()
        const currentKey: string = parentKey !== '' ? `${parentKey}-${keyBase}` : keyBase

        const item: TableDataItem = {
          key: currentKey,
          tag: tag.tag,
          vr: tag.vr,
          keyword: tag.keyword,
          value: tag.value
        }

        if (tag.children !== undefined && tag.children.length > 0) {
          item.children = transformTagsToTableData(tag.children, currentKey)
        }

        return item
      })
    }

    if (displaySets[selectedDisplaySetInstanceUID] === undefined) return []
    const metadata = displaySets[selectedDisplaySetInstanceUID]?.images[instanceNumber - 1]
    const tags = getSortedTags(metadata)
    return transformTagsToTableData(tags)
  }, [instanceNumber, selectedDisplaySetInstanceUID, displaySets])

  const filteredData = useMemo(() => {
    if (filterValue === undefined || filterValue === '') return tableData

    const searchLower = filterValue.toLowerCase()
    const matchedKeys = new Set<string>()

    const nodeMatches = (node: TableDataItem): boolean => {
      return (
        (node.tag?.toLowerCase() ?? '').includes(searchLower) ||
        (node.vr?.toLowerCase() ?? '').includes(searchLower) ||
        (node.keyword?.toLowerCase() ?? '').includes(searchLower) ||
        (node.value?.toString().toLowerCase() ?? '').includes(searchLower)
      )
    }

    // First pass: find all matching nodes and their parent paths
    const findMatchingPaths = (
      node: TableDataItem,
      parentPath: TableDataItem[] = []
    ): TableDataItem[][] => {
      const currentPath = [...parentPath, node]
      let matchingPaths: TableDataItem[][] = []

      if (nodeMatches(node)) {
        matchingPaths.push(currentPath)
      }

      if (node.children != null) {
        node.children.forEach(child => {
          const childPaths = findMatchingPaths(child, currentPath)
          matchingPaths = [...matchingPaths, ...childPaths]
        })
      }

      return matchingPaths
    }

    // Find all paths that contain matches
    const matchingPaths = tableData.flatMap(node => findMatchingPaths(node))

    // Second pass: reconstruct the tree with matching paths
    const reconstructTree = (
      paths: TableDataItem[][],
      level = 0
    ): TableDataItem[] => {
      if (paths.length === 0 || level >= paths[0].length) return []

      const nodesAtLevel = new Map<string, {
        node: TableDataItem
        childPaths: TableDataItem[][]
      }>()

      paths.forEach(path => {
        if (level < path.length) {
          const node = path[level]
          if (!nodesAtLevel.has(node.key)) {
            nodesAtLevel.set(node.key, {
              node: { ...node },
              childPaths: []
            })
          }
          if (level + 1 < path.length) {
            nodesAtLevel.get(node.key)?.childPaths.push(path)
          }
        }
      })

      return Array.from(nodesAtLevel.values()).map(({ node, childPaths }) => {
        matchedKeys.add(node.key)
        const children = reconstructTree(childPaths, level + 1)
        return children.length > 0 ? { ...node, children } : node
      })
    }

    const filtered = reconstructTree(matchingPaths)
    setExpandedKeys(Array.from(matchedKeys))

    return filtered
  }, [tableData, filterValue])

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className='dicom-tag-browser'>
      <div
        style={{
          width: '100%',
          padding: '16px 20px 20px'
        }}
      >
        <div style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
          <div style={{ flex: 1 }}>
            <Typography.Text strong style={{ display: 'block', marginBottom: '8px' }}>Slides</Typography.Text>
            <Select
              style={{ width: '100%' }}
              value={selectedDisplaySetInstanceUID}
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
            <div style={{ flex: 1 }}>
              <Typography.Text strong style={{ display: 'block', marginBottom: '8px' }}>
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
          style={{ marginBottom: '20px' }}
          placeholder='Search DICOM tags...'
          prefix={<SearchOutlined />}
          onChange={(e) => setSearchInput(e.target.value)}
          value={searchInput}
        />

        <Table
          columns={columns}
          dataSource={filteredData}
          pagination={false}
          expandable={{
            expandedRowKeys: expandedKeys,
            onExpandedRowsChange: (keys) => setExpandedKeys(keys as string[])
          }}
          size='small'
          scroll={{ y: 500 }}
        />
      </div>
    </div>
  )
}

export default DicomTagBrowser
