# CompBench

An interactive **compensation-benchmarking workspace** that reproduces the Vencon Research
Consultant Salary Survey methodology. Position your firm against an anonymized market panel —
level by level, component by component, percentile by percentile — and plan pay budgets against a
chosen market target.

Fully client-side: no backend, no network at runtime. Ships with a real **Greenland** seed
dataset (Basic Salary, firm-weighted, 2025) so it works with zero setup, and ingests a
Vencon-format `.xlsx` workbook for the full picture.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173  → Summary Dashboard renders immediately
```

Other scripts:

```bash
npm run ingest       # (re)generate src/data/greenland.json from a source workbook, or the fixture
npm run test         # Vitest: §5 compute assertions + ingest round-trip + render smoke tests
npm run build        # type-check + production build to dist/
npm run preview      # serve the production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint (no warnings allowed)
```

**Prerequisites:** Node 18+ (developed on Node 22/25), npm 9+.

---

## Using your own data

The app boots from the committed `src/data/greenland.json`. To load the full survey:

1. **Build-time:** drop the workbook at `data-source/Salary-Survey_Data-Sheets.xlsx` (git-ignored)
   and run `npm run ingest`. It parses every recognized tab into the typed model and regenerates
   `src/data/greenland.json`. If the file is absent, it falls back to the embedded Appendix A
   fixture and logs a notice — the app always boots.
2. **Runtime:** open **Data Ingestion** in the app and upload the `.xlsx`. It is parsed in the
   browser with the identical mapping, validated, and set as the active dataset (persisted to
   `localStorage`). Use **Reset to Greenland sample** to return to the seed.

### Workbook mapping (Vencon format)

Component data tabs are named e.g. `Basic Salary Firm-weighted`, `t-Bonus % Firm-weighted`,
`a-TCC Incu-weighted`. Within each tab: columns map to sublevels (An1…Pr, Overall), and rows map to
Your-Firm stats (R5–R10), Market stats (R26–R32), and the 19-row market percentile matrix
(R40 = 95th … R58 = 5th), read by row offset. See `src/lib/parseWorkbook.ts`.

---

## Modules

| # | Module | Route | What it does |
|---|--------|-------|--------------|
| 1 | **Summary Dashboard** | `/` | Filter by weighting / year / component / levels / target percentile. KPI strip, percentile-differentiated table, market range chart (box-whisker + Your-Firm line + target line), incumbent distribution. |
| 2 | **Benchmark Worksheet** | `/worksheet` | The full Vencon worksheet: Your-Firm data, Positioning & Compa-Ratios (editable target percentile), Market statistics, the full 5–95% percentile matrix, and the interactive range chart. |
| 3 | **Executive Summary** | `/summary` | Target-vs-Actual box charts, year-over-year median change with % deltas, and growth-factor bars with methodology thresholds. |
| 4 | **Budget Simulator** | `/budget` | Cost to move each level from its current firm median to a target market percentile × incumbents; total + per-head with RAG flags. |
| 5 | **Additional Career Issues** | `/career` | Career progression, starting salaries, utilisation, sales / project targets, overtime — Your Firm vs market (illustrative sample). |
| 6 | **Data Ingestion** | `/data` | Upload a Vencon `.xlsx`, see the parse report, activate it. |
| 7 | **Pulse Survey** | `/pulse` | GCC vs Non-GCC conflict-impact responses as diverging bars per section. Activates when a workbook with a long-format `Raw Data` sheet is ingested (no fabricated data — tidy empty-state otherwise). |

---

## Methodology notes

- **Levels:** Analyst / Associate / Manager / Senior Manager / Principal, each with 3 sublevels + an
  aggregate; plus an Overall roll-up.
- **Components:** Basic Salary, Allowances, Base Salary, Bonus, Bonus % (ratio), TCC.
- **Weighting:** Firm (each firm contributes equally) vs Incumbent (each consultant contributes).
- **Derived metrics** (all in `src/lib/benchmark.ts`, unit-tested): market value at any percentile
  (piecewise-linear), percentile position of the firm median, compa-ratio, % deviation, RAG status
  (≤5% green / ≤10% amber / >10% red), budget simulation, growth factor, YoY median change,
  headcount-weighted overall compa-ratio.

### Anchored sanity checks (verified by `npm run test`)

- Basic Salary / Firm / Target, An1: market median **44.32**, 75th **46.59**, 95th **59.07**,
  5th **34.54**; compa-ratio **1.03**.
- Budget @ 50th: total ≈ **−1,704 GND k**, per-head ≈ **−3.09**.
- Growth factor ≈ **3.6×**; overall headcount-weighted compa-ratio ≈ **1.08**.

### What shows an empty-state with the seed

The Greenland seed only contains **Basic Salary / Firm-weighted**, with a **prior-year (Actual)**
table *derived* from the published YoY medians (tagged "Derived" in the UI). Every other combination
(Incumbent-weighted, Bonus, Bonus %, TCC) shows a tidy empty-state until you ingest the source
workbook. The **Career Issues** figures and the YoY / growth references for components not in the
fixture are tagged "Illustrative".

---

## Architecture

```
src/
  domain/     enums, types, level/component helpers          (single source of types)
  data/       Appendix A fixture, seed assembler, greenland.json
  lib/        benchmark.ts (pure compute), parseWorkbook.ts, format.ts
  store/      Zustand store (localStorage, mounted-guard hydration)
  components/ layout · ui · charts  (shared, design-tokened)
  modules/    one folder per module
  tests/      benchmark · ingest · rendering
scripts/ingest.ts
```

The whole app reads from one active `Dataset` in the store. All math lives in `benchmark.ts`;
components render. Strict TypeScript, no `any`, exhaustive guards — no value reaches the DOM as `NaN`.

Built with Vite + React 18 + TypeScript, Tailwind + Radix (shadcn-style), Recharts, Zustand, SheetJS.
