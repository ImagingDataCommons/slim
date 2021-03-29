import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

import api from "../../google/api/GoogleCloudApi";
import DICOMStoreList from "./DICOMStoreList";
import "./googleCloud.css";

const DICOMStorePicker = ({ dataset, accessToken, onSelect }) => {
  const [state, setState] = useState({
    error: null,
    loading: true,
    stores: [],
    locations: [],
    filterStr: "",
  });

  const onFilterChangeHandler = (e) => {
    setState((state) => ({ ...state, filterStr: e.target.value }));
  };

  const onFirstLoad = async () => {
    api.setAccessToken(accessToken);
    const response = await api.loadDicomStores(dataset.name);

    if (response.isError) {
      setState((state) => ({ ...state, error: response.message }));
      return;
    }

    setState((state) => ({
      ...state,
      stores: response.data.dicomStores || [],
      loading: false,
    }));
  };

  useEffect(() => {
    onFirstLoad();
  }, []);

  return (
    <div>
      <input
        className="form-control gcp-input"
        type="text"
        value={state.filterStr}
        onChange={onFilterChangeHandler}
      />
      <DICOMStoreList
        stores={state.stores}
        loading={state.loading}
        error={state.error}
        filter={state.filterStr}
        onSelect={onSelect}
      />
    </div>
  );
};

DICOMStorePicker.propTypes = {
  dataset: PropTypes.object,
  onSelect: PropTypes.func,
  accessToken: PropTypes.string.isRequired,
};

export default DICOMStorePicker;
