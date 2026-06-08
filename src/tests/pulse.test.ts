import { describe, expect, it } from 'vitest';
import { parseSheets } from '@/lib/parseWorkbook';
import { buildPulseSummary } from '@/modules/pulse/pulseModel';
import type { PulseDataset } from '@/domain/types';

type Cell = string | number | null;

describe('Pulse parsing (Raw Data sheet)', () => {
  it('parses long-format responses, mapping Area to GCC / NON_GCC', () => {
    const aoa: Cell[][] = [
      ['Area', 'Section', 'Question_ID', 'Question', 'Item_or_Option', 'Response_Type', 'Response', 'Comment'],
      ['GCC', 'S1 Context', 'Q1', 'Question 1', '', 'SINGLE', 'Agree', ''],
      ['GCC', 'S1 Context', 'Q1', 'Question 1', '', 'SINGLE', 'Agree', ''],
      ['Non-GCC', 'S1 Context', 'Q1', 'Question 1', '', 'SINGLE', 'Disagree', ''],
      ['GCC', 'S4 Compensation', 'Q2', 'Question 2', 'Bonus', 'MULTI', 'Yes', 'ok'],
      ['Non-GCC', 'S4 Compensation', 'Q2', 'Question 2', 'Bonus', 'MULTI', 'No', ''],
    ];
    const { dataset } = parseSheets([{ name: 'Raw Data', aoa }]);
    expect(dataset.pulse).toBeTruthy();
    const pulse = dataset.pulse!;
    expect(pulse.responses).toHaveLength(5);
    expect(pulse.sections).toEqual(['S1 Context', 'S4 Compensation']);
    expect(pulse.responses.filter((r) => r.area === 'GCC')).toHaveLength(3);
    expect(pulse.responses.filter((r) => r.area === 'NON_GCC')).toHaveLength(2);
    expect(pulse.responses.find((r) => r.responseType === 'MULTI')?.item).toBe('Bonus');
  });

  it('returns no pulse when there is no Raw Data sheet', () => {
    const { dataset } = parseSheets([]);
    expect(dataset.pulse).toBeUndefined();
  });
});

describe('buildPulseSummary', () => {
  const pulse: PulseDataset = {
    sections: ['S1 Context'],
    responses: [
      { area: 'GCC', section: 'S1 Context', questionId: 'Q1', question: 'Q1', responseType: 'SINGLE', response: 'Agree' },
      { area: 'GCC', section: 'S1 Context', questionId: 'Q1', question: 'Q1', responseType: 'SINGLE', response: 'Agree' },
      { area: 'NON_GCC', section: 'S1 Context', questionId: 'Q1', question: 'Q1', responseType: 'SINGLE', response: 'Disagree' },
    ],
  };

  it('aggregates GCC vs Non-GCC tallies per response', () => {
    const s = buildPulseSummary(pulse);
    expect(s.total).toBe(3);
    expect(s.gcc).toBe(2);
    expect(s.nonGcc).toBe(1);
    const section = s.sections[0]!;
    const agree = section.tallies.find((t) => t.label === 'Agree')!;
    expect(agree.gcc).toBe(2);
    expect(agree.nonGcc).toBe(0);
    const disagree = section.tallies.find((t) => t.label === 'Disagree')!;
    expect(disagree.nonGcc).toBe(1);
  });
});
