import { lazy, Suspense } from 'react'
import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { Skeleton } from '../components/ui/primitives'

const FleetPage = lazy(() => import('../pages/FleetPage'))
const MachineDetailPage = lazy(() => import('../pages/MachineDetailPage'))
const MachinesIndexPage = lazy(() => import('../pages/MachinesIndexPage'))
const FailurePatternsPage = lazy(() => import('../pages/FailurePatternsPage'))
const CopilotPage = lazy(() => import('../pages/CopilotPage'))
const BenchmarksPage = lazy(() => import('../pages/BenchmarksPage'))
const SettingsPage = lazy(() => import('../pages/SettingsPage'))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'))

const fallback = (
  <div className="space-y-4 p-6" aria-busy="true" aria-label="Loading page">
    <Skeleton className="h-8 w-64" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-64 w-full" />
  </div>
)
const wrap = (el: React.ReactNode) => <Suspense fallback={fallback}>{el}</Suspense>

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: wrap(<FleetPage />) },
      { path: 'machines', element: wrap(<MachinesIndexPage />) },
      { path: 'machines/:machineId', element: wrap(<MachineDetailPage />) },
      { path: 'patterns', element: wrap(<FailurePatternsPage />) },
      { path: 'copilot', element: wrap(<CopilotPage />) },
      { path: 'benchmarks', element: wrap(<BenchmarksPage />) },
      { path: 'settings', element: wrap(<SettingsPage />) },
      { path: '*', element: wrap(<NotFoundPage />) },
    ],
  },
]

export const createAppRouter = () => createBrowserRouter(routes)
export const createTestRouter = (initial: string[]) => createMemoryRouter(routes, { initialEntries: initial })
