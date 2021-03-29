const isValidServer = server => {
  return (
    server &&
    !!server.dataset &&
    !!server.dicomStore &&
    !!server.location &&
    !!server.project
  );
};

export default isValidServer;