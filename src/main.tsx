import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './styles/tokens.css'

async function enableMockingIfNeeded() {
  if (import.meta.env.VITE_DATA_SOURCE !== 'supabase') {
    const { worker, mockServiceWorkerOptions } = await import('./mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass', ...mockServiceWorkerOptions })
  }
}

function renderApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

enableMockingIfNeeded()
  .then(renderApp)
  .catch((error) => {
    console.error('Mock 초기화에 실패했습니다. Mock 없이 앱을 렌더링합니다.', error)
    renderApp()
  })
