import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/outfit'
import './styles/tokens.css'
import './styles/base.css'
import App from './App'
import { isElectron } from './lib/env'
import { storedTheme } from './shell/theme'

// Before first paint: where we run, and the theme used last time (the save confirms it once loaded).
const html = document.documentElement
html.classList.toggle('is-electron', isElectron)
html.dataset.theme = storedTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
