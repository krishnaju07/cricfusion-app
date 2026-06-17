import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installGuard } from './utils/devtools-guard.js'

installGuard()

// ── Owner console commands ────────────────────────────────────────────────────
// Only works in browsers where cf_dev=1 (console is not flooded/blocked).
// These commands affect ALL visitors site-wide via GitHub Gist.
//
//   __cf.down()              → shut site down for everyone
//   __cf.down('msg')         → shut down with custom message
//   __cf.up()                → restore site for everyone
//   __cf.status()            → check current state
//   __cf.refresh()           → force re-check Gist and update page state
//   __cf.setToken('ghp_...')  → save your GitHub token (one time)
import { siteControl } from './utils/site-status.js'
window.__cf = siteControl

// Register SW as early as possible so it's active before any channel fetch
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
