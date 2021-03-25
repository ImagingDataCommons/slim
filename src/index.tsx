import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';

ReactDOM.render(
  <React.StrictMode>
    <App
      dicomwebUrl={process.env.REACT_APP_DICOMWEB_URL}
      dicomwebPath={process.env.REACT_APP_DICOMWEB_PATH}
      qidoPathPrefix={process.env.REACT_APP_DICOMWEB_QIDO_PATH_PREFIX}
      wadoPathPrefix={process.env.REACT_APP_DICOMWEB_WADO_PATH_PREFIX}
    />
  </React.StrictMode>,
  document.getElementById('root')
);
