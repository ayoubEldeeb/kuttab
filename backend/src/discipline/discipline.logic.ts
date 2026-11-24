/**
 * Discipline rules, kept pure so they can be unit tested.
 *
 * Unexcused absences are counted from the last decision taken about the
 * student (a warning, a pardon, a dismissal or a reinstatement). When the
 * count reaches the threshold the app raises an alert; the sheikh decides.
 * Every number here comes from the center's settings.
 */

export type DisciplineKind = 'warning' | 'pardon' | 'dismissal' | 'reinstatement';
export const DISCIPLINE_KINDS: DisciplineKind[] = ['warning', 'pardon', 'dismissal', 'reinstatement'];

export type CountWindow = 'since_last_decision' | 'month';

export interface DisciplineSettings {
  enabled: boolean;
  /** Unexcused absences that trigger an alert. */
  absenceThreshold: number;
  /** Warnings before the next alert proposes dismissal. */
  maxWarnings: number;
  countWindow: CountWindow;
}

export const DEFAULT_DISCIPLINE_SETTINGS: DisciplineSettings = {
  enabled: true,
  absenceThreshold: 2,
  maxWarnings: 2,
  countWindow: 'since_last_decision',
};

export interface DisciplineAlert {
  /** What the app proposes; the sheikh may still choose any action. */
  suggestion: 'warning' | 'dismissal';
  /** Number of the warning that would be issued (1-based), for "warning". */
  warningNumber: number;
  title: string;
  message: string;
}

export interface DisciplineState {
  status: string;
  warnings: number;
  maxWarnings: number;
  /** True when the student already has the maximum number of warnings. */
  atLimit: boolean;
  unexcusedAbsences: number;
  absenceThreshold: number;
  countingFrom: string | null;
  alert: DisciplineAlert | null;
}

const toInt = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

/** Reads discipline settings from the raw settings map, with safe defaults. */
export function readDisciplineSettings(raw: Record<string, unknown>): DisciplineSettings {
  const d = DEFAULT_DISCIPLINE_SETTINGS;
  const enabledRaw = raw.disciplineEnabled;
  return {
    enabled: enabledRaw === undefined ? d.enabled : enabledRaw === true || enabledRaw === 'true',
    absenceThreshold: toInt(raw.disciplineAbsenceThreshold, d.absenceThreshold, 1, 30),
    maxWarnings: toInt(raw.disciplineMaxWarnings, d.maxWarnings, 1, 10),
    countWindow: raw.disciplineCountWindow === 'month' ? 'month' : 'since_last_decision',
  };
}

export function ordinalWarning(n: number): string {
  const names = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
  return names[n - 1] ?? `رقم ${n}`;
}

/** "مرة واحدة" / "مرتين" / "3 مرات" / "11 مرة" */
export function timesAr(n: number): string {
  if (n === 1) return 'مرة واحدة';
  if (n === 2) return 'مرتين';
  if (n >= 3 && n <= 10) return `${n} مرات`;
  return `${n} مرة`;
}

/** "إنذار واحد" / "إنذاران" / "3 إنذارات" / "11 إنذاراً" */
export function warningsAr(n: number): string {
  if (n === 0) return 'لا إنذارات';
  if (n === 1) return 'إنذار واحد';
  if (n === 2) return 'إنذاران';
  if (n >= 3 && n <= 10) return `${n} إنذارات`;
  return `${n} إنذاراً`;
}

export function computeDisciplineState(input: {
  status: string;
  /** Dates of unexcused absences. */
  absences: Date[];
  actions: { kind: string; date: Date }[];
  settings: DisciplineSettings;
  now?: Date;
}): DisciplineState {
  const { settings } = input;
  const now = input.now ?? new Date();
  const actions = [...input.actions].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Warnings before the latest reinstatement no longer count.
  const lastReinstatement = [...actions].reverse().find((a) => a.kind === 'reinstatement');
  const warnings = actions.filter(
    (a) => a.kind === 'warning' && (!lastReinstatement || a.date.getTime() > lastReinstatement.date.getTime()),
  ).length;

  const lastDecision = actions.length ? actions[actions.length - 1].date : null;
  let from = lastDecision;
  if (settings.countWindow === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    if (!from || monthStart.getTime() > from.getTime()) from = monthStart;
  }
  const unexcused = input.absences.filter((d) => !from || d.getTime() > from.getTime()).length;

  const atLimit = warnings >= settings.maxWarnings;
  let alert: DisciplineAlert | null = null;

  if (settings.enabled && input.status === 'active' && unexcused >= settings.absenceThreshold) {
    if (!atLimit) {
      const n = warnings + 1;
      alert = {
        suggestion: 'warning',
        warningNumber: n,
        title: `يستحق الإنذار ${ordinalWarning(n)}`,
        message: `غاب الطالب ${timesAr(unexcused)} بدون إذن${warnings ? ' بعد آخر إنذار' : ''}. هل تريد إعطاءه الإنذار ${ordinalWarning(n)}؟`,
      };
    } else {
      alert = {
        suggestion: 'dismissal',
        warningNumber: warnings + 1,
        title: `لدى الطالب ${warningsAr(warnings)} — ماذا تريد أن تفعل؟`,
        message: `لدى الطالب ${warningsAr(warnings)} (الحد المعتمد ${warningsAr(settings.maxWarnings)})، وغاب ${timesAr(unexcused)} بدون إذن بعد آخر قرار. يمكنك فصله، أو إعطاؤه إنذاراً إضافياً، أو التجاوز عنه هذه المرة.`,
      };
    }
  }

  return {
    status: input.status,
    warnings,
    maxWarnings: settings.maxWarnings,
    atLimit,
    unexcusedAbsences: unexcused,
    absenceThreshold: settings.absenceThreshold,
    countingFrom: from ? from.toISOString() : null,
    alert,
  };
}
