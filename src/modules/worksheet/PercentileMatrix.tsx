/**
 * Block 4 — Market Percentile Matrix.
 * Full 19 percentiles (5th..95th) down the rows, selected sublevels across the
 * columns. The 25th / 50th / 75th rows carry the quartile labels. Sticky header
 * row + sticky first column, horizontal scroll for many sublevels.
 *
 * Pure render — every cell is a published market percentile value.
 */

import { Table, TableScroll, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { isAggregate, type SubLevel, subLevelLabel } from '@/domain/levels';
import { percentileKey, PERCENTILES, type ComponentTable } from '@/domain/types';
import { formatPercentileLabel, formatValue } from '@/lib/format';
import { cn } from '@/lib/cn';

const QUARTILE_LABELS: Record<string, string> = {
  '0.25': 'Lower quartile',
  '0.50': 'Median',
  '0.75': 'Upper quartile',
};

interface PercentileMatrixProps {
  table: ComponentTable;
  subLevels: SubLevel[];
}

export function PercentileMatrix({ table, subLevels }: PercentileMatrixProps) {
  const unit = table.unit;
  const present = subLevels.filter((sl) => table.rows[sl] != null);

  return (
    <TableScroll className="rounded-lg border border-border">
      <Table>
        <THead sticky>
          <TR>
            <TH sticky className="z-30 bg-[#F0F2F6]">
              Percentile
            </TH>
            {present.map((sl) => {
              const agg = isAggregate(sl);
              return (
                <TH
                  key={sl}
                  align="right"
                  className={cn('border-l border-border/60', agg && 'bg-[#E7EBF1] text-ink')}
                >
                  {subLevelLabel(sl)}
                </TH>
              );
            })}
          </TR>
        </THead>
        <TBody>
          {PERCENTILES.map((p) => {
            const key = percentileKey(p);
            const quartile = QUARTILE_LABELS[key];
            return (
              <TR key={key} className={quartile ? 'bg-[#F4F6F9]' : undefined}>
                <TD
                  sticky
                  className={cn('whitespace-nowrap tabular-nums', quartile ? 'font-semibold text-ink' : 'text-ink-soft')}
                >
                  <span className="inline-flex items-baseline gap-2">
                    <span>{formatPercentileLabel(p)}</span>
                    {quartile && <span className="text-[0.68rem] font-medium text-muted">{quartile}</span>}
                  </span>
                </TD>
                {present.map((sl) => {
                  const row = table.rows[sl];
                  return (
                    <TD
                      key={sl}
                      align="right"
                      className={cn(
                        'border-l border-border/60 tabular-nums',
                        quartile ? 'font-semibold text-ink' : 'text-ink',
                        isAggregate(sl) && 'bg-[#F4F6F9]/60',
                      )}
                    >
                      {formatValue(row?.percentiles[key], unit)}
                    </TD>
                  );
                })}
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableScroll>
  );
}
