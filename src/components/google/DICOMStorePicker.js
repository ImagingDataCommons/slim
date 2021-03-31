import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

/** Components */
import api from "../../google/api/GoogleCloudApi";
import DICOMStoreList from "./DICOMStoreList";

/** Styles */
import "./googleCloud.less";

const DICOMStorePicker = ({ dataset, accessToken, onSelect }) => {
  const [state, setState] = useState({
    error: null,
    loading: true,
    stores: [],
    locations: [],
    filterStr: "",
  });

  const onFilterChangeHandler = (e) => {
    e.persist();
    setState((state) => ({ ...state, filterStr: e.target.value }));
  };

  useEffect(() => {

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
  
    onFirstLoad();
  }, [accessToken, dataset.name]);

  return (
    <div>
      <input
        className="form-control gcp-input"
        type="text"
        value={state.filterStr}
        onChange={onFilterChangeHandler}
        placeholder="Search..."
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
