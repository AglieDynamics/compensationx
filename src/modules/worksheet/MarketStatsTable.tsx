/**
 * Block 3 — Market Statistics.
 * #firms, #incumbents (aggregates only), Max (95th) / Mean / Midpoint /
 * Median (50th) / Min (5th). Pure render off `market` stats.
 */

import { Table, TableScroll, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { isAggregate, type SubLevel, subLevelLabel } from '@/domain/levels';
import type { ComponentTable } from '@/domain/types';
import { formatCount, formatValue } from '@/lib/format';
import { cn } from '@/lib/cn';

interface MarketStatsTableProps {
  table: ComponentTable;
  subLevels: SubLevel[];
}

export function MarketStatsTable({ table, subLevels }: MarketStatsTableProps) {
  const unit = table.unit;
  const unitHead = unit === 'RATIO' ? '(%)' : '(GND k)';

  return (
    <TableScroll className="rounded-lg border border-border">
      <Table>
        <THead sticky>
          <TR>
            <TH className="bg-[#F0F2F6]">Sublevel</TH>
            <TH align="right" className="border-l border-border">
              Firms
            </TH>
            <TH align="right">Incumbents</TH>
            <TH align="right" className="border-l border-border">
              Max · 95th {unitHead}
            </TH>
            <TH align="right">Mean {unitHead}</TH>
            <TH align="right">Midpoint {unitHead}</TH>
            <TH align="right">Median · 50th {unitHead}</TH>
            <TH align="right">Min · 5th {unitHead}</TH>
          </TR>
        </THead>
        <TBody>
          {subLevels.map((sl) => {
            const row = table.rows[sl];
            if (!row) return null;
            const agg = isAggregate(sl);
            return (
              <TR key={sl} className={agg ? 'bg-[#F4F6F9]' : undefined}>
                <TD className={cn('whitespace-nowrap', agg ? 'font-semibold text-ink' : 'pl-5 text-ink-soft')}>
                  {subLevelLabel(sl)}
                </TD>
                <TD align="right" className="border-l border-border/60 tabular-nums text-ink-soft">
                  {formatCount(row.market.firms)}
                </TD>
                <TD align="right" className="tabular-nums text-ink-soft">
                  {agg ? formatCount(row.market.incumbents) : ''}
                </TD>
                <TD align="right" className="border-l border-border/60 tabular-nums">
                  {formatValue(row.market.max, unit)}
                </TD>
                <TD align="right" className="tabular-nums">
                  {formatValue(row.market.mean, unit)}
                </TD>
                <TD align="right" className="tabular-nums">
                  {formatValue(row.market.midpoint, unit)}
                </TD>
                <TD align="right" className={cn('tabular-nums', agg ? 'font-semibold text-ink' : 'font-medium text-ink')}>
                  {formatValue(row.market.median, unit)}
                </TD>
                <TD align="right" className="tabular-nums">
                  {formatValue(row.market.min, unit)}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableScroll>
  );
}
