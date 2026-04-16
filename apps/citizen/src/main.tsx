import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  return <div>Bantayog Alert — Citizen</div>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
