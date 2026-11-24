import { AYAH_LETTERS, SURAH_NAMES, TOTAL_LETTERS } from './quran-metrics.data.js';

/**
 * Exact measurement of memorization portions given as ayah ranges.
 *
 * Ayat are counted exactly. Athman are measured by text length: the Quran is
 * 480 athman, so one thumn is 1/480 of the Quran's letters. This reflects
 * that short ayat weigh less than long ones, which is the reason athman are
 * reported next to ayat.
 */

export interface PortionSegment {
  surah: number;
  fromAyah: number;
  toAyah: number;
}

export interface MeasuredPortion {
  segments: PortionSegment[];
  ayahCount: number;
  thumnAmount: number;
  errors: string[];
}

export const TOTAL_ATHMAN = 480;
export const LETTERS_PER_THUMN = TOTAL_LETTERS / TOTAL_ATHMAN;
/** Ayah numbering differs slightly between readings (e.g. Qalun vs Hafs); allow that margin. */
const NUMBERING_MARGIN = 5;

export function surahName(n: number): string {
  return SURAH_NAMES[n - 1] ?? `سورة ${n}`;
}

export function ayahCountOf(surah: number): number {
  return AYAH_LETTERS[surah - 1]?.length ?? 0;
}

export function measurePortion(input: unknown): MeasuredPortion {
  const errors: string[] = [];
  const list = Array.isArray(input) ? input : [];
  if (!list.length) errors.push('يرجى إدخال مقدار واحد على الأقل (السورة ومن آية إلى آية).');

  const segments: PortionSegment[] = [];
  let ayahCount = 0;
  let letters = 0;

  list.forEach((raw: any, i: number) => {
    const surah = Number(raw?.surah);
    const fromAyah = Number(raw?.fromAyah);
    const toAyah = Number(raw?.toAyah);
    const label = list.length > 1 ? ` (المقدار ${i + 1})` : '';
    if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
      errors.push(`السورة غير صحيحة${label}.`);
      return;
    }
    const max = ayahCountOf(surah);
    if (!Number.isInteger(fromAyah) || !Number.isInteger(toAyah) || fromAyah < 1 || toAyah < fromAyah) {
      errors.push(`أرقام الآيات غير صحيحة في سورة ${surahName(surah)}${label}: يجب أن تكون «من آية» أصغر من أو تساوي «إلى آية».`);
      return;
    }
    if (toAyah > max + NUMBERING_MARGIN) {
      errors.push(`سورة ${surahName(surah)} عدد آياتها ${max}، والرقم ${toAyah} أكبر من ذلك${label}.`);
      return;
    }
    segments.push({ surah, fromAyah, toAyah });
    ayahCount += toAyah - fromAyah + 1;
    const ayat = AYAH_LETTERS[surah - 1];
    for (let a = fromAyah; a <= Math.min(toAyah, max); a++) letters += ayat[a - 1];
  });

  return {
    segments,
    ayahCount,
    thumnAmount: Math.round((letters / LETTERS_PER_THUMN) * 100) / 100,
    errors,
  };
}

/** "النبأ 1–10، النازعات 1–5" */
export function describeSegments(segments: PortionSegment[]): string {
  return segments
    .map((s) => `${surahName(s.surah)} ${s.fromAyah === s.toAyah ? s.fromAyah : `${s.fromAyah}–${s.toAyah}`}`)
    .join('، ');
}
