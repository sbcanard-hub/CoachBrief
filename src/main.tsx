import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import './tactics.css'
import './pages/offshoreDepartureCity.css'
import './pages/landingPage.css'
import { registerServiceWorker } from './pwa'
import { PreferencesProvider } from './preferences'
import { installOpenMeteoRelay } from './openMeteoRelay'

installOpenMeteoRelay()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreferencesProvider><HashRouter><App /></HashRouter></PreferencesProvider>
  </StrictMode>,
)
