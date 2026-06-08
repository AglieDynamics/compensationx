import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Dashboard } from '@/modules/dashboard/Dashboard';
import { useAppStore } from '@/store/useAppStore';
import { LEVELS } from '@/domain/levels';

function resetStore() {
  useAppStore.setState({
    weighting: 'FIRM',
    period: 'TARGET',
    component: 'BASIC_SALARY',
    levels: [...LEVELS],
    targetPercentile: 0.5,
    source: 'seed',
  });
}

describe('Dashboard (DoD #2 / #3)', () => {
  beforeEach(() => resetStore());

  it('renders the default view with real seed data and KPIs', () => {
    render(<Dashboard />);
    expect(screen.getByText('Summary Dashboard')).toBeInTheDocument();

    // KPI strip: 19 firms / 5,067 market / 551 firm incumbents
    // (5,067 also appears in the scope chip, so allow multiple)
    expect(screen.getAllByText('5,067').length).toBeGreaterThan(0);
    expect(screen.getByText('551')).toBeInTheDocument();

    // Overall (headcount-weighted) compa-ratio ≈ 1.08
    expect(screen.getByText('1.08')).toBeInTheDocument();

    // An1 market median 44.32 appears in the percentile table
    expect(screen.getAllByText('44.32').length).toBeGreaterThan(0);
    // 75th / 95th / 5th reported values present
    expect(screen.getAllByText('46.59').length).toBeGreaterThan(0);
    expect(screen.getAllByText('59.07').length).toBeGreaterThan(0);
    expect(screen.getAllByText('34.54').length).toBeGreaterThan(0);
  });

  it('handles a missing combination with an empty-state, not a crash or NaN', () => {
    useAppStore.setState({ weighting: 'INCUMBENT' });
    const { container } = render(<Dashboard />);
    // KPI scope still renders from meta
    expect(screen.getAllByText('5,067').length).toBeGreaterThan(0);
    // No NaN leaks anywhere
    expect(container.textContent ?? '').not.toContain('NaN');
    // Empty-state copy shown for the absent combo
    expect(screen.getAllByText(/Ingest the source workbook/i).length).toBeGreaterThan(0);
  });

  it('expands only selected levels into rungs + aggregate', () => {
    useAppStore.setState({ levels: ['An'] });
    render(<Dashboard />);
    const tables = screen.getAllByRole('table');
    const percentileTable = tables[tables.length - 1];
    const body = within(percentileTable!);
    // An rungs present
    expect(body.getAllByText('An1').length).toBeGreaterThan(0);
    // Manager rungs absent
    expect(body.queryByText('M1')).toBeNull();
  });
});
