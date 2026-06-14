/**
 * Module A — saved-cases table + session analytics (§3 Module A, step 6).
 *
 * Analytics aggregate already-priced case snapshots (no formula recompute here):
 *   - offer-to-market ratio  = target / marketReference
 *   - offer-to-peer ratio     = target / peer median (carried on the snapshot)
 *   - exceptions              = needs-approval count
 *   - compression created     = Σ flagCount
 *   - acceptance rate         = accepted / (accepted + declined)
 * Labelled "session analytics — no ATS integration".
 */

import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table, TableScroll, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import type { PricingCase } from '@/domain/structure';
import { LEVEL_LABELS } from '@/domain/levels';
import { formatCompaRatio, formatGndK, formatPct, NA } from '@/lib/format';
import { useEquityPlanStore } from '@/store/equityPlanStore';

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

export interface SessionMetrics {
  count: number;
  avgOfferToMarket: number | null;
  avgOfferToPeer: number | null;
  exceptions: number;
  compressionFlags: number;
  acceptanceRate: number | null;
  recorded: number;
}

/** Aggregate session metrics over saved case snapshots. Pure, guarded — no NaN. */
export function sessionMetrics(cases: PricingCase[]): SessionMetrics {
  const offerToMarket: number[] = [];
  const offerToPeer: number[] = [];
  let exceptions = 0;
  let compressionFlags = 0;
  let accepted = 0;
  let recorded = 0;

  for (const c of cases) {
    const { target, marketReference, peerMedian, approval, flagCount } = caseFields(c);
    if (isNum(target) && isNum(marketReference) && marketReference !== 0) {
      offerToMarket.push(target / marketReference);
    }
    if (isNum(target) && isNum(peerMedian) && peerMedian !== 0) {
      offerToPeer.push(target / peerMedian);
    }
    if (approval === 'needs-approval') exceptions += 1;
    compressionFlags += flagCount;
    if (c.outcome === 'accepted' || c.outcome === 'declined') {
      recorded += 1;
      if (c.outcome === 'accepted') accepted += 1;
    }
  }

  const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  return {
    count: cases.length,
    avgOfferToMarket: mean(offerToMarket),
    avgOfferToPeer: mean(offerToPeer),
    exceptions,
    compressionFlags,
    acceptanceRate: recorded > 0 ? accepted / recorded : null,
    recorded,
  };
}

/** PricingCaseSnapshot only carries peerMedian if a prior session wrote it; tolerate its absence. */
function caseFields(c: PricingCase): {
  target: number | null;
  marketReference: number | null;
  peerMedian: number | null;
  approval: PricingCase['snapshot']['approval'];
  flagCount: number;
} {
  const snap = c.snapshot as PricingCase['snapshot'] & { peerMedian?: number | null };
  return {
    target: snap.target,
    marketReference: snap.marketReference,
    peerMedian: typeof snap.peerMedian === 'number' ? snap.peerMedian : null,
    approval: snap.approval,
    flagCount: snap.flagCount,
  };
}

const OUTCOME_OPTIONS: { value: PricingCase['outcome']; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
];

interface SessionProps {
  cases: PricingCase[];
  onDelete: (id: string) => void;
  onRecordOutcome: (id: string, outcome: PricingCase['outcome']) => void;
}

