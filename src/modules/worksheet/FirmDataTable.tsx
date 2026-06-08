/**
 * Block 1 — Your Firm's Data.
 * Max / Mean / Midpoint / Median / Min across the selected sublevels, plus
 * incumbents on the aggregate rows. Pure render — values come straight off the
 * table; no math here.
 */

import { Table, TableScroll, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { isAggregate, type SubLevel, subLevelLabel } from '@/domain/levels';
import type { ComponentTable } from '@/domain/types';
import { formatCount, formatValue } from '@/lib/format';
import { cn } from '@/lib/cn';

interface FirmDataTableProps {
  table: ComponentTable;
  subLevels: SubLevel[];
}

export function FirmDataTable({ table, subLevels }: FirmDataTableProps) {
  const unit = table.unit;
  const unitHead = unit === 'RATIO' ? '(%)' : '(GND k)';

  return (
    <TableScroll className="rounded-lg border border-border">
      <Table>
        <THead sticky>
          <TR>
            <TH className="bg-[#F0F2F6]">Sublevel</TH>
            <TH align="right" className="border-l border-border">
              Incumbents
            </TH>
            <TH align="right" className="border-l border-border">
              Max {unitHead}
            </TH>
            <TH align="right">Mean {unitHead}</TH>
            <TH align="right">Midpoint {unitHead}</TH>
            <TH align="right">Median {unitHead}</TH>
            <TH align="right">Min {unitHead}</TH>
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
                  {agg ? formatCount(row.firm.incumbents) : ''}
                </TD>
                <TD align="right" className="border-l border-border/60 tabular-nums">
                  {formatValue(row.firm.max, unit)}
                </TD>
                <TD align="right" className="tabular-nums">
                  {formatValue(row.firm.mean, unit)}
                </TD>
                <TD align="right" className="tabular-nums">
                  {formatValue(row.firm.midpoint, unit)}
                </TD>
                <TD align="right" className={cn('tabular-nums', agg ? 'font-semibold text-ink' : 'font-medium text-ink')}>
                  {formatValue(row.firm.median, unit)}
                </TD>
                <TD align="right" className="tabular-nums">
                  {formatValue(row.firm.min, unit)}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableScroll>
  );
}
