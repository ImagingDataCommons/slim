import moment from "moment";
import { useState, useMemo, useEffect } from "react";
import { Select, Input, Slider, Typography } from "antd";
import { SearchOutlined, CaretRightOutlined, CaretDownOutlined } from "@ant-design/icons";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  flexRender,
} from '@tanstack/react-table';

import "./DicomTagBrowser.css";
import { useSlides } from "../../hooks/useSlides";
import { getSortedTags } from "./dicomTagUtils";

const { Option } = Select;

interface DisplaySet {
  displaySetInstanceUID: number;
  SeriesDate: string;
  SeriesTime: string;
  SeriesNumber: number;
  SeriesDescription: string;
  Modality: string;
  images: any[];
}

interface TagInfo {
  tag: string;
  vr: string;
  keyword: string;
  value: string;
  children?: TagInfo[];
}

interface TreeNode {
  id: string;
  tag: string;
  vr: string;
  keyword: string;
  value: string;
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
  children?: TreeNode[];
}

interface FilteredTreeNode extends TreeNode {
  children: FilteredTreeNode[];
}

const columnHelper = createColumnHelper<TreeNode>();

// Move these functions outside the component
const transformToTreeData = (tags: TagInfo[], depth = 0, parentId = '', expandedRows: Set<string>): TreeNode[] => {
  return tags.map((tag, index) => {
    const id = parentId ? `${parentId}-${index}` : `${index}`;
    
    return {
      id,
      tag: tag.tag,
      vr: tag.vr,
      keyword: tag.keyword,
      value: tag.value,
      depth,
      expanded: expandedRows.has(id),
      hasChildren: Boolean(tag.children?.length),
      children: tag.children ? transformToTreeData(tag.children, depth + 1, id, expandedRows) : undefined,
    };
  });
};

const flattenTreeData = (nodes: TreeNode[]): TreeNode[] => {
  const seen = new Set<string>();
  
  return nodes.reduce<TreeNode[]>((flat, node) => {
    if (seen.has(node.id)) return flat;
    
    seen.add(node.id);
    const expanded = node.expanded;
    
    return [
      ...flat,
      node,
      ...(expanded && node.children ? flattenTreeData(node.children) : []),
    ];
  }, []);
};

const filterTreeData = (nodes: TreeNode[], searchText: string): FilteredTreeNode[] => {
  if (!searchText) return nodes as FilteredTreeNode[];
  
  const searchLower = searchText.toLowerCase();
  
  const filtered = nodes
    .map(node => {
      const matchesSearch = 
        (node.tag?.toLowerCase() || '').includes(searchLower) ||
        (node.keyword?.toLowerCase() || '').includes(searchLower) ||
        (node.value?.toString().toLowerCase() || '').includes(searchLower) ||
        (node.vr?.toLowerCase() || '').includes(searchLower);

      let filteredChildren: FilteredTreeNode[] = [];
      if (node.children) {
        filteredChildren = filterTreeData(node.children, searchText);
      }

      if (matchesSearch || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
          expanded: true,
        } as FilteredTreeNode;
      }

      return null;
    })
    .filter((node): node is FilteredTreeNode => node !== null);

  return filtered;
};

