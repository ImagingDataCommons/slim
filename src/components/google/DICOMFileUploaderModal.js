import React from "react";
import PropTypes from "prop-types";
import Modal from "react-modal";

/** Components */
import DICOMUploader from "./DICOMUploader";

/** Providers */
import { useServer } from "../../providers/ServerProvider";
import { useAuth } from "../../providers/AuthProvider";

/** Utils */
import { getAuthorizationHeader } from "../../utils";

const DICOMFileUploaderModal = ({ isOpen = false, onClose }) => {
  const { user } = useAuth();
  const { servers } = useServer();
  const activeServer = servers.find((s) => !!s.active);

  const url = activeServer.qidoRoot;
  const retrieveAuthHeaderFunction = getAuthorizationHeader(activeServer, user);

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
