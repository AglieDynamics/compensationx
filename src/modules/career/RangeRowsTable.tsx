import { Table, TableScroll, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { NA } from '@/lib/format';
import { CHART } from '@/components/charts/chartTheme';
import { RangeBar, rangeScale } from './RangeBar';

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

export interface RangeRow {
  label: string;
  marketMin: number | null;
  marketMax: number | null;
  yourFirm: number | null;
}

interface RangeRowsTableProps {
  rows: RangeRow[];
  /** Header for the row-label column (e.g. "Level"). */
  rowHeader: string;
  /** Unit suffix shown in numeric headers (e.g. "GND k", "%"). */
  unitLabel: string;
  /** Formats a single value (already unit-aware). */
  format: (v: number | null) => string;
}

/**
 * Dense range table: market min..max with the Your Firm marker, plus a shared-scale
 * mini range visual per row. Used for utilisation, sales, project-revenue and
 * expected-salary-change sections so styling stays identical across them.
 */
export function RangeRowsTable({ rows, rowHeader, unitLabel, format }: RangeRowsTableProps) {
  const scale = rangeScale(rows);

  return (
    <TableScroll className="rounded-lg border border-border">
      <Table>
        <THead>
          <TR>
            <TH className="bg-[#F0F2F6]">{rowHeader}</TH>
            <TH align="right" className="border-l border-border">
              Market min ({unitLabel})
            </TH>
            <TH align="right">Market max ({unitLabel})</TH>
            <TH align="right">Your Firm ({unitLabel})</TH>
            <TH className="w-[34%] border-l border-border">Range</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.label}>
              <TD className="whitespace-nowrap font-medium text-ink">{r.label}</TD>
              <TD align="right" className="border-l border-border/60 tabular-nums text-ink-soft">
                {format(r.marketMin)}
              </TD>
              <TD align="right" className="tabular-nums text-ink-soft">
                {format(r.marketMax)}
              </TD>
              <TD align="right" className="tabular-nums font-semibold">
                {isNum(r.yourFirm) ? (
                  <span style={{ color: CHART.firm }}>{format(r.yourFirm)}</span>
                ) : (
                  <span className="font-normal text-muted">{NA}</span>
                )}
              </TD>
              <TD className="border-l border-border/60">
                <RangeBar
                  marketMin={r.marketMin}
                  marketMax={r.marketMax}
                  yourFirm={r.yourFirm}
                  scaleMin={scale.min}
                  scaleMax={scale.max}
                  format={format}
                />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </TableScroll>
  );
}

/** Shared legend for the range-bar visual. */
export function RangeBarLegend() {
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 px-0.5 text-[0.72rem] text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-4 rounded-sm border"
          style={{ background: CHART.bandLight, borderColor: CHART.bandDark }}
        />
        Market min–max
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-[3px] rounded-full" style={{ background: CHART.firm }} />
        Your Firm (within range)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-[3px] rounded-full" style={{ background: CHART.red }} />
        Your Firm (outside range)
      </span>
    </div>
  );
}
