import { useQuery, type QueryClient } from '@tanstack/react-query';
import api from './api';
import { WEEK_DAYS } from '../context/ThemeAndSettingsContext';
import { getQuranStage } from './quranStages';

// ------------------------------------------------------------------ periods

export type PeriodId = 'asr' | 'maghrib';

export const PERIODS: { id: PeriodId; name: string; range: string }[] = [
  { id: 'asr', name: 'فترة العصر', range: 'من العصر إلى المغرب' },
  { id: 'maghrib', name: 'فترة المغرب', range: 'من المغرب إلى العشاء' },
];

/** "طالب واحد" / "طالبان" / "3 طلاب" / "11 طالباً" */
export function studentsAr(n: number): string {
  if (n === 1) return 'طالب واحد';
  if (n === 2) return 'طالبان';
  if (n >= 3 && n <= 10) return `${n} طلاب`;
  return `${n} طالباً`;
}

/** Today's date as yyyy-mm-dd in local time (toISOString would use UTC). */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function periodName(id: string | null | undefined): string {
  return PERIODS.find((p) => p.id === id)?.name ?? 'بدون فترة';
}

// ------------------------------------------------------------------ halaqat

export interface Halaqa {
  id: number;
  name: string;
  period: PeriodId;
  sheikhId: number | null;
  notes: string | null;
  sheikh?: { id: number; name: string; role: string } | null;
  studentsCount: number;
}

export function useHalaqat() {
  return useQuery<Halaqa[]>({
    queryKey: ['halaqat'],
    queryFn: async () => (await api.get('/halaqat')).data,
    staleTime: 30_000,
  });
}

/** Everything that shows halaqat, periods or student placement. */
export function invalidatePlacement(qc: QueryClient) {
  for (const key of ['halaqat', 'students', 'student', 'students-quick', 'dashboard-stats', 'sheikhs-supervision-stats']) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

/** Filter value for period/halaqa selects: 'all', 'none' (no halaqa), a period id, or `h:<id>`. */
export function matchesPlacement(
  student: { period?: string | null; halaqaId?: number | null },
  period: string,
  halaqa: string,
): boolean {
  if (period !== 'all') {
    if (period === 'none' ? !!student.period : student.period !== period) return false;
  }
  if (halaqa !== 'all') {
    if (halaqa === 'none') return !student.halaqaId;
    return student.halaqaId === Number(halaqa);
  }
  return true;
}

/**
 * The program rule from the center: a student in the Maghrib period who has
 * reached Surat Al-Mujadila (juz' 28 onward) is moved to the Asr period.
 * This only suggests; the move itself is the sheikh's decision.
 */
const PAST_MUJADILA = new Set(['جزء قد سمع', 'ربع ياسين', 'ربع مريم', 'ربع الأعراف', 'ربع البقرة']);
export function suggestsAsrMove(student: { period?: string | null; currentReach?: string | null }): boolean {
  return student.period === 'maghrib' && PAST_MUJADILA.has(getQuranStage(student.currentReach));
}

// ------------------------------------------------------------------ settings

export interface ProgramSettings {
  disciplineEnabled: boolean;
  disciplineAbsenceThreshold: number;
  disciplineMaxWarnings: number;
  disciplineCountWindow: 'since_last_decision' | 'month';
  weekStartDay: string;
  revisionExamDay: string;
  defaultDailyRevisionAmount: number;
  defaultExamRevisionJuz: number;
}

export const DEFAULT_PROGRAM_SETTINGS: ProgramSettings = {
  disciplineEnabled: true,
  disciplineAbsenceThreshold: 2,
  disciplineMaxWarnings: 2,
  disciplineCountWindow: 'since_last_decision',
  weekStartDay: 'saturday',
  revisionExamDay: 'saturday',
  defaultDailyRevisionAmount: 4,
  defaultExamRevisionJuz: 3,
};

export function useProgramSettings() {
  return useQuery<ProgramSettings>({
    queryKey: ['program-settings'],
    queryFn: async () => {
      const data = (await api.get('/settings')).data ?? {};
      const out = { ...DEFAULT_PROGRAM_SETTINGS };
      for (const key of Object.keys(out) as (keyof ProgramSettings)[]) {
        if (data[key] !== undefined && data[key] !== null) (out as any)[key] = data[key];
      }
      return out;
    },
    staleTime: 60_000,
  });
}

/** JS weekday index (0 = Sunday) of a settings day id such as 'saturday'. */
export function weekdayIndex(dayId: string): number {
  return WEEK_DAYS.find((d) => d.id === dayId)?.index ?? 6;
}

export function weekdayName(dayId: string): string {
  return WEEK_DAYS.find((d) => d.id === dayId)?.name ?? dayId;
}

// ------------------------------------------------------------------ discipline

export type DisciplineKind = 'warning' | 'pardon' | 'dismissal' | 'reinstatement';

export interface DisciplineAlert {
  suggestion: 'warning' | 'dismissal';
  warningNumber: number;
  title: string;
  message: string;
}

export interface DisciplineState {
  status: string;
  warnings: number;
  maxWarnings: number;
  atLimit: boolean;
  unexcusedAbsences: number;
  absenceThreshold: number;
  countingFrom: string | null;
  alert: DisciplineAlert | null;
}

export interface DisciplineActionRow {
  id: number;
  studentId: number;
  date: string;
  kind: DisciplineKind;
  absenceCount: number;
  reason: string | null;
  byName: string | null;
}

export interface DisciplineAlertRow {
  student: { id: number; name: string; serialNumber: string; period: string | null; guardianPhone: string | null; halaqa: { id: number; name: string } | null };
  state: DisciplineState;
}

export const DISCIPLINE_KIND_LABELS: Record<DisciplineKind, string> = {
  warning: 'إنذار',
  pardon: 'تجاوز',
  dismissal: 'فصل',
  reinstatement: 'إعادة',
};

export function useDisciplineAlerts(enabled = true) {
  return useQuery<DisciplineAlertRow[]>({
    queryKey: ['discipline-alerts'],
    queryFn: async () => (await api.get('/discipline/alerts')).data,
    enabled,
    refetchInterval: 60_000,
  });
}

export function invalidateDiscipline(qc: QueryClient, studentId?: number) {
  qc.invalidateQueries({ queryKey: ['discipline-alerts'] });
  if (studentId) qc.invalidateQueries({ queryKey: ['discipline', studentId] });
  else qc.invalidateQueries({ queryKey: ['discipline'] });
}

/** Arabic error text from an axios error. */
export function apiError(err: any, fallback = 'حدث خطأ غير متوقع'): string {
  const msg = err?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join('، ');
  return typeof msg === 'string' && msg ? msg : fallback;
}
