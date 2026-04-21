import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

export function TestWrapper({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createTestQueryClient())
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
