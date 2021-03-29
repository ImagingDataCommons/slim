const isEqualServer = (server = {}, toCompare = {}) => {
  const serverLength = Object.keys(server).length;
  const toCompareLength = Object.keys(toCompare).length;

  if (!serverLength || !toCompareLength) {
    return false;
  }

  return (
    server.dataset === toCompare.dataset &&
    server.dataset === toCompare.dataset &&
    server.dicomStore === toCompare.dicomStore &&
    server.location === toCompare.location &&
    server.project === toCompare.project
  );
};

export default isEqualServer;
