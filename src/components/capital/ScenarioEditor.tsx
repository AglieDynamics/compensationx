import { Copy, RotateCcw, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { LEVELS, LEVEL_LABELS } from '@/domain/levels';
import { formatPercentileLabel, formatSignedValue } from '@/lib/format';
import { scenarioPayCost } from '@/lib/capital';
import { useCapitalContext } from '@/lib/capitalContext';
import { useScenarioStore } from '@/store/scenarioStore';
import { cn } from '@/lib/cn';

const MOVE_OPTIONS = [
  { value: 'none', label: 'No move' },
  { value: '0.50', label: '→ 50th' },
  { value: '0.60', label: '→ 60th' },
  { value: '0.65', label: '→ 65th' },
  { value: '0.75', label: '→ 75th' },
  { value: '0.90', label: '→ 90th' },
];

export function ScenarioEditor({ className }: { className?: string }) {
  const scenarios = useScenarioStore((s) => s.scenarios);
  const createScenario = useScenarioStore((s) => s.createScenario);
  const setActive = useScenarioStore((s) => s.setActiveScenario);
  const setMove = useScenarioStore((s) => s.setMove);
  const renameScenario = useScenarioStore((s) => s.renameScenario);
  const deleteScenario = useScenarioStore((s) => s.deleteScenario);
  const duplicateScenario = useScenarioStore((s) => s.duplicateScenario);

  const { baseline, scenarioBases, scenario, component } = useCapitalContext();
  const unit = component === 'BONUS_PCT' ? 'RATIO' : 'GND_K';

  if (!scenario) {
    return (
      <Card
        title="Scenarios"
        subtitle="Model proposed pay moves layered on the baseline. Lenses show Baseline → Scenario deltas."
        className={className}
      >
        <div className="flex flex-wrap items-center gap-2">
          {scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-ink-soft hover:border-navy-500/40 hover:text-navy-700"
            >
              {s.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => createScenario()}
            className="rounded-full bg-navy-700 px-3 py-1 text-xs font-semibold text-white hover:bg-navy-900"
          >
            + New scenario
          </button>
        </div>
      </Card>
    );
  }

  const payCost = scenarioBases ? scenarioPayCost(baseline, scenarioBases) : 0;

  return (
    <Card
      title="Scenario"
      subtitle="Set a target market percentile per level; the lenses recompute against it."
      right={
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => duplicateScenario(scenario.id)} title="Duplicate" className="rounded-md border border-border p-1 text-ink-soft hover:text-navy-700">
            <Copy size={13} />
          </button>
          <button type="button" onClick={() => setActive(null)} title="Back to baseline" className="rounded-md border border-border p-1 text-ink-soft hover:text-navy-700">
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            onClick={() => deleteScenario(scenario.id)}
            title="Delete scenario"
            className="rounded-md border border-border p-1 text-brand-red/80 hover:text-brand-red"
          >
            <Trash2 size={13} />
          </button>
        </div>
      }
      className={className}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          value={scenario.name}
          onChange={(e) => renameScenario(scenario.id, e.target.value)}
          className="h-8 rounded-md border border-border bg-card px-2 text-sm font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30"
          aria-label="Scenario name"
        />
        <div className="text-xs text-muted">
          Pay cost vs baseline:{' '}
          <span className={cn('font-semibold tabular-nums', payCost > 0 ? 'text-navy-700' : payCost < 0 ? 'text-brand-green' : 'text-ink')}>
            {formatSignedValue(payCost, unit, { decimals: 0, group: true })} {unit === 'RATIO' ? '' : 'GND k'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {LEVELS.map((level) => {
          const move = scenario.moves[level];
          const value = typeof move?.targetPercentile === 'number' ? move.targetPercentile.toFixed(2) : 'none';
          const base = baseline.find((b) => b.level === level);
          const scn = scenarioBases?.find((b) => b.level === level);
          return (
            <div key={level} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg/50 px-3 py-2">
              <div className="min-w-0">
                <div className="text-xs font-medium text-ink-soft">{LEVEL_LABELS[level]}</div>
                <div className="text-[0.68rem] tabular-nums text-muted">
                  now {base?.position != null ? formatPercentileLabel(base.position) : '—'}
                  {scn && scn.position != null && value !== 'none' ? ` → ${formatPercentileLabel(scn.position)}` : ''}
                </div>
              </div>
              <Select
                ariaLabel={`${LEVEL_LABELS[level]} move`}
                options={MOVE_OPTIONS}
                value={value}
                onChange={(v) => setMove(scenario.id, level, v === 'none' ? null : { targetPercentile: Number.parseFloat(v) })}
                className="w-28"
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
