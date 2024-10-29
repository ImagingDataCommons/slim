import moment from "moment";
import { useState, useMemo, useEffect } from "react";
import { Select, Input, Table, Typography, Slider } from "antd";
import { SearchOutlined } from "@ant-design/icons";

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

const DicomTagBrowser = () => {
  const { slides, isLoading } = useSlides(); // Assuming loading state exists in useSlides

  const [displaySets, setDisplaySets] = useState<DisplaySet[]>([]);
  const [selectedDisplaySetInstanceUID, setSelectedDisplaySetInstanceUID] =
    useState(0);
  const [instanceNumber, setInstanceNumber] = useState(1);
  const [filterValue, setFilterValue] = useState("");

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
  }, [slides]); // Remove selectedDisplaySetInstanceUID from deps

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

  const tableData = useMemo(() => {
    if (!displaySets[selectedDisplaySetInstanceUID]) return [];
    const metadata =
      displaySets[selectedDisplaySetInstanceUID]?.images[instanceNumber - 1];

    const tags = getSortedTags(metadata);
    return tags.map((tag, index) => ({
      key: index,
      tag: `${tag.tagIndent}${tag.tag}`,
      vr: tag.vr,
      keyword: tag.keyword,
      value: tag.value || "",
    }));
  }, [instanceNumber, selectedDisplaySetInstanceUID, displaySets]);

  const columns = [
    {
      title: "Tag",
      dataIndex: "tag",
      key: "tag",
      width: "20%",
    },
    {
      title: "VR",
      dataIndex: "vr",
      key: "vr",
      width: "10%",
    },
    {
      title: "Keyword",
      dataIndex: "keyword",
      key: "keyword",
      width: "30%",
    },
    {
      title: "Value",
      dataIndex: "value",
      key: "value",
      width: "40%",
    },
  ];

  const filteredData = useMemo(() => {
    if (!filterValue) return tableData;

    return tableData.filter(
      (item) =>
        item.tag.toLowerCase().includes(filterValue.toLowerCase()) ||
        item.keyword.toLowerCase().includes(filterValue.toLowerCase()) ||
        item.value.toString().toLowerCase().includes(filterValue.toLowerCase())
    );
  }, [filterValue, tableData]);

  const instanceSliderMarks = useMemo(() => {
    if (!displaySets[selectedDisplaySetInstanceUID]) return {};
    const totalInstances =
      displaySets[selectedDisplaySetInstanceUID].images.length;

    // Create marks for first, middle, and last instances only
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

      <Table
        columns={columns}
        dataSource={filteredData}
        pagination={false}
        size="small"
        scroll={{ y: 400 }}
        loading={isLoading}
      />
    </div>
  );
};

export default DicomTagBrowser;