export function JobPricingSession({ cases, onDelete, onRecordOutcome }: SessionProps) {
  const m = sessionMetrics(cases);
  const plans = useEquityPlanStore((s) => s.plans);
  const planNameById = useMemo(() => new Map(plans.map((p) => [p.id, p.name])), [plans]);

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
      <Card
        title="Saved pricing cases"
        subtitle="Snapshots of priced offers; set the outcome to feed acceptance analytics."
        right={<Badge variant="neutral">{cases.length} saved</Badge>}
        flush
      >
        {cases.length === 0 ? (
          <div className="p-5">
            <EmptyState
              compact
              title="No saved cases yet"
              message="Price a role above and use Save case to capture it here."
            />
          </div>
        ) : (
          <TableScroll>
            <Table caption="Saved pricing cases">
              <THead sticky>
                <TR>
                  <TH>Case</TH>
                  <TH>Level</TH>
                  <TH align="right" className="border-l border-border">Floor</TH>
                  <TH align="right">Target</TH>
                  <TH align="right">Stretch</TH>
                  <TH align="center" className="border-l border-border">Approval</TH>
                  <TH align="center">Flags</TH>
                  <TH align="center" className="border-l border-border">Outcome</TH>
                  <TH align="center"> </TH>
                </TR>
              </THead>
              <TBody>
                {cases.map((c) => (
                  <TR key={c.id}>
                    <TD className="max-w-[14rem] font-medium text-ink">
                      <div className="truncate" title={c.label}>{c.label}</div>
                      {c.equityPlanId && planNameById.has(c.equityPlanId) && (
                        <div className="mt-0.5 truncate text-[0.68rem] font-normal text-muted" title={planNameById.get(c.equityPlanId)}>
                          Plan: {planNameById.get(c.equityPlanId)}
                        </div>
                      )}
                    </TD>
                    <TD className="text-ink-soft">{LEVEL_LABELS[c.intake.level]}</TD>
                    <TD align="right" className="border-l border-border/60 tabular-nums text-ink-soft">{formatGndK(c.snapshot.floor, 1)}</TD>
                    <TD align="right" className="tabular-nums font-semibold text-navy-700">{formatGndK(c.snapshot.target, 1)}</TD>
                    <TD align="right" className="tabular-nums text-ink-soft">{formatGndK(c.snapshot.stretch, 1)}</TD>
                    <TD align="center" className="border-l border-border/60">
                      <Badge variant={c.snapshot.approval === 'auto' ? 'green' : 'amber'}>
                        {c.snapshot.approval === 'auto' ? 'Auto' : 'Approval'}
                      </Badge>
                    </TD>
                    <TD align="center" className="tabular-nums text-ink-soft">{c.snapshot.flagCount}</TD>
                    <TD align="center" className="border-l border-border/60">
                      <Select<PricingCase['outcome']>
                        ariaLabel={`Outcome for ${c.label}`}
                        value={c.outcome}
                        onChange={(v) => onRecordOutcome(c.id, v)}
                        options={OUTCOME_OPTIONS}
                        className="h-7"
                      />
                    </TD>
                    <TD align="center">
                      <button
                        type="button"
                        onClick={() => onDelete(c.id)}
                        aria-label={`Delete ${c.label}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-brand-red/10 hover:text-brand-red"
                      >
                        <Trash2 size={14} />
                      </button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableScroll>
        )}
      </Card>

      <Card
        title="Session analytics"
        subtitle="Rule/statistics-based; ML upgrade is platform-track."
        right={<Badge variant="outline">no ATS integration</Badge>}
      >
        {cases.length === 0 ? (
          <EmptyState compact title="No cases to analyze" message="Save at least one priced case to populate session analytics." />
        ) : (
          <div className="space-y-2.5">
            <MetricRow
              label="Avg offer-to-market"
              value={isNum(m.avgOfferToMarket) ? formatCompaRatio(m.avgOfferToMarket) : NA}
              note="target ÷ market reference"
            />
            <MetricRow
              label="Avg offer-to-peer"
              value={isNum(m.avgOfferToPeer) ? formatCompaRatio(m.avgOfferToPeer) : NA}
              note="target ÷ peer median"
            />
            <MetricRow
              label="Exceptions"
              value={String(m.exceptions)}
              note="cases needing approval"
              accent={m.exceptions > 0 ? 'amber' : 'green'}
            />
            <MetricRow
              label="Compression created"
              value={String(m.compressionFlags)}
              note="equity flags raised across cases"
              accent={m.compressionFlags > 0 ? 'amber' : 'green'}
            />
            <MetricRow
              label="Acceptance rate"
              value={isNum(m.acceptanceRate) ? formatPct(m.acceptanceRate, 0) : NA}
              note={`${m.recorded} of ${m.count} cases recorded`}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

function MetricRow({
  label,
  value,
  note,
  accent = 'navy',
}: {
  label: string;
  value: string;
  note: string;
  accent?: 'navy' | 'green' | 'amber';
}) {
  const color = accent === 'green' ? 'text-brand-green' : accent === 'amber' ? 'text-[#9A7212]' : 'text-navy-700';
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-[0.82rem] font-medium text-ink">{label}</div>
        <div className="text-[0.7rem] text-muted">{note}</div>
      </div>
      <div className={`shrink-0 text-lg font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