const DicomTagBrowser = () => {
  const { slides, isLoading } = useSlides();
  const [displaySets, setDisplaySets] = useState<DisplaySet[]>([]);
  const [selectedDisplaySetInstanceUID, setSelectedDisplaySetInstanceUID] = useState(0);
  const [instanceNumber, setInstanceNumber] = useState(1);
  const [filterValue, setFilterValue] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!slides.length) return;

    const updatedDisplaySets = slides
      .map((slide, index) => {
        const { volumeImages } = slide;
        if (!volumeImages?.[0]) return null;

        const {
          SeriesDate,
          SeriesTime,
          SeriesNumber,
          SeriesDescription,
          Modality,
        } = volumeImages[0];

        return {
          displaySetInstanceUID: index,
          SeriesDate,
          SeriesTime,
          SeriesNumber,
          SeriesDescription,
          Modality,
          images: volumeImages,
        };
      })
      .filter((set): set is DisplaySet => set !== null);

    setDisplaySets(updatedDisplaySets);
  }, [slides]);

  const displaySetList = useMemo(() => {
    displaySets.sort((a, b) => a.SeriesNumber - b.SeriesNumber);
    return displaySets.map((displaySet) => {
      const {
        displaySetInstanceUID,
        SeriesDate,
        SeriesTime,
        SeriesNumber,
        SeriesDescription,
        Modality,
      } = displaySet;

      const dateStr = `${SeriesDate}:${SeriesTime}`.split(".")[0];
      const date = moment(dateStr, "YYYYMMDD:HHmmss");
      const displayDate = date.format("ddd, MMM Do YYYY");

      return {
        value: displaySetInstanceUID,
        label: `${SeriesNumber} (${Modality}): ${SeriesDescription}`,
        description: displayDate,
      };
    });
  }, [displaySets]);

  const showInstanceList =
    displaySets[selectedDisplaySetInstanceUID]?.images.length > 1;

  const toggleRow = (nodeId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('tag', {
        header: 'Tag',
        cell: (info) => {
          const node = info.row.original;
          return (
            <div style={{ paddingLeft: `${node.depth * 24}px` }} className="tree-cell">
              {node.hasChildren && (
                <span
                  className="tree-toggle"
                  onClick={() => toggleRow(node.id)}
                >
                  {node.expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
                </span>
              )}
              {!node.hasChildren && <span className="tree-spacer" />}
              {node.tag}
            </div>
          );
        },
      }),
      columnHelper.accessor('vr', {
        header: 'VR',
      }),
      columnHelper.accessor('keyword', {
        header: 'Keyword',
      }),
      columnHelper.accessor('value', {
        header: 'Value',
      }),
    ],
    []
  );

  const treeData = useMemo(() => {
    if (!displaySets[selectedDisplaySetInstanceUID]) return [];
    const metadata = displaySets[selectedDisplaySetInstanceUID]?.images[instanceNumber - 1];
    const tags = getSortedTags(metadata);
    const hierarchicalData = transformToTreeData(tags, 0, '', expandedRows);
    
    if (!filterValue) {
      return flattenTreeData(hierarchicalData);
    }

    const filteredData = filterTreeData(hierarchicalData, filterValue);
    return flattenTreeData(filteredData);
  }, [instanceNumber, selectedDisplaySetInstanceUID, displaySets, expandedRows, filterValue]);

  const table = useReactTable({
    data: treeData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const instanceSliderMarks = useMemo(() => {
    if (!displaySets[selectedDisplaySetInstanceUID]) return {};
    const totalInstances = displaySets[selectedDisplaySetInstanceUID].images.length;

    // Create marks for first, middle, and last instances
    const marks: Record<number, string> = {
      1: "1", // First
      [Math.ceil(totalInstances / 2)]: Math.ceil(totalInstances / 2).toString(), // Middle
      [totalInstances]: totalInstances.toString(), // Last
    };

    return marks;
  }, [selectedDisplaySetInstanceUID, displaySets]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!displaySets.length) {
    return <div>No DICOM data available</div>;
  }

  return (
    <div className="dicom-tag-browser-content">
      <div className="controls-row">
        <div className="series-selector">
          <Typography.Text strong>Slide</Typography.Text>
          <Select
            style={{ width: "100%" }}
            value={selectedDisplaySetInstanceUID}
            defaultValue={0}
            onChange={(value) => {
              setSelectedDisplaySetInstanceUID(value);
              setInstanceNumber(1);
            }}
            optionLabelProp="label"
            optionFilterProp="label"
          >
            {displaySetList.map((item) => (
              <Option key={item.value} value={item.value} label={item.label}>
                <div>
                  <div>{item.label}</div>
                  <div
                    style={{ fontSize: "12px", color: "rgba(0, 0, 0, 0.45)" }}
                  >
                    {item.description}
                  </div>
                </div>
              </Option>
            ))}
          </Select>
        </div>

        {showInstanceList && (
          <div className="instance-slider">
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
                formatter: (value) => `Instance ${value}`,
              }}
            />
          </div>
        )}
      </div>

      <Input
        className="search-input"
        placeholder="Search DICOM tags..."
        prefix={<SearchOutlined />}
        onChange={(e) => setFilterValue(e.target.value)}
      />

      <div className="table-container">
        <table>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DicomTagBrowser;
