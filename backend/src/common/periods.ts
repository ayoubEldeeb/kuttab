/** The two teaching periods of the center. Keys are stored on students and halaqat. */
export const PERIODS = [
  { id: 'asr', name: 'فترة العصر', range: 'من العصر إلى المغرب' },
  { id: 'maghrib', name: 'فترة المغرب', range: 'من المغرب إلى العشاء' },
] as const;

export type PeriodId = (typeof PERIODS)[number]['id'];

export function isPeriodId(v: unknown): v is PeriodId {
  return PERIODS.some((p) => p.id === v);
}

export function periodName(id: string | null | undefined): string {
  return PERIODS.find((p) => p.id === id)?.name ?? 'بدون فترة';
}
