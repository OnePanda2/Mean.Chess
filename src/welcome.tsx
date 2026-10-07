import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WelcomeApp } from './app/WelcomeApp.tsx'
import './styles/base.css'
import './styles/layout.css'
import './styles/board.css'
import './styles/pieces.css'
import './styles/themes.css'

// Links shared before the play page moved to /play/ (/?scenario=…) still open the position.
if (new URLSearchParams(window.location.search).has('scenario')) {
  window.location.replace(`/play/${window.location.search}`)
}

const container = document.getElementById('root')
if (!container) throw new Error('Mean Chess: missing #root element')

createRoot(container).render(
  <StrictMode>
    <WelcomeApp />
  </StrictMode>,
)
