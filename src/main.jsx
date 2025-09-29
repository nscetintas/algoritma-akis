import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Stil importları SADECE burada:
import '@xyflow/react/dist/style.css'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
