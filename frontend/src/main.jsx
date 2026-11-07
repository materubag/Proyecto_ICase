import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { retireLegacyWorker } from './utils/retireLegacyWorker';

void retireLegacyWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
