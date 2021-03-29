import React, { useState } from "react";
import PropTypes from "prop-types";

import "./googleCloud.css";

const Icon = () => <div>Mocked</div>;

const DatasetsList = ({ loading, datasets, filter, error, onSelect }) => {
  const [state, setState] = useState({
    search: "",
  });

  const onHighlightItem = (dataset) => {
    setState((state) => ({ ...state, highlightedItem: dataset }));
  };

  const renderTableRow = (dataset) => {
    return (
      <tr
        key={dataset.name}
        className={
          state.highlightedItem === dataset.name
            ? "noselect active"
            : "noselect"
        }
        onMouseEnter={() => {
          onHighlightItem(dataset.name);
        }}
        onClick={() => onSelect(dataset)}
      >
        <td>{dataset.name.split("/")[5]}</td>
      </tr>
    );
  };

  if (error) {
    return <p>{error}</p>;
  }

  const loadingIcon = (
    <Icon name="circle-notch" className="loading-icon-spin loading-icon" />
  );

  if (loading) {
    return loadingIcon;
  }

  const body = (
    <tbody id="DatasetList">
      {datasets
        .filter(
          (dataset) =>
            dataset.name
              .split("/")[5]
              .toLowerCase()
              .includes(filter.toLowerCase()) || filter == ""
        )
        .map(renderTableRow)}
    </tbody>
  );

  return (
    <table id="tblDatasetList" className="gcp-table table noselect">
      <thead>
        <tr>
          <th>{"Dataset"}</th>
        </tr>
      </thead>
      {datasets && body}
    </table>
  );
};

DatasetsList.propTypes = {
  datasets: PropTypes.array,
  loading: PropTypes.bool,
  error: PropTypes.string,
  onSelect: PropTypes.func,
};

DatasetsList.defaultProps = {
  loading: true,
};

export default DatasetsList;
