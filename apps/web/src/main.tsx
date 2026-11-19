import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { SessionProvider } from './auth/session'

// Entra sign-in is not built yet; until it is, the session stays empty.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider value={{ token: null, role: null }}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </SessionProvider>
  </StrictMode>,
)
