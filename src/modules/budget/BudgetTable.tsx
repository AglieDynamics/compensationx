import { Table, TableScroll, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { RagBadge } from '@/components/ui/RagBadge';
import type { Unit } from '@/domain/components';
import { LEVEL_LABELS, LEVELS } from '@/domain/levels';
import { ragStatus, type BudgetResult } from '@/lib/benchmark';
import {
  formatCount,
  formatSignedPct,
  formatSignedValue,
  formatValue,
} from '@/lib/format';
import { cn } from '@/lib/cn';

interface BudgetTableProps {
  sim: BudgetResult;
  unit: Unit;
}

/** Tint a signed budget delta: saving (negative) green, increase/cost (positive) navy, n/a muted. */
function deltaClass(value: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) return 'text-ink';
  return value < 0 ? 'text-brand-green' : 'text-navy-700';
}

export function BudgetTable({ sim, unit }: BudgetTableProps) {
  const unitHead = unit === 'RATIO' ? '(%)' : '(GND k)';

  return (
    <TableScroll>
      <Table>
        <THead sticky>
          <TR>
            <TH className="bg-[#F0F2F6]">Career level</TH>
            <TH align="right" className="border-l border-border">
              Firm median {unitHead}
            </TH>
            <TH align="right">Target {unitHead}</TH>
            <TH align="right" className="border-l border-border">
              Gap {unitHead}
            </TH>
            <TH align="right">Gap %</TH>
            <TH align="right" className="border-l border-border">
              Incumbents
            </TH>
            <TH align="right" className="border-l border-border">
              Level budget {unitHead}
            </TH>
            <TH align="center" className="border-l border-border">
              Status
            </TH>
          </TR>
        </THead>
        <TBody>
          {LEVELS.map((level) => {
            const d = sim.perLevelDetail[level];
            const rag = ragStatus(d.gapPct);
            return (
              <TR key={level}>
                <TD className="whitespace-nowrap font-medium text-ink">{LEVEL_LABELS[level]}</TD>
                <TD align="right" className="border-l border-border/60 tabular-nums">
                  {formatValue(d.firmMedian, unit)}
                </TD>
                <TD align="right" className="tabular-nums">
                  {formatValue(d.tmp, unit)}
                </TD>
                {/* Gap is the firm-vs-target position; direction is conveyed by the Status badge,
                    so keep these cells neutral to avoid clashing with the budget-delta colours. */}
                <TD align="right" className="border-l border-border/60 tabular-nums text-ink-soft">
                  {formatSignedValue(d.gapAbs, unit)}
                </TD>
                <TD align="right" className="tabular-nums text-ink-soft">
                  {formatSignedPct(d.gapPct)}
                </TD>
                <TD align="right" className="border-l border-border/60 tabular-nums text-ink-soft">
                  {formatCount(d.incumbents)}
                </TD>
                <TD align="right" className={cn('border-l border-border/60 font-semibold tabular-nums', deltaClass(d.delta))}>
                  {formatSignedValue(d.delta, unit)}
                </TD>
                <TD align="center" className="border-l border-border/60">
                  <RagBadge status={rag} />
                </TD>
              </TR>
            );
          })}
        </TBody>
        <tfoot className="border-t-2 border-border bg-[#F4F6F9] font-semibold text-ink">
          <TR className="border-b-0">
            <TD className="whitespace-nowrap font-semibold text-ink">Total</TD>
            <TD align="right" className="border-l border-border/60 text-muted">
              —
            </TD>
            <TD align="right" className="text-muted">
              —
            </TD>
            <TD align="right" className="border-l border-border/60 text-muted">
              —
            </TD>
            <TD align="right" className="text-muted">
              —
            </TD>
            <TD align="right" className="border-l border-border/60 tabular-nums text-ink">
              {formatCount(sim.totalIncumbents)}
            </TD>
            <TD align="right" className={cn('border-l border-border/60 tabular-nums', deltaClass(sim.total))}>
              {formatSignedValue(sim.total, unit)}
            </TD>
            <TD align="center" className="border-l border-border/60 text-muted">
              —
            </TD>
          </TR>
          <TR className="border-b-0">
            <TD className="whitespace-nowrap text-[0.78rem] font-medium text-muted">Per incumbent</TD>
            <TD align="right" className="border-l border-border/60 text-muted">
              —
            </TD>
            <TD align="right" className="text-muted">
              —
            </TD>
            <TD align="right" className="border-l border-border/60 text-muted">
              —
            </TD>
            <TD align="right" className="text-muted">
              —
            </TD>
            <TD align="right" className="border-l border-border/60 text-muted">
              —
            </TD>
            <TD align="right" className={cn('border-l border-border/60 tabular-nums', deltaClass(sim.perHead))}>
              {formatSignedValue(sim.perHead, unit)}
            </TD>
            <TD align="center" className="border-l border-border/60 text-muted">
              —
            </TD>
          </TR>
        </tfoot>
      </Table>
    </TableScroll>
  );
}
