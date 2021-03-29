import React from "react";
import PropTypes from "prop-types";
import Modal from "react-modal";

import DICOMUploader from "./DICOMUploader";
import { useServer } from "../../providers/ServerProvider";

const DICOMFileUploaderModal = ({ isOpen = false, onClose }) => {
  const { servers } = useServer();
  const activeServer = servers.find(s => !!s.active);

  const url = activeServer.qidoRoot;
  const retrieveAuthHeaderFunction = OHIF.DICOMWeb.getAuthorizationHeader(
    activeServer
  );

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Upload DICOM Files"
    >
      <DICOMUploader
        url={url}
        retrieveAuthHeaderFunction={retrieveAuthHeaderFunction}
      />
    </Modal>
  );
};

DICOMFileUploaderModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
};

export default DICOMFileUploaderModal;
