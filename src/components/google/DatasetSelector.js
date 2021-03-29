import React, { useState } from "react";

/** Components */
import DicomStorePicker from "./DICOMStorePicker";
import DatasetPicker from "./DatasetPicker";
import ProjectPicker from "./ProjectPicker";
import LocationPicker from "./LocationPicker";
import GoogleCloudApi from "../../google/api/GoogleCloudApi";

/** Providers */
import { useAuth } from "../../providers/AuthProvider";

/** Styles */
import "./googleCloud.less";

const DatasetSelector = ({ onServerSelected }) => {
  const { user } = useAuth();

  const [state, setState] = useState({
    project: null,
    location: null,
    dataset: null,
    unloading: false,
  });

  const upstate = (state) => setState((s) => ({ ...s, ...state }));
  const onProjectSelect = (project) => upstate({ project });
  const onLocationSelect = (location) => upstate({ location });
  const onDatasetSelect = (dataset) => upstate({ dataset });
  const onLocationClick = () => upstate({ dataset: null, location: null });
  const onDatasetClick = () => upstate({ dataset: null });
  const onProjectClick = () =>
    upstate({
      dataset: null,
      location: null,
      project: null,
    });

  const onDicomStoreSelect = (dicomStoreJson) => {
    const dicomStore = dicomStoreJson.name;
    const parts = dicomStore.split("/");
    const result = {
      wadoUriRoot: GoogleCloudApi.urlBase + `/${dicomStore}/dicomWeb`,
      qidoRoot: GoogleCloudApi.urlBase + `/${dicomStore}/dicomWeb`,
      wadoRoot: GoogleCloudApi.urlBase + `/${dicomStore}/dicomWeb`,
      project: parts[1],
      location: parts[3],
      dataset: parts[5],
      dicomStore: parts[7],
    };
    onServerSelected(result);
  };

  const accessToken = user.getAccessToken();

  const { project, location, dataset } = state;

  let projectBreadcrumbs = (
    <div className="gcp-picker--path">
      <span>{"Select a Project"}</span>
    </div>
  );

  if (project) {
    projectBreadcrumbs = (
      <div className="gcp-picker--path">
        <span onClick={onProjectClick}>{project.name}</span>
        {project && location && (
          <span onClick={onLocationClick}> {location.name.split("/")[3]}</span>
        )}
        {project && location && dataset && (
          <span onClick={onDatasetClick}> {dataset.name.split("/")[5]}</span>
        )}
      </div>
    );
  }

  return (
    <>
      {projectBreadcrumbs}
      {!project && (
        <ProjectPicker accessToken={accessToken} onSelect={onProjectSelect} />
      )}
      {project && !location && (
        <LocationPicker
          accessToken={accessToken}
          project={project}
          onSelect={onLocationSelect}
        />
      )}
      {project && location && !dataset && (
        <DatasetPicker
          accessToken={accessToken}
          project={project}
          location={location}
          onSelect={onDatasetSelect}
        />
      )}
      {project && location && dataset && (
        <DicomStorePicker
          accessToken={accessToken}
          dataset={dataset}
          onSelect={onDicomStoreSelect}
        />
      )}
    </>
  );
};

export default DatasetSelector;
