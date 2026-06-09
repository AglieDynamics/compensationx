import {
  Activity,
  Calculator,
  ClipboardList,
  Coins,
  Database,
  GraduationCap,
  Hourglass,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  type LucideIcon,
  SlidersHorizontal,
  Table2,
  TrendingUp,
  Waypoints,
} from 'lucide-react';

export type NavGroup = 'Benchmarking' | 'Capital Allocation';

export interface NavItem {
  path: string;
  label: string;
  short: string;
  icon: LucideIcon;
  group: NavGroup;
}

export const NAV_ITEMS: NavItem[] = [
  // --- Benchmarking (v1) ---
  { path: '/', label: 'Summary Dashboard', short: 'Dashboard', icon: LayoutDashboard, group: 'Benchmarking' },
  { path: '/worksheet', label: 'Benchmark Worksheet', short: 'Worksheet', icon: Table2, group: 'Benchmarking' },
  { path: '/summary', label: 'Executive Summary', short: 'Summary', icon: LineChart, group: 'Benchmarking' },
  { path: '/budget', label: 'Budget Simulator', short: 'Budget', icon: Calculator, group: 'Benchmarking' },
  { path: '/career', label: 'Additional Career Issues', short: 'Career', icon: GraduationCap, group: 'Benchmarking' },
  { path: '/data', label: 'Data Ingestion', short: 'Data', icon: Database, group: 'Benchmarking' },
  { path: '/pulse', label: 'Pulse Survey', short: 'Pulse', icon: Waypoints, group: 'Benchmarking' },

  // --- Capital Allocation (v2) ---
  { path: '/capital/inputs', label: 'Inputs & Assumptions', short: 'Inputs', icon: SlidersHorizontal, group: 'Capital Allocation' },
  { path: '/capital/convexity', label: 'Human Capital Convexity', short: 'Convexity', icon: TrendingUp, group: 'Capital Allocation' },
  { path: '/capital/value-density', label: 'Workforce Value Density', short: 'Value Density', icon: LayoutGrid, group: 'Capital Allocation' },
  { path: '/capital/frontier', label: 'Pay-Productivity Frontier', short: 'Frontier', icon: Activity, group: 'Capital Allocation' },
  { path: '/capital/cost-of-inaction', label: 'Cost of Inaction', short: 'Cost of Inaction', icon: Hourglass, group: 'Capital Allocation' },
  { path: '/capital/total-cost', label: 'Total Workforce Cost', short: 'Total Cost', icon: Coins, group: 'Capital Allocation' },
  { path: '/capital/brief', label: 'Capital Allocation Brief', short: 'Brief', icon: ClipboardList, group: 'Capital Allocation' },
];
