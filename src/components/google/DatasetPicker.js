import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

import api from "../../google/api/GoogleCloudApi";
import DatasetsList from "./DatasetsList";
import "./googleCloud.css";

const DatasetPicker = ({ project, location, accessToken, onSelect }) => {
  const [state, setState] = useState({
    error: null,
    loading: true,
    datasets: [],
    filterStr: "",
  });

  const onFirstLoad = async () => {
    api.setAccessToken(accessToken);

    const response = await api.loadDatasets(
      project.projectId,
      location.locationId
    );

    if (response.isError) {
      setState((state) => ({ ...state, error: response.message }));
      return;
    }

    setState((state) => ({
      ...state,
      datasets: response.data.datasets || [],
      loading: false,
    }));
  };

  useEffect(() => {
    onFirstLoad();
  }, []);

  const onFilterChange = (e) =>
    setState((state) => ({ ...state, filterStr: e.target.value }));

  const { datasets, loading, error, filterStr } = state;
  return (
    <div>
      <input
        className="form-control gcp-input"
        type="text"
        value={filterStr}
        onChange={onFilterChange}
      />
      <DatasetsList
        datasets={datasets}
        loading={loading}
        error={error}
        filter={filterStr}
        onSelect={onSelect}
      />
    </div>
  );
};

DatasetPicker.propTypes = {
  project: PropTypes.object,
  location: PropTypes.object,
  onSelect: PropTypes.func,
  accessToken: PropTypes.string,
};

export default DatasetPicker;
