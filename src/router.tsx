import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './App';
import { Dashboard } from './modules/dashboard/Dashboard';
import { RouteFallback } from './components/layout/RouteFallback';

// Dashboard is eager (landing route); the rest are code-split so heavy deps
// (notably `xlsx`, used only by Data Ingestion) load on demand.
const Worksheet = lazy(() => import('./modules/worksheet/Worksheet').then((m) => ({ default: m.Worksheet })));
const ExecutiveSummary = lazy(() =>
  import('./modules/summary/ExecutiveSummary').then((m) => ({ default: m.ExecutiveSummary })),
);
const BudgetSimulator = lazy(() =>
  import('./modules/budget/BudgetSimulator').then((m) => ({ default: m.BudgetSimulator })),
);
const CareerIssues = lazy(() => import('./modules/career/CareerIssues').then((m) => ({ default: m.CareerIssues })));
const DataIngestion = lazy(() => import('./modules/data/DataIngestion').then((m) => ({ default: m.DataIngestion })));
const PulseSurvey = lazy(() => import('./modules/pulse/PulseSurvey').then((m) => ({ default: m.PulseSurvey })));

function lazyRoute(element: React.ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppLayout />,
      children: [
        { index: true, element: <Dashboard /> },
        { path: 'worksheet', element: lazyRoute(<Worksheet />) },
        { path: 'summary', element: lazyRoute(<ExecutiveSummary />) },
        { path: 'budget', element: lazyRoute(<BudgetSimulator />) },
        { path: 'career', element: lazyRoute(<CareerIssues />) },
        { path: 'data', element: lazyRoute(<DataIngestion />) },
        { path: 'pulse', element: lazyRoute(<PulseSurvey />) },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
    },
  },
);
