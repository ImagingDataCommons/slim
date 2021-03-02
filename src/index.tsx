import React from 'react'
import ReactDOM from 'react-dom'
import { message } from 'antd'
import './index.css'
import App from './BrightField'

// expose app for configuration from js login code
declare global {
  interface Window {
    app:any;
  }
}

console.log(window.localStorage.getItem('slim_dicomWeb_url'));
console.log(window.sessionStorage.getItem('slim_google_access_token'));

let slim_dicomWeb_url = window.localStorage.getItem('slim_dicomWeb_url') + "/dicomWeb";
let slim_google_access_token = window.sessionStorage.getItem('slim_google_access_token');

// @ts-ignore
const createdApp = ReactDOM.render(
  React.createElement(
    App,
    { dicomwebUrl: slim_dicomWeb_url || "",
      dicomwebPath: slim_dicomWeb_url || "",
      qidoPathPrefix: slim_dicomWeb_url || "",
      wadoPathPrefix: slim_dicomWeb_url || "",
      access_token: slim_google_access_token || "",
    }, null),
  document.getElementById('root')
);

window.app = createdApp;
