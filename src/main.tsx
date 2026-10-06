import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.tsx'
import { syncMotionAttribute } from './components/layout/motionPreference'
import './styles/index.css'

// V0.49: the Animation switch also drives UI motion via <html data-motion>.
syncMotionAttribute()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
