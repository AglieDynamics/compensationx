import {
  Calculator,
  Database,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  type LucideIcon,
  Table2,
  Waypoints,
} from 'lucide-react';

export type Tier = 'MUST' | 'SHOULD' | 'STRETCH';

export interface NavItem {
  path: string;
  label: string;
  short: string;
  icon: LucideIcon;
  tier: Tier;
  module: number;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Summary Dashboard', short: 'Dashboard', icon: LayoutDashboard, tier: 'MUST', module: 1 },
  { path: '/worksheet', label: 'Benchmark Worksheet', short: 'Worksheet', icon: Table2, tier: 'MUST', module: 2 },
  { path: '/summary', label: 'Executive Summary', short: 'Summary', icon: LineChart, tier: 'MUST', module: 3 },
  { path: '/budget', label: 'Budget Simulator', short: 'Budget', icon: Calculator, tier: 'MUST', module: 4 },
  { path: '/career', label: 'Additional Career Issues', short: 'Career', icon: GraduationCap, tier: 'SHOULD', module: 5 },
  { path: '/data', label: 'Data Ingestion', short: 'Data', icon: Database, tier: 'SHOULD', module: 6 },
  { path: '/pulse', label: 'Pulse Survey', short: 'Pulse', icon: Waypoints, tier: 'STRETCH', module: 7 },
];
