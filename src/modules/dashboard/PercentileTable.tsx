import { useState } from 'react';
import { Table, TableScroll, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { Segmented } from '@/components/ui/Segmented';
import { isAggregate, type SubLevel, subLevelLabel } from '@/domain/levels';
import { percentileKey, type ComponentTable } from '@/domain/types';
import { deviationPct, marketValueAtPercentile, type RagStatus, ragStatus } from '@/lib/benchmark';
import { formatPercentileLabel, formatValue } from '@/lib/format';
import { cn } from '@/lib/cn';

const CONDENSED = [0.05, 0.25, 0.5, 0.75, 0.95];

function ragTint(rag: RagStatus | null): string {
  switch (rag) {
    case 'green':
      return 'bg-brand-green/10 text-brand-green font-semibold';
    case 'amber':
      return 'bg-brand-amber/15 text-[#9A7212] font-semibold';
    case 'red':
      return 'bg-brand-red/10 text-brand-red font-semibold';
    default:
      return 'font-semibold text-ink';
  }
}

interface PercentileTableProps {
  table: ComponentTable;
  subLevels: SubLevel[];
  targetPercentile: number;
}

export function PercentileTable({ table, subLevels, targetPercentile }: PercentileTableProps) {
  const [mode, setMode] = useState<'condensed' | 'all'>('condensed');
  const unit = table.unit;

  const displayed =
    mode === 'all'
      ? Array.from({ length: 19 }, (_, i) => Math.round((0.05 + i * 0.05) * 100) / 100)
      : Array.from(new Set([...CONDENSED, Math.round(targetPercentile * 100) / 100])).sort((a, b) => a - b);

  const isTmp = (p: number) => Math.abs(p - targetPercentile) < 1e-6;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Selected sublevels · Your Firm vs market percentiles. Median cell tinted by RAG vs the{' '}
          <span className="font-semibold text-ink-soft">{formatPercentileLabel(targetPercentile)}</span> target.
        </p>
        <Segmented
          ariaLabel="Percentile detail"
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'condensed', label: '5 / 25 / 50 / 75 / 95' },
            { value: 'all', label: 'All 19' },
          ]}
        />
      </div>

      <TableScroll className="rounded-lg border border-border">
        <Table caption="Your Firm maximum, median and minimum against the market percentile curve, by sublevel">
          <THead sticky>
            <TR>
              <TH rowSpan={2} className="bg-[#F0F2F6] align-bottom">
                Sublevel
              </TH>
              <TH colSpan={3} align="center" className="border-l border-border">
                Your Firm {unit === 'RATIO' ? '(%)' : '(GND k)'}
              </TH>
              <TH colSpan={displayed.length} align="center" className="border-l border-border">
                Market percentiles {unit === 'RATIO' ? '(%)' : '(GND k)'}
              </TH>
            </TR>
            <TR>
              <TH align="right" className="border-l border-border">
                Max
              </TH>
              <TH align="right">Median</TH>
              <TH align="right">Min</TH>
              {displayed.map((p) => (
                <TH
                  key={p}
                  align="right"
                  className={cn('border-l border-border/60', isTmp(p) && 'bg-navy-500/15 text-navy-700')}
                >
                  {formatPercentileLabel(p)}
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {subLevels.map((sl) => {
              const row = table.rows[sl];
              if (!row) return null;
              const tmpVal = marketValueAtPercentile(row.percentiles, targetPercentile);
              const rag = ragStatus(deviationPct(row.firm.median, tmpVal));
              const agg = isAggregate(sl);
              return (
                <TR key={sl} className={agg ? 'bg-[#F4F6F9]' : undefined}>
                  <TD className={cn('whitespace-nowrap', agg ? 'font-semibold text-ink' : 'pl-5 text-ink-soft')}>
                    {subLevelLabel(sl)}
                  </TD>
                  <TD align="right" className="border-l border-border/60 tabular-nums">
                    {formatValue(row.firm.max, unit)}
                  </TD>
                  <TD align="right" className={cn('tabular-nums', ragTint(rag))}>
                    {formatValue(row.firm.median, unit)}
                  </TD>
                  <TD align="right" className="tabular-nums">
                    {formatValue(row.firm.min, unit)}
                  </TD>
                  {displayed.map((p) => (
                    <TD
                      key={p}
                      align="right"
                      className={cn('border-l border-border/60 tabular-nums', isTmp(p) && 'bg-navy-500/10 font-semibold text-navy-700')}
                    >
                      {formatValue(row.percentiles[percentileKey(p)], unit)}
                    </TD>
                  ))}
                </TR>
              );
            })}
          </TBody>
        </Table>
      </TableScroll>
    </div>
  );
}
