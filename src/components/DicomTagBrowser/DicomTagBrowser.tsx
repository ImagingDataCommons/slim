import { SearchOutlined } from '@ant-design/icons'
import { Input, Select, Slider, Table, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'

import type DicomWebManager from '../../DicomWebManager'
import './DicomTagBrowser.css'
import { useDebounce } from '../../hooks/useDebounce'
import { useSlides } from '../../hooks/useSlides'
import DicomMetadataStore, {
  type Series,
  type Study,
} from '../../services/DICOMMetadataStore'
import { formatDicomDate } from '../../utils/formatDicomDate'
import { getSortedTags, type TagInfo } from './dicomTagUtils'

const { Option } = Select

interface DisplaySet {
  displaySetInstanceUID: number
  SeriesDate?: string
  SeriesTime?: string
  SeriesNumber: string
  SeriesDescription?: string
  SeriesInstanceUID?: string
  Modality: string
  images: unknown[]
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
  seriesInstanceUID?: string
}

const DicomTagBrowser = ({
  clients,
  studyInstanceUID,
  seriesInstanceUID = '',
}: DicomTagBrowserProps): JSX.Element => {
  const { slides, isLoading } = useSlides({ clients, studyInstanceUID })
  const [study, setStudy] = useState<Study | undefined>(undefined)

  const [displaySets, setDisplaySets] = useState<DisplaySet[]>([])
  const [selectedDisplaySetInstanceUID, setSelectedDisplaySetInstanceUID] =
    useState(0)
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
    const handler = (_event: unknown): void => {
      const study: Study | undefined = Object.assign(
        {},
        DicomMetadataStore.getStudy(studyInstanceUID),
      )
      setStudy(study)
    }
    const seriesAddedSubscription = DicomMetadataStore.subscribe(
      DicomMetadataStore.EVENTS.SERIES_ADDED,
      handler,
    )
    const instancesAddedSubscription = DicomMetadataStore.subscribe(
      DicomMetadataStore.EVENTS.INSTANCES_ADDED,
      handler,
    )

    const study = Object.assign(
      {},
      DicomMetadataStore.getStudy(studyInstanceUID),
    )
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
        .flatMap((slide): DisplaySet[] => {
          const slideDisplaySets: DisplaySet[] = []

          // Helper function to process any image type
          const processImageType = (
            images: unknown[] | undefined,
            imageType: string,
          ): void => {
            if (images?.[0] !== undefined) {
              console.info(
                `Found ${images.length} ${imageType} image(s) for slide ${slide.containerIdentifier}`,
              )

              const img = images[0] as Record<string, unknown>
              const {
                SeriesDate,
                SeriesTime,
                SeriesNumber,
                SeriesInstanceUID,
                SeriesDescription,
                Modality,
              } = img

              processedSeries.push(SeriesInstanceUID as string)

              const ds: DisplaySet = {
                displaySetInstanceUID: index,
                SeriesDate: SeriesDate as string | undefined,
                SeriesTime: SeriesTime as string | undefined,
                SeriesInstanceUID: SeriesInstanceUID as string,
                SeriesNumber: String(SeriesNumber),
                SeriesDescription: SeriesDescription as string | undefined,
                Modality: Modality as string,
                images,
              }
              slideDisplaySets.push(ds)
              index++
            }
          }

          // Process all image types
          processImageType(slide.volumeImages, 'volume')
          processImageType(slide.overviewImages, 'overview')
          processImageType(slide.labelImages, 'label')

          return slideDisplaySets
        })
        .filter((set): set is DisplaySet => set !== null && set !== undefined)
    }

    if (study !== undefined && study.series?.length > 0) {
      derivedDisplaySets = study.series
        .filter((s) => !processedSeries.includes(s.SeriesInstanceUID))
        .map((series: Series): DisplaySet => {
          const ds: DisplaySet = {
            displaySetInstanceUID: index,
            SeriesDate: series.SeriesDate,
            SeriesTime: series.SeriesTime,
            SeriesNumber: String(series.SeriesNumber),
            SeriesDescription: series.SeriesDescription,
            SeriesInstanceUID: series.SeriesInstanceUID,
            Modality: series.Modality,
            images: series?.instances?.length > 0 ? series.instances : [series],
          }
          index++
          return ds
        })
    }

    setDisplaySets([...displaySets, ...derivedDisplaySets])
  }, [slides, study])

  const sortedDisplaySets = useMemo(() => {
    return [...displaySets].sort((a, b) => {
      const aNum = Number(a.SeriesNumber)
      const bNum = Number(b.SeriesNumber)
      // Normalize non-numeric/missing values to Infinity to sort them last
      const aSafe =
        Number.isNaN(aNum) ||
        a.SeriesNumber === undefined ||
        a.SeriesNumber === ''
          ? Infinity
          : aNum
      const bSafe =
        Number.isNaN(bNum) ||
        b.SeriesNumber === undefined ||
        b.SeriesNumber === ''
          ? Infinity
          : bNum
      return aSafe - bSafe
    })
  }, [displaySets])

  const displaySetList = useMemo(() => {
    return sortedDisplaySets.map((displaySet, index) => {
      const {
        SeriesDate = '',
        SeriesTime = '',
        SeriesNumber = '',
        SeriesDescription = '',
        Modality = '',
      } = displaySet

      const dateStr = `${SeriesDate}:${SeriesTime}`.split('.')[0]
      const displayDate = formatDicomDate(dateStr)

      return {
        value: index,
        label: `${SeriesNumber} (${Modality}): ${SeriesDescription}`,
        description: displayDate,
      }
    })
  }, [sortedDisplaySets])

  useEffect(() => {
    if (sortedDisplaySets.length === 0) return

    if (seriesInstanceUID !== '') {
      const matchingIndex = sortedDisplaySets.findIndex(
        (displaySet) => displaySet.SeriesInstanceUID === seriesInstanceUID,
      )
      if (matchingIndex !== -1) {
        setSelectedDisplaySetInstanceUID(matchingIndex)
        setInstanceNumber(1)
        return
      }
    }

    setSelectedDisplaySetInstanceUID((currentIndex) => {
      const needsReset =
        currentIndex >= sortedDisplaySets.length || currentIndex < 0
      return needsReset ? 0 : currentIndex
    })
  }, [seriesInstanceUID, sortedDisplaySets])

  useEffect(() => {
    const currentIndex = selectedDisplaySetInstanceUID
    const needsReset =
      currentIndex >= sortedDisplaySets.length || currentIndex < 0
    if (needsReset && sortedDisplaySets.length > 0) {
      setInstanceNumber(1)
    }
  }, [selectedDisplaySetInstanceUID, sortedDisplaySets.length])

  const showInstanceList =
    sortedDisplaySets[selectedDisplaySetInstanceUID]?.images.length > 1

  const instanceSliderMarks = useMemo(() => {
    if (sortedDisplaySets[selectedDisplaySetInstanceUID] === undefined)
      return {}
    const totalInstances =
      sortedDisplaySets[selectedDisplaySetInstanceUID].images.length

    const marks: Record<number, string> = {
      1: '1',
      [Math.ceil(totalInstances / 2)]: String(Math.ceil(totalInstances / 2)),
      [totalInstances]: String(totalInstances),
    }

    return marks
  }, [selectedDisplaySetInstanceUID, sortedDisplaySets])

  const columns = [
    {
      title: 'Tag',
      dataIndex: 'tag',
      key: 'tag',
      width: '30%',
    },
    {
      title: 'VR',
      dataIndex: 'vr',
      key: 'vr',
      width: '5%',
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

  const tableData = useMemo(() => {
    const transformTagsToTableData = (
      tags: TagInfo[],
      parentKey = '',
    ): TableDataItem[] => {
      return tags.map((tag, index) => {
        // Create a unique key using tag value if available, otherwise use index
        const keyBase: string =
          tag.tag !== '' ? tag.tag.replace(/[(),]/g, '') : index.toString()
        const currentKey: string =
          parentKey !== '' ? `${parentKey}-${keyBase}` : keyBase

        const item: TableDataItem = {
          key: currentKey,
          tag: tag.tag,
          vr: tag.vr,
          keyword: tag.keyword,
          value: tag.value,
        }

        if (tag.children !== undefined && tag.children.length > 0) {
          item.children = transformTagsToTableData(tag.children, currentKey)
        }

        return item
      })
    }

    if (sortedDisplaySets[selectedDisplaySetInstanceUID] === undefined)
      return []
    const images = sortedDisplaySets[selectedDisplaySetInstanceUID]?.images
    const sortedMetadata = Array.isArray(images)
      ? [...images].sort((a, b) => {
          if (
            a.InstanceNumber !== undefined &&
            b.InstanceNumber !== undefined
          ) {
            return Number(a.InstanceNumber) - Number(b.InstanceNumber)
          }
          return 0 // keep original order if either is missing InstanceNumber
        })
      : []
    const metadata = sortedMetadata[instanceNumber - 1]
    const tags = getSortedTags(metadata)
    return transformTagsToTableData(tags)
  }, [instanceNumber, selectedDisplaySetInstanceUID, sortedDisplaySets])

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

    const findMatchingPaths = (
      node: TableDataItem,
      parentPath: TableDataItem[] = [],
    ): TableDataItem[][] => {
      const currentPath = [...parentPath, node]
      let matchingPaths: TableDataItem[][] = []

      if (nodeMatches(node)) {
        matchingPaths.push(currentPath)
      }

      if (node.children != null) {
        node.children.forEach((child) => {
          const childPaths = findMatchingPaths(child, currentPath)
          matchingPaths = [...matchingPaths, ...childPaths]
        })
      }

      return matchingPaths
    }

    const matchingPaths = tableData.flatMap((node) => findMatchingPaths(node))

    const reconstructTree = (
      paths: TableDataItem[][],
      level = 0,
    ): TableDataItem[] => {
      if (paths.length === 0 || level >= paths[0].length) return []

      const nodesAtLevel = new Map<
        string,
        {
          node: TableDataItem
          childPaths: TableDataItem[][]
        }
      >()

      paths.forEach((path) => {
        if (level < path.length) {
          const node = path[level]
          if (!nodesAtLevel.has(node.key)) {
            nodesAtLevel.set(node.key, {
              node: { ...node },
              childPaths: [],
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
    <div className="dicom-tag-browser">
      <div
        style={{
          width: '100%',
          padding: '16px 20px 20px',
        }}
      >
        <div style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
          <div style={{ flex: 1 }}>
            <Typography.Text
              strong
              style={{ display: 'block', marginBottom: '8px' }}
            >
              Series
            </Typography.Text>
            <Select
              style={{ width: '100%' }}
              value={selectedDisplaySetInstanceUID}
              onChange={(value) => {
                setSelectedDisplaySetInstanceUID(value)
                setInstanceNumber(1)
              }}
              optionLabelProp="label"
              optionFilterProp="label"
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
              <Typography.Text
                strong
                style={{ display: 'block', marginBottom: '8px' }}
              >
                Instance Number: {instanceNumber}
              </Typography.Text>
              <Slider
                min={1}
                max={
                  sortedDisplaySets[selectedDisplaySetInstanceUID]?.images
                    .length
                }
                value={instanceNumber}
                onChange={(value) => setInstanceNumber(value)}
                marks={instanceSliderMarks}
                tooltip={{
                  formatter: (value: number | undefined) =>
                    value !== undefined ? `Instance ${value}` : '',
                }}
              />
            </div>
          )}
        </div>

        <Input
          style={{ marginBottom: '20px' }}
          placeholder="Search DICOM tags..."
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
