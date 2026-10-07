import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PlayApp } from './app/PlayApp.tsx'
import './styles/base.css'
import './styles/layout.css'
import './styles/board.css'
import './styles/pieces.css'
import './styles/themes.css'

const container = document.getElementById('root')
if (!container) throw new Error('Mean Chess: missing #root element')

createRoot(container).render(
  <StrictMode>
    <PlayApp />
  </StrictMode>,
)
