import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function DesktopStartupReady({ children }) {
  useEffect(() => {
    if (!window.festosDesktop?.notifyReady) return undefined
    let secondFrame
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        window.festosDesktop?.notifyReady?.()
      })
    })
    return () => {
      cancelAnimationFrame(firstFrame)
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame)
    }
  }, [])
  return children
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DesktopStartupReady>
      <App />
    </DesktopStartupReady>
  </StrictMode>,
)
