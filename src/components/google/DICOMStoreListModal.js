import React, { useEffect, useState } from "react";
import Modal from "react-modal";

/** Google */
import api from "../../google/api/GoogleCloudApi";

/** Components */
import DICOMStoreList from "./DICOMStoreList";

/** Utils */
import { getServers } from "../../google/utils";

/** Providers */
import { useServer } from "../../providers/ServerProvider";
import { useApp } from "../../providers/AppProvider";
import { useAuth } from "../../providers/AuthProvider";

const DICOMStoreListModal = ({ onClose = () => {}, isOpen = false }) => {
  const [state, setState] = useState({
    stores: [],
    isLoading: false,
    filterStr: "",
  });
  const { setServers } = useServer();
  const { user } = useAuth();
  const { config: appConfig } = useApp();

  useEffect(() => {
    const loadStores = async () => {
      try {
        setState((state) => ({ ...state, isLoading: true }));
        api.setAccessToken(user.getAccessToken());
        const stores = await api.getAllDICOMStores();
        setState((state) => ({ ...state, stores, isLoading: false }));
      } catch (error) {
        console.error("Failed to load default google dicom stores", error);
      }
    };

    if (user && appConfig.enableGoogleCloudAdapter) {
      loadStores();
    }
  }, [user, appConfig.enableGoogleCloudAdapter]);

  const onSelectHandler = (dicomStoreJson) => {
    const dicomStore = dicomStoreJson.name;
    const parts = dicomStore.split("/");
    const result = {
      wadoUriRoot: api.urlBase + `/${dicomStore}/dicomWeb`,
      qidoRoot: api.urlBase + `/${dicomStore}/dicomWeb`,
      wadoRoot: api.urlBase + `/${dicomStore}/dicomWeb`,
      project: parts[1],
      location: parts[3],
      dataset: parts[5],
      dicomStore: parts[7],
    };
    const servers = getServers(result);
    setServers(servers);
    onClose();
  };

  const onFilterChangeHandler = (e) => {
    e.persist();
    setState((state) => ({ ...state, filterStr: e.target.value }));
  };

  return (
    <Modal
      isOpen={isOpen}
      contentLabel="Google Cloud Healthcare API"
      onRequestClose={onClose}
      shouldCloseOnOverlayClick
  >
      <div>
        <h2>Google Cloud Healthcare API</h2>
        <input
          className="form-control gcp-input"
          type="text"
          value={state.filterStr}
          onChange={onFilterChangeHandler}
          placeholder="Search..."
        />
        <DICOMStoreList
          stores={state.stores}
          loading={state.isLoading}
          error={state.error}
          filter={state.filterStr}
          onSelect={onSelectHandler}
        />
      </div>
    </Modal>
  );
};

export default DICOMStoreListModal;
