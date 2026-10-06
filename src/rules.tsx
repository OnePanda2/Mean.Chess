import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RulesApp } from './app/RulesApp.tsx'
import './styles/base.css'
import './styles/layout.css'
import './styles/board.css'
import './styles/rules.css'

const container = document.getElementById('root')
if (!container) throw new Error('Mean Chess: missing #root element')

createRoot(container).render(
  <StrictMode>
    <RulesApp />
  </StrictMode>,
)
