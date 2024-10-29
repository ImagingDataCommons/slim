// @ts-nocheck
import dcmjs from 'dcmjs';
import moment from 'moment';
import { useState, useMemo } from 'react';
import { Select, Input, Table, Typography, Slider } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

import './DicomTagBrowser.css';
import { useSlides } from '../../hooks/useSlides';
import { getSortedTags } from './dicomTagUtils';

const { DicomMetaDictionary } = dcmjs.data;
const { nameMap } = DicomMetaDictionary;
const { Option } = Select;

const DicomTagBrowser = () => {
  const { slides } = useSlides();

  const displaySets = slides.map((slide, index) => {
    const { volumeImages } = slide;
    const { SeriesDate, SeriesTime, SeriesNumber, SeriesDescription, Modality } = volumeImages[0];
    return {
      displaySetInstanceUID: index,
      SeriesDate,
      SeriesTime,
      SeriesNumber,
      SeriesDescription,
      Modality,
      images: volumeImages,
    };
  });

  // Set initial displaySetInstanceUID based on first available displaySet
  const initialDisplaySetInstanceUID = displaySets.length > 0 ? displaySets[0].displaySetInstanceUID : 0;

  const [selectedDisplaySetInstanceUID, setSelectedDisplaySetInstanceUID] = 
    useState(initialDisplaySetInstanceUID);
  const [instanceNumber, setInstanceNumber] = useState(1);
  const [filterValue, setFilterValue] = useState('');

  const displaySetList = useMemo(() => {
    displaySets.sort((a, b) => a.SeriesNumber - b.SeriesNumber);
    return displaySets.map(displaySet => {
      const {
        displaySetInstanceUID,
        SeriesDate,
        SeriesTime,
        SeriesNumber,
        SeriesDescription,
        Modality,
      } = displaySet;

      const dateStr = `${SeriesDate}:${SeriesTime}`.split('.')[0];
      const date = moment(dateStr, 'YYYYMMDD:HHmmss');
      const displayDate = date.format('ddd, MMM Do YYYY');

      return {
        value: displaySetInstanceUID,
        label: `${SeriesNumber} (${Modality}): ${SeriesDescription}`,
        description: displayDate,
      };
    });
  }, [displaySets]);

  const activeDisplaySet = displaySets.find(
    ds => ds.displaySetInstanceUID === selectedDisplaySetInstanceUID
  );

  const showInstanceList = activeDisplaySet.images.length > 1;

  const tableData = useMemo(() => {
    const metadata = activeDisplaySet.images[instanceNumber - 1];
    
    const tags = getSortedTags(metadata);
    return tags.map((tag, index) => ({
      key: index,
      tag: `${tag.tagIndent}${tag.tag}`,
      vr: tag.vr,
      keyword: tag.keyword,
      value: tag.value || ''
    }));
  }, [instanceNumber, activeDisplaySet]);

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
  ];

  const filteredData = filterValue
    ? tableData.filter(
        item =>
          item.tag.toLowerCase().includes(filterValue.toLowerCase()) ||
          item.keyword.toLowerCase().includes(filterValue.toLowerCase()) ||
          item.value.toString().toLowerCase().includes(filterValue.toLowerCase())
      )
    : tableData;

  const instanceSliderMarks = useMemo(() => {
    if (!activeDisplaySet) return {};
    const totalInstances = activeDisplaySet.images.length;
    
    // Create marks for first, middle, and last instances only
    const marks: Record<number, string> = {
      1: '1',  // First
      [Math.ceil(totalInstances / 2)]: Math.ceil(totalInstances / 2).toString(),  // Middle
      [totalInstances]: totalInstances.toString()  // Last
    };
    
    return marks;
  }, [activeDisplaySet]);

  return (
    <div className="dicom-tag-browser-content">
      <div className="mb-6">
        <div className="w-full mb-4">
          <Typography.Text strong>Series</Typography.Text>
          <Select
            style={{ width: '100%' }}
            value={selectedDisplaySetInstanceUID}
            defaultValue={initialDisplaySetInstanceUID}
            onChange={value => {
              setSelectedDisplaySetInstanceUID(value);
              setInstanceNumber(1);
            }}
            optionLabelProp="label"
            optionFilterProp="label"
          >
            {displaySetList.map(item => (
              <Option 
                key={item.value} 
                value={item.value}
                label={item.label}
              >
                <div>
                  <div>{item.label}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.45)' }}>{item.description}</div>
                </div>
              </Option>
            ))}
          </Select>
        </div>
        
        {showInstanceList && (
          <div className="w-full">
            <div className="flex justify-between items-center">
              <Typography.Text strong>Instance Number: {instanceNumber}</Typography.Text>
              <Typography.Text type="secondary">
                Total: {activeDisplaySet.images.length}
              </Typography.Text>
            </div>
            <Slider
              min={1}
              max={activeDisplaySet.images.length}
              value={instanceNumber}
              onChange={value => setInstanceNumber(value)}
              marks={instanceSliderMarks}
              tooltip={{
                formatter: value => `Instance ${value}`
              }}
              style={{ marginTop: 8 }}
            />
          </div>
        )}
      </div>

      <Input
        placeholder="Search DICOM tags..."
        prefix={<SearchOutlined />}
        onChange={e => setFilterValue(e.target.value)}
        style={{ marginBottom: 16 }}
      />

      <Table
        columns={columns}
        dataSource={filteredData}
        pagination={false}
        size="small"
        scroll={{ y: 400 }}
      />
    </div>
  );
};

export default DicomTagBrowser;

