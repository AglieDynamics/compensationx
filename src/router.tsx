import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Landing } from './modules/landing/Landing';
import { RequireAuth } from './modules/auth/RequireAuth';
import { Cockpit } from './modules/operate/Cockpit';
import { RouteFallback } from './components/layout/RouteFallback';
import { RouteError } from './components/layout/RouteError';

// Cockpit is eager (landing route); the rest are code-split.
const Dashboard = lazy(() => import('./modules/dashboard/Dashboard').then((m) => ({ default: m.Dashboard })));
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

// --- Capital Allocation (v2) ---
const InputsAssumptions = lazy(() => import('./modules/capital/InputsAssumptions').then((m) => ({ default: m.InputsAssumptions })));
const Convexity = lazy(() => import('./modules/capital/Convexity').then((m) => ({ default: m.Convexity })));
const ValueDensity = lazy(() => import('./modules/capital/ValueDensity').then((m) => ({ default: m.ValueDensity })));
const Frontier = lazy(() => import('./modules/capital/Frontier').then((m) => ({ default: m.Frontier })));
const CostOfInaction = lazy(() => import('./modules/capital/CostOfInaction').then((m) => ({ default: m.CostOfInaction })));
const TotalCost = lazy(() => import('./modules/capital/TotalCost').then((m) => ({ default: m.TotalCost })));
const CapitalBrief = lazy(() => import('./modules/capital/CapitalBrief').then((m) => ({ default: m.CapitalBrief })));

// --- Operate (v3) ---
const JobPricing = lazy(() => import('./modules/operate/JobPricing').then((m) => ({ default: m.JobPricing })));
const RangesDesigner = lazy(() => import('./modules/operate/RangesDesigner').then((m) => ({ default: m.RangesDesigner })));
const EmployeesManager = lazy(() => import('./modules/operate/EmployeesManager').then((m) => ({ default: m.EmployeesManager })));

function lazyRoute(element: React.ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

export const router = createBrowserRouter(
  [
    // Public marketing landing — renders standalone, outside the app shell.
    { path: '/', element: <Landing />, errorElement: <RouteError /> },
    {
      // Platform — every authenticated/app surface lives under the side-nav shell,
      // gated behind the demo sign-in (RequireAuth renders AppLayout once unlocked).
      element: <RequireAuth />,
      // Crash in any child module degrades to a recoverable panel, not a blank screen.
      errorElement: <RouteError />,
      children: [
        { path: 'app', element: <Cockpit /> },
        { path: 'pricing', element: lazyRoute(<JobPricing />) },
        { path: 'structure', element: lazyRoute(<RangesDesigner />) },
        { path: 'employees', element: lazyRoute(<EmployeesManager />) },
        { path: 'dashboard', element: lazyRoute(<Dashboard />) },
        { path: 'worksheet', element: lazyRoute(<Worksheet />) },
        { path: 'summary', element: lazyRoute(<ExecutiveSummary />) },
        { path: 'budget', element: lazyRoute(<BudgetSimulator />) },
        { path: 'career', element: lazyRoute(<CareerIssues />) },
        { path: 'data', element: lazyRoute(<DataIngestion />) },
        { path: 'pulse', element: lazyRoute(<PulseSurvey />) },
        { path: 'capital/inputs', element: lazyRoute(<InputsAssumptions />) },
        { path: 'capital/convexity', element: lazyRoute(<Convexity />) },
        { path: 'capital/value-density', element: lazyRoute(<ValueDensity />) },
        { path: 'capital/frontier', element: lazyRoute(<Frontier />) },
        { path: 'capital/cost-of-inaction', element: lazyRoute(<CostOfInaction />) },
        { path: 'capital/total-cost', element: lazyRoute(<TotalCost />) },
        { path: 'capital/brief', element: lazyRoute(<CapitalBrief />) },
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
