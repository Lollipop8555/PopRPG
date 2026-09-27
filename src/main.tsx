import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import './styles/theme.css'
import './styles/layout.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root 不见了')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
