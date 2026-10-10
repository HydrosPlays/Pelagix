import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/outfit'
import './styles/tokens.css'
import './styles/base.css'
import App from './App'
import { isElectron } from './lib/env'
import { applyLanguage, storedLanguage } from './shell/language'
import { storedTheme } from './shell/theme'

// Before first paint: where we run, and the theme and language used last time (the save confirms them once loaded).
const html = document.documentElement
html.classList.toggle('is-electron', isElectron)
html.dataset.theme = storedTheme()
const language = storedLanguage()
if (language) void applyLanguage(language)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
