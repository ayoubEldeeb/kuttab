import { SURAH_NAMES } from './quranMetrics.data';
import { ayahCountOf } from './quranMetrics';
import { normalizeArabic } from './quranHelpers';

export const PORTION_STATUSES = ['جاري', 'أتقن', 'لم يتقن'] as const;

export interface PortionDraft {
  surah: number;
  fromAyah: string;
  toAyah: string;
}

/** Reads "سورة عبس - الآية 42" (or any text naming a surah) into a surah number and ayah. */
export function parseReach(reach: string | null | undefined): { surah: number; ayah: number | null } | null {
  if (!reach) return null;
  const text = normalizeArabic(reach.includes('|') ? reach.split('|')[1] : reach);
  // Longest names first so "النساء" does not match inside another name, etc.
  const order = SURAH_NAMES.map((n, i) => ({ n: normalizeArabic(n), i })).sort((a, b) => b.n.length - a.n.length);
  const hit = order.find(({ n }) => new RegExp(`سوره\\s*${n}(\\s|$|\\(|-)`).test(text) || text.startsWith(n));
  if (!hit) return null;
  const ayah = text.match(/الايه\s*(\d+)/);
  return { surah: hit.i + 1, ayah: ayah ? Number(ayah[1]) : null };
}

/**
 * Where the next portion most likely starts: right after the last memorized
 * ayah; after a finished surah, the one before it (memorization in the
 * center goes from the end of the Mushaf towards its start).
 */
export function suggestNext(reach: string | null | undefined, size = 5): PortionDraft | null {
  const r = parseReach(reach);
  if (!r) return null;
  const count = ayahCountOf(r.surah);
  if (r.ayah && r.ayah < count) {
    const from = r.ayah + 1;
    return { surah: r.surah, fromAyah: String(from), toAyah: String(Math.min(count, from + size - 1)) };
  }
  const next = r.ayah ? r.surah - 1 : r.surah;
  if (next < 1) return null;
  return { surah: next, fromAyah: '1', toAyah: String(Math.min(ayahCountOf(next), size)) };
}
