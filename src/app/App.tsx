import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { useMemo } from 'react'
import { AppRoutes } from './routes'
import { AuthProvider } from './providers/AuthProvider'
import { DataSourceProvider } from './providers/DataSourceProvider'

export function App() {
  const queryClient = useMemo(() => new QueryClient(), [])

  return (
    <QueryClientProvider client={queryClient}>
      <DataSourceProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </DataSourceProvider>
    </QueryClientProvider>
  )
}
