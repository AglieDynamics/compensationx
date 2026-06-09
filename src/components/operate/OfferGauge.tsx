import type { PricingResult } from '@/lib/comp';
import { formatGndK } from '@/lib/format';
import { CHART } from '@/components/charts/chartTheme';
import { EmptyState } from '@/components/ui/EmptyState';

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** Floor / Target / Stretch over the grade range, with market + peer markers (§3 A5). */
export function OfferGauge({ result }: { result: PricingResult }) {
  const { rangeMin, rangeMax, floor, target, stretch, marketReference, peers } = result;
  const vals = [rangeMin, rangeMax, floor, target, stretch, marketReference, peers.median].filter(isNum);
  if (!isNum(rangeMin) || !isNum(rangeMax) || vals.length === 0) {
    return <EmptyState compact message="No offer to plot for this role." />;
  }
  const lo = Math.min(...vals) * 0.97;
  const hi = Math.max(...vals) * 1.03;
  const span = hi - lo || 1;
  const pct = (v: number) => ((v - lo) / span) * 100;

  return (
    <div>
      <div className="relative h-16">
        {/* range band */}
        <div
          className="absolute top-8 h-3 -translate-y-1/2 rounded-full"
          style={{ left: `${pct(rangeMin)}%`, width: `${pct(rangeMax) - pct(rangeMin)}%`, background: CHART.bandLight, border: `1px solid ${CHART.bandDark}` }}
        />
        {/* market reference line */}
        {isNum(marketReference) && (
          <Marker pos={pct(marketReference)} color={CHART.bandDark} label="Market" value={marketReference} top />
        )}
        {isNum(peers.median) && <Marker pos={pct(peers.median)} color={CHART.blue400} label="Peer med" value={peers.median} top />}
        {/* offer markers */}
        {isNum(floor) && <Marker pos={pct(floor)} color="#2E8B57" label="Floor" value={floor} />}
        {isNum(target) && <Marker pos={pct(target)} color={CHART.firm} label="Target" value={target} strong />}
        {isNum(stretch) && <Marker pos={pct(stretch)} color="#9A7212" label="Stretch" value={stretch} />}
      </div>
    </div>
  );
}

function Marker({
  pos,
  color,
  label,
  value,
  top,
  strong,
}: {
  pos: number;
  color: string;
  label: string;
  value: number;
  top?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="absolute -translate-x-1/2" style={{ left: `${Math.max(0, Math.min(100, pos))}%`, top: top ? 0 : 34 }}>
      <div className="flex flex-col items-center">
        {top && <span className="mb-0.5 whitespace-nowrap text-[0.62rem] font-medium" style={{ color }}>{label} {formatGndK(value, 0)}</span>}
        <span className="h-4 w-[2px] rounded-full" style={{ background: color, height: strong ? 22 : 16 }} />
        {!top && (
          <span className="mt-0.5 flex flex-col items-center">
            <span className={`whitespace-nowrap text-[0.66rem] ${strong ? 'font-bold' : 'font-semibold'}`} style={{ color }}>{label}</span>
            <span className="whitespace-nowrap text-[0.62rem] tabular-nums" style={{ color }}>{formatGndK(value, 0)}</span>
          </span>
        )}
      </div>
    </div>
  );
}
