import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './App.css'

// Debug mode: add ?debug to URL to see errors
const isDebug = window.location.search.includes('debug');

try {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    document.body.innerHTML = '<h1>Candle: #root element not found</h1>';
  } else {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  }
} catch (err: any) {
  const msg = err?.message || String(err);
  document.body.innerHTML = '<div style="padding:20px;font-family:monospace;background:#fff;color:#000"><h2>🕯️ Candle — Startfehler</h2><pre>' + msg + '</pre><p>URL: ' + window.location.href + '</p><p>User Agent: ' + navigator.userAgent + '</p></div>';
}
