import React, { Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import './styles.css'

// Three addresses: the home page, /admin, and a 404 page for anything else. (A tiny router is enough, so no extra library.)
const Admin = lazy(() => import('./admin/Admin.jsx'))
const NotFound = lazy(() => import('./NotFound.jsx'))

const path = (window.location.pathname.replace(/\/+$/, '') || '/').toLowerCase()
const page =
  path === '/' || path === '/index.html' ? <App />
  : path === '/admin' ? <Suspense fallback={null}><Admin /></Suspense>
  : <Suspense fallback={null}><NotFound /></Suspense>

createRoot(document.getElementById('root')).render(page)