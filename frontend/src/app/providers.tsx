import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { CopilotChatProvider } from '../hooks/useCopilotChat'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: false, staleTime: 30_000, gcTime: 5 * 60_000 },
    },
  })
}

export function Providers({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const qc = client ?? makeQueryClient()
  return (
    <QueryClientProvider client={qc}>
      <CopilotChatProvider>{children}</CopilotChatProvider>
    </QueryClientProvider>
  )
}
