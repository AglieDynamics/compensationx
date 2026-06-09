# CompBench

A **workforce capital-allocation platform** built on top of an interactive
**compensation-benchmarking workspace** that reproduces the Vencon Research Consultant Salary Survey
methodology. v1 answers *"are we at market, and what does parity cost?"*; v2 answers *"where should
the next unit of pay go to create or protect the most enterprise value, and what does waiting cost?"*

Fully client-side: no backend, no network at runtime. Ships with a real **Greenland** seed
dataset (Basic Salary, firm-weighted, 2025) so it works with zero setup, and ingests a
Vencon-format `.xlsx` workbook for the full picture.

---

## v2 — Workforce Capital Allocation

A second navigation group, **Capital Allocation**, reframes benchmarking into capital allocation
through five analytical lenses plus a synthesis brief. All new compute lives in a pure, unit-tested
`src/lib/capital.ts` (parallel to `benchmark.ts`); components only render.

| Lens | Route | Question | Needs (beyond the survey) |
|------|-------|----------|---------------------------|
| **Inputs & Assumptions** | `/capital/inputs` | — | Manual grid, CSV/XLSX templates + upload, editable Appendix-A assumptions, scenario editor |
| **Human Capital Convexity** | `/capital/convexity` | Where do small pay moves unlock the most retained value? | attrition, replacement multiple (defaults) |
| **Workforce Value Density** | `/capital/value-density` | Where is value-per-cost concentrated vs diluted? | **value per head** |
| **Pay-Productivity Frontier** | `/capital/frontier` | Is pay ahead of, behind, or aligned with output? | **value per head / productivity** |
| **Cost of Inaction** | `/capital/cost-of-inaction` | What does under-market positioning leak over time? | attrition, inflation (defaults) |
| **Total Workforce Cost** | `/capital/total-cost` | What is the *true* loaded cost, and where are false savings? | overtime, contingent, employer contribution |
| **Capital Allocation Brief** | `/capital/brief` | Where should capital go? | synthesis of all five + printable export |

### Provenance — Measured / Entered / Assumed

Every input carries a provenance, and **every derived figure inherits the weakest provenance among
its inputs** (`MEASURED > ENTERED > ASSUMED`). A view computed entirely on defaults says so plainly
("Modeled on default assumptions"). Provenance chips sit next to headline numbers; edits to the
assumptions panel flip dependent figures to *Entered*; uploaded actuals flip them to *Measured*.

### What is modeled vs measured (out of the box)

The Greenland seed positions the firm **over market** on Analyst/Associate/Principal and **under
market** on Manager/Senior Manager. With zero new data:

- **Convexity, Cost of Inaction, Total Cost** render fully on Appendix-A defaults (clearly tagged
  *Assumed*). Cost of Inaction reframes the v1 ≈ −1,704 GND k present "saving" as multi-year leakage.
- **Value Density & the Frontier** need `valuePerHead` — they show a tidy empty-state with a
  one-click **"Load illustrative value data"** (tagged *Assumed*) and a link to Inputs & Assumptions.
- All default assumptions live solely in `src/lib/assumptions.ts` (Appendix A) — the single source of
  truth, editable in the Assumptions panel.

### Inputs, assumptions & scenarios

- **Inputs & Assumptions** (`/capital/inputs`): edit any per-segment input inline; download CSV
  templates (attrition / value / cost), fill, and re-import (loaded as *Measured*); tune the global
  assumptions; create and edit **scenarios** (per-level target-percentile pay moves).
- **Scenarios** layer proposed pay moves on the baseline; Convexity, Cost of Inaction, the Budget
  Simulator and the Brief all show Baseline → Scenario deltas when a scenario is active.

---

## v3 — Compensation Intelligence Cockpit

v3 makes the platform **operational**: price individual hires, design and govern the salary structure,
and unify everything into an executive cockpit. The landing page is now the **Control Tower**. New
compute lives in pure, unit-tested `src/lib/comp.ts` (pricing + range/structure) and
`src/lib/economics.ts` (workforce-economics metric pack); components render only.

### Prerequisite data layer — Employees & Job Architecture (`/employees`)

The survey gives *market* reference; v3 needs *internal* data. A deterministic synthetic seed
(`npm run gen:employees`, fixed mulberry32 seed `0xC0FFEE`, committed to `src/data/employees.json`)
ships **551 employees** matching the Greenland firm distribution (An 210 / As 174 / M 87 / SM 67 /
Pr 13) across 4 job families and 2 geographies, so pricing/ranges/cockpit all light up on first run
(provenance = *Assumed*). Edit any record inline, download the CSV template, upload your own (flips to
*Measured*), or **Reset to synthetic**.

### Modules

| Module | Route | What it does |
|--------|-------|--------------|
| **Control Tower** (landing) | `/` | Enterprise KPI strip (with assumption/empty-states for revenue-dependent metrics), job-family positioning console, cohort adjustment simulator, workforce-economics views (surfacing the v2 lenses), and a rules-based recommendation queue with expandable score breakdowns. |
| **Job Pricing** | `/pricing` | Turn a hiring request into a governed **Floor / Target / Stretch** offer with an adjustment-by-adjustment rationale waterfall, internal-equity flags, approval state, and saved-case session analytics. |
| **Ranges Designer** | `/structure` | Design (benchmark / fixed / regression progression), test, and **publish** salary structures; map employees (compa-ratio, range penetration, green/red-circle); cost-to-policy, **Range Confidence Index**, **Equity Tension**, **Cost of Structure Debt**, **Talent Scarcity Premium**. |

The v1 **Summary Dashboard** moved from `/` to `/dashboard` (component unchanged); all v1/v2 modules and
routes are otherwise intact.

### Heuristic vs measured (explainable, not ML)

Every "AI" feature in v3 is a **transparent, deterministic heuristic**, labeled
*"rule/statistics-based; ML upgrade is platform-track"*: anomaly flags (z-score / IQR within peer
buckets, compression, progression inconsistency), attrition risk (the v2 retention logistic),
greedy constrained budget allocation, and templated board narrative. Provenance (Measured / Entered /
Assumed) and the **Range/Market Confidence Index** extend the v2 system. Default assumptions live only in
`src/lib/assumptions.ts` (Appendix B).

### Platform Track (out of scope — documented, not stubbed)

The following are **deliberately not built** in this client-side app and are documented as the backend
platform track: multi-provider live survey ingestion + HRIS/payroll/finance/ATS integration; SSO + RBAC
+ pay masking + immutable audit + maker-checker approval workflows + multi-tenant; **true ML** (anomaly,
attrition prediction, pay elasticity, forecaster), a constrained-optimization budget solver, a
market-movement autopilot, closed-loop outcome learning, and a natural-language copilot. Nothing above is
faked as UI — each surfaced heuristic states its ML-upgrade path.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173  → Control Tower cockpit renders immediately
```

Other scripts:

```bash
npm run ingest         # (re)generate src/data/greenland.json from a source workbook, or the fixture
npm run gen:employees  # (re)generate the deterministic synthetic employee seed (src/data/employees.json)
npm run test           # Vitest: §5 compute assertions + ingest round-trip + render + capital + comp + heuristics
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
