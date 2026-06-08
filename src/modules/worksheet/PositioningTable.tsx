/**
 * Block 2 — Positioning & Compa-Ratios.
 *
 * Per sublevel, against that level's resolved Target Market Percentile (TMP):
 *   · Position of the firm median within the market curve
 *   · Firm median vs TMP   (absolute k AND %)
 *   · Firm midpoint vs TMP  (absolute k AND %)
 *   · Compa-ratio (firm median / TMP) — RAG-tinted via |Δ%| of the firm median
 *
 * All numbers come from @/lib/benchmark; this only formats and tints.
 */

import { Table, TableScroll, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { RagBadge } from '@/components/ui/RagBadge';
import { isAggregate, levelOf, type SubLevel, subLevelLabel } from '@/domain/levels';
import type { ComponentTable } from '@/domain/types';
import {
  compaRatio,
  deviationAbs,
  deviationPct,
  marketValueAtPercentile,
  type PercentilePosition,
  percentilePositionOf,
  type RagStatus,
  ragStatus,
} from '@/lib/benchmark';
import {
  formatCompaRatio,
  formatPercentileLabel,
  formatSignedPct,
  formatSignedValue,
  formatValue,
  NA,
} from '@/lib/format';
import { cn } from '@/lib/cn';
import { tmpForSubLevel, type TmpState } from './tmp';

function ragTint(rag: RagStatus | null): string {
  switch (rag) {
    case 'green':
      return 'bg-brand-green/10 text-brand-green';
    case 'amber':
      return 'bg-brand-amber/15 text-[#9A7212]';
    case 'red':
      return 'bg-brand-red/10 text-brand-red';
    default:
      return 'text-ink';
  }
}

/** Render the firm-median position label: clamps render verbatim, numeric -> ordinal. */
function positionLabel(pos: PercentilePosition | null): string {
  if (pos === null) return NA;
  if (pos === '>95%' || pos === '<5%') return pos;
  return formatPercentileLabel(pos);
}

interface PositioningTableProps {
  table: ComponentTable;
  subLevels: SubLevel[];
  tmpState: TmpState;
}

export function PositioningTable({ table, subLevels, tmpState }: PositioningTableProps) {
  const unit = table.unit;
  const unitHead = unit === 'RATIO' ? '(%)' : '(GND k)';

  return (
    <TableScroll className="rounded-lg border border-border">
      <Table>
        <THead sticky>
          <TR>
            <TH rowSpan={2} className="bg-[#F0F2F6] align-bottom">
              Sublevel
            </TH>
            <TH rowSpan={2} align="right" className="border-l border-border align-bottom">
              Target
            </TH>
            <TH rowSpan={2} align="right" className="border-l border-border align-bottom">
              Firm median position
            </TH>
            <TH colSpan={2} align="center" className="border-l border-border">
              Median vs target
            </TH>
            <TH colSpan={2} align="center" className="border-l border-border">
              Midpoint vs target
            </TH>
            <TH rowSpan={2} align="right" className="border-l border-border align-bottom">
              Compa-ratio
            </TH>
            <TH rowSpan={2} align="center" className="border-l border-border align-bottom">
              Status
            </TH>
          </TR>
          <TR>
            <TH align="right" className="border-l border-border">
              Δ {unitHead}
            </TH>
            <TH align="right">Δ %</TH>
            <TH align="right" className="border-l border-border">
              Δ {unitHead}
            </TH>
            <TH align="right">Δ %</TH>
          </TR>
        </THead>
        <TBody>
          {subLevels.map((sl) => {
            const row = table.rows[sl];
            if (!row) return null;
            const agg = isAggregate(sl);
            const level = levelOf(sl);
            const p = tmpForSubLevel(tmpState, sl);
            const tmpVal = marketValueAtPercentile(row.percentiles, p);

            const position = percentilePositionOf(row.firm.median, row.percentiles);

            const medAbs = deviationAbs(row.firm.median, tmpVal);
            const medPct = deviationPct(row.firm.median, tmpVal);
            const midAbs = deviationAbs(row.firm.midpoint, tmpVal);
            const midPct = deviationPct(row.firm.midpoint, tmpVal);

            const compa = compaRatio(row.firm.median, tmpVal);
            const rag = ragStatus(medPct);

            return (
              <TR key={sl} className={agg ? 'bg-[#F4F6F9]' : undefined}>
                <TD className={cn('whitespace-nowrap', agg ? 'font-semibold text-ink' : 'pl-5 text-ink-soft')}>
                  {subLevelLabel(sl)}
                </TD>
                <TD align="right" className="border-l border-border/60 tabular-nums text-muted">
                  {formatValue(tmpVal, unit)}
                  <span className="ml-1 text-[0.68rem] text-muted/70">
                    {level ? `@ ${formatPercentileLabel(p)}` : ''}
                  </span>
                </TD>
                <TD align="right" className="border-l border-border/60 tabular-nums font-medium text-navy-700">
                  {positionLabel(position)}
                </TD>
                <TD align="right" className="border-l border-border/60 tabular-nums">
                  {formatSignedValue(medAbs, unit)}
                </TD>
                <TD align="right" className="tabular-nums">
                  {formatSignedPct(medPct)}
                </TD>
                <TD align="right" className="border-l border-border/60 tabular-nums">
                  {formatSignedValue(midAbs, unit)}
                </TD>
                <TD align="right" className="tabular-nums">
                  {formatSignedPct(midPct)}
                </TD>
                <TD align="right" className={cn('border-l border-border/60 tabular-nums font-semibold', ragTint(rag))}>
                  {formatCompaRatio(compa)}
                </TD>
                <TD align="center" className="border-l border-border/60">
                  <RagBadge status={rag} />
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableScroll>
  );
}
