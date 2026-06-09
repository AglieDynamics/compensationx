import { ArrowRight, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { scenarioPayCost } from '@/lib/capital';
import { useCapitalContext } from '@/lib/capitalContext';
import { formatSignedValue } from '@/lib/format';

/**
 * Baseline → Scenario delta banner. Renders only when a scenario is active, so
 * host modules (e.g. the v1 Budget Simulator) are visually unchanged on Baseline.
 */
export function ScenarioDeltaNote() {
  const { scenario, baseline, scenarioBases, component } = useCapitalContext();
  if (!scenario || !scenarioBases) return null;

  const cost = scenarioPayCost(baseline, scenarioBases);
  const unit = component === 'BONUS_PCT' ? 'RATIO' : 'GND_K';

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-navy-500/30 bg-navy-500/[0.06] px-4 py-2.5 text-sm">
      <span className="flex items-center gap-1.5 font-semibold text-navy-700">
        <Layers size={15} /> Scenario: {scenario.name}
      </span>
      <span className="text-ink-soft">
        Pay cost vs baseline{' '}
        <span className="font-semibold tabular-nums text-navy-700">
          {formatSignedValue(cost, unit, { decimals: 0, group: true })} {unit === 'RATIO' ? '' : 'GND k'}
        </span>
      </span>
      <Link
        to="/capital/brief"
        className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-navy-500 hover:text-navy-700"
      >
        Capital Brief <ArrowRight size={13} />
      </Link>
    </div>
  );
}
