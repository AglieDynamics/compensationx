/**
 * Tiny bundled fallback so the macro viewer renders something meaningful when
 * offline or when DBnomics is unreachable. Real historical US CPI inflation
 * (World Bank WDI), clearly tagged `fallback: true` so the UI never passes it
 * off as a live pull. Deterministic (fixed retrievedAt) — no runtime clock.
 */

import type { TimeSeries } from './timeSeries';

export const FALLBACK_SERIES: TimeSeries = {
  sourceId: 'dbnomics',
  providerCode: 'WB',
  datasetCode: 'WDI',
  indicatorCode: 'FP.CPI.TOTL.ZG',
  seriesCode: 'A-FP.CPI.TOTL.ZG-USA',
  seriesName: 'Annual – Inflation, consumer prices (annual %) – United States',
  country: 'USA',
  unit: '% / yr',
  frequency: 'annual',
  observations: [
    { period: '2015', value: 0.12 },
    { period: '2016', value: 1.26 },
    { period: '2017', value: 2.13 },
    { period: '2018', value: 2.44 },
    { period: '2019', value: 1.81 },
    { period: '2020', value: 1.23 },
    { period: '2021', value: 4.7 },
    { period: '2022', value: 8.0 },
    { period: '2023', value: 4.12 },
  ],
  retrievedAt: '2024-01-01T00:00:00.000Z',
  cached: false,
  fallback: true,
  provenance: {
    sourceLabel: 'Bundled fallback · World Bank WDI',
    sourceUrl: 'https://db.nomics.world/WB/WDI/A-FP.CPI.TOTL.ZG-USA',
    license: 'World Bank Open Data — CC BY 4.0',
  },
};
