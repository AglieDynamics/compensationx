/**
 * Worksheet-local Target Market Percentile editor.
 *
 * Default OVERALL = one percentile for every level (seeded from the global
 * store). Switch to PER-LEVEL to expose a compact slider per career level.
 * State lives in the parent (lifted), so all five blocks recompute live.
 */

import { Segmented } from '@/components/ui/Segmented';
import { PercentileSlider } from '@/components/ui/PercentileSlider';
import { LEVEL_LABELS, LEVELS, type Level } from '@/domain/levels';
import { formatPercentileLabel } from '@/lib/format';
import type { TmpMode, TmpState } from './tmp';

interface TmpEditorProps {
  state: TmpState;
  onChange: (next: TmpState) => void;
}

export function TmpEditor({ state, onChange }: TmpEditorProps) {
  const setMode = (mode: TmpMode) => onChange({ ...state, mode });
  const setOverall = (overall: number) => onChange({ ...state, overall });
  const setLevel = (level: Level, value: number) =>
    onChange({ ...state, perLevel: { ...state.perLevel, [level]: value } });

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">
        Target market percentile
      </span>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmented<TmpMode>
          ariaLabel="Target percentile scope"
          size="sm"
          value={state.mode}
          onChange={setMode}
          options={[
            { value: 'overall', label: 'Overall' },
            { value: 'perLevel', label: 'Per level' },
          ]}
        />
        {state.mode === 'overall' ? (
          <PercentileSlider label="" value={state.overall} onChange={setOverall} />
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {LEVELS.map((level) => (
              <label key={level} className="flex items-center gap-2">
                <span className="w-[5.5rem] text-[0.72rem] font-medium text-ink-soft">
                  {LEVEL_LABELS[level]}
                </span>
                <PercentileSlider
                  label=""
                  value={state.perLevel[level] ?? state.overall}
                  onChange={(v) => setLevel(level, v)}
                />
              </label>
            ))}
          </div>
        )}
      </div>
      {state.mode === 'overall' && (
        <span className="text-[0.7rem] text-muted">
          One target ({formatPercentileLabel(state.overall)}) applied to all levels.
        </span>
      )}
    </div>
  );
}
