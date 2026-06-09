import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { Convexity } from '@/modules/capital/Convexity';
import { CostOfInaction } from '@/modules/capital/CostOfInaction';
import { TotalCost } from '@/modules/capital/TotalCost';
import { ValueDensity } from '@/modules/capital/ValueDensity';
import { Frontier } from '@/modules/capital/Frontier';
import { CapitalBrief } from '@/modules/capital/CapitalBrief';
import { DEFAULT_ASSUMPTIONS } from '@/lib/assumptions';
import { useInputsStore } from '@/store/inputsStore';
import { useScenarioStore } from '@/store/scenarioStore';
import { useAppStore } from '@/store/useAppStore';
import { LEVELS } from '@/domain/levels';

function renderRoute(el: ReactElement) {
  return render(<MemoryRouter>{el}</MemoryRouter>);
}

function resetStores() {
  useInputsStore.setState({ overrides: {}, provenance: {}, assumptions: { ...DEFAULT_ASSUMPTIONS } });
  useScenarioStore.setState({ scenarios: [], activeScenarioId: null });
  useAppStore.setState({ weighting: 'FIRM', period: 'TARGET', component: 'BASIC_SALARY', levels: [...LEVELS], targetPercentile: 0.5, source: 'seed' });
}

const noNaN = (container: HTMLElement) => expect(container.textContent ?? '').not.toContain('NaN');

describe('Capital lenses render on defaults (no new data)', () => {
  beforeEach(() => resetStores());

  it('Convexity renders the next-best-dollar callout + COI ranking, no NaN', () => {
    const { container } = renderRoute(<Convexity />);
    expect(screen.getByText('Human Capital Convexity')).toBeInTheDocument();
    expect(screen.getByText('Next best pay dollar')).toBeInTheDocument();
    expect(screen.getByText('Convexity Opportunity Index')).toBeInTheDocument();
    noNaN(container);
  });

  it('Cost of Inaction contrasts the present figure with multi-year leakage', () => {
    const { container } = renderRoute(<CostOfInaction />);
    expect(screen.getByText('Cost of Inaction')).toBeInTheDocument();
    expect(screen.getByText('The reframe')).toBeInTheDocument();
    noNaN(container);
  });

  it('Total Workforce Cost renders the cost stack, no NaN', () => {
    const { container } = renderRoute(<TotalCost />);
    expect(screen.getByText('Total Workforce Cost')).toBeInTheDocument();
    expect(screen.getAllByText(/cost stack/i).length).toBeGreaterThan(0);
    noNaN(container);
  });

  it('Value Density shows an empty-state prompting value data when none provided', () => {
    const { container } = renderRoute(<ValueDensity />);
    expect(screen.getByText('Workforce Value Density')).toBeInTheDocument();
    expect(screen.getAllByText(/Load illustrative value data/i).length).toBeGreaterThan(0);
    noNaN(container);
  });

  it('Capital Brief renders the synthesis + headline numbers', () => {
    const { container } = renderRoute(<CapitalBrief />);
    expect(screen.getAllByText('Capital Allocation Brief').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Headline numbers/i).length).toBeGreaterThan(0);
    noNaN(container);
  });
});

describe('Value lenses light up with value data', () => {
  beforeEach(() => {
    resetStores();
    useInputsStore.getState().loadIllustrativeValueData();
  });

  it('Value Density places segments into quadrants', () => {
    const { container } = renderRoute(<ValueDensity />);
    expect(screen.getAllByText(/Protect & Invest/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Value density/i).length).toBeGreaterThan(0);
    noNaN(container);
  });

  it('Frontier fits a line and classifies zones', () => {
    const { container } = renderRoute(<Frontier />);
    expect(screen.getByText('Pay-Productivity Frontier')).toBeInTheDocument();
    noNaN(container);
  });
});
