import { computeDisciplineState, readDisciplineSettings, timesAr, warningsAr, DEFAULT_DISCIPLINE_SETTINGS } from './discipline.logic.js';

const d = (s: string) => new Date(s);
const S = DEFAULT_DISCIPLINE_SETTINGS; // threshold 2, max 2 warnings

describe('computeDisciplineState', () => {
  it('no alert below the threshold', () => {
    const st = computeDisciplineState({ status: 'active', absences: [d('2026-11-01')], actions: [], settings: S });
    expect(st.unexcusedAbsences).toBe(1);
    expect(st.alert).toBeNull();
  });

  it('proposes the first warning at 2 unexcused absences', () => {
    const st = computeDisciplineState({ status: 'active', absences: [d('2026-11-01'), d('2026-11-03')], actions: [], settings: S });
    expect(st.alert).toMatchObject({ suggestion: 'warning', warningNumber: 1 });
    expect(st.alert!.message).toContain('مرتين');
  });

  it('counts only absences after the last decision', () => {
    const st = computeDisciplineState({
      status: 'active',
      absences: [d('2026-11-01'), d('2026-11-03'), d('2026-11-10')],
      actions: [{ kind: 'warning', date: d('2026-11-04T12:00:00Z') }],
      settings: S,
    });
    expect(st.warnings).toBe(1);
    expect(st.unexcusedAbsences).toBe(1);
    expect(st.alert).toBeNull();
  });

  it('a pardon resets the count without adding a warning', () => {
    const st = computeDisciplineState({
      status: 'active',
      absences: [d('2026-11-01'), d('2026-11-03')],
      actions: [{ kind: 'pardon', date: d('2026-11-04') }],
      settings: S,
    });
    expect(st.warnings).toBe(0);
    expect(st.unexcusedAbsences).toBe(0);
    expect(st.alert).toBeNull();
  });

  it('with 2 warnings, the next threshold asks what to do (dismissal proposed)', () => {
    const st = computeDisciplineState({
      status: 'active',
      absences: [d('2026-11-01'), d('2026-11-02'), d('2026-11-10'), d('2026-11-11'), d('2026-11-20'), d('2026-11-21')],
      actions: [
        { kind: 'warning', date: d('2026-11-03') },
        { kind: 'warning', date: d('2026-11-12') },
      ],
      settings: S,
    });
    expect(st.warnings).toBe(2);
    expect(st.atLimit).toBe(true);
    expect(st.alert).toMatchObject({ suggestion: 'dismissal' });
    expect(st.alert!.title).toContain('إنذاران');
    expect(st.alert!.title).toContain('ماذا تريد أن تفعل');
  });

  it('marks atLimit as soon as the maximum is reached, before any new absence', () => {
    const st = computeDisciplineState({
      status: 'active',
      absences: [],
      actions: [
        { kind: 'warning', date: d('2026-11-03') },
        { kind: 'warning', date: d('2026-11-12') },
      ],
      settings: S,
    });
    expect(st.atLimit).toBe(true);
    expect(st.alert).toBeNull();
  });

  it('respects custom settings (3 absences, 1 warning)', () => {
    const settings = { ...S, absenceThreshold: 3, maxWarnings: 1 };
    const two = computeDisciplineState({ status: 'active', absences: [d('2026-11-01'), d('2026-11-02')], actions: [], settings });
    expect(two.alert).toBeNull();
    const after = computeDisciplineState({
      status: 'active',
      absences: [d('2026-11-05'), d('2026-11-06'), d('2026-11-07')],
      actions: [{ kind: 'warning', date: d('2026-11-04') }],
      settings,
    });
    expect(after.alert?.suggestion).toBe('dismissal');
  });

  it('monthly window ignores absences of previous months', () => {
    const settings = { ...S, countWindow: 'month' as const };
    const st = computeDisciplineState({
      status: 'active',
      absences: [d('2026-10-28'), d('2026-10-29'), d('2026-11-02')],
      actions: [],
      settings,
      now: d('2026-11-15T10:00:00'),
    });
    expect(st.unexcusedAbsences).toBe(1);
    expect(st.alert).toBeNull();
  });

  it('reinstatement clears previous warnings', () => {
    const st = computeDisciplineState({
      status: 'active',
      absences: [],
      actions: [
        { kind: 'warning', date: d('2026-10-01') },
        { kind: 'warning', date: d('2026-10-05') },
        { kind: 'dismissal', date: d('2026-10-10') },
        { kind: 'reinstatement', date: d('2026-11-01') },
      ],
      settings: S,
    });
    expect(st.warnings).toBe(0);
    expect(st.atLimit).toBe(false);
  });

  it('no alerts for dismissed students or when disabled', () => {
    const abs = [d('2026-11-01'), d('2026-11-02')];
    expect(computeDisciplineState({ status: 'dismissed', absences: abs, actions: [], settings: S }).alert).toBeNull();
    expect(computeDisciplineState({ status: 'active', absences: abs, actions: [], settings: { ...S, enabled: false } }).alert).toBeNull();
  });
});

describe('readDisciplineSettings', () => {
  it('falls back to defaults on invalid values', () => {
    expect(readDisciplineSettings({ disciplineAbsenceThreshold: 'x', disciplineMaxWarnings: 0 })).toEqual(S);
    expect(readDisciplineSettings({ disciplineAbsenceThreshold: 3, disciplineEnabled: false, disciplineCountWindow: 'month' })).toMatchObject({
      absenceThreshold: 3,
      enabled: false,
      countWindow: 'month',
    });
  });
});

describe('Arabic counting words', () => {
  it('agrees with the number', () => {
    expect([1, 2, 3, 11].map(timesAr)).toEqual(['مرة واحدة', 'مرتين', '3 مرات', '11 مرة']);
    expect([1, 2, 5].map(warningsAr)).toEqual(['إنذار واحد', 'إنذاران', '5 إنذارات']);
  });
});
