import { ATHMAN, QUARTERS } from '../components/ui/quran-data';

/**
 * Converts Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) and Persian numerals to English numerals (0123456789)
 */
export const convertArabicToEnglishNumbers = (text: string | null | undefined): string => {
  if (!text) return '';
  return String(text)
    .replace(/[٠۰]/g, '0')
    .replace(/[١۱]/g, '1')
    .replace(/[٢۲]/g, '2')
    .replace(/[٣۳]/g, '3')
    .replace(/[٤۴]/g, '4')
    .replace(/[٥۵]/g, '5')
    .replace(/[٦۶]/g, '6')
    .replace(/[٧۷]/g, '7')
    .replace(/[٨۸]/g, '8')
    .replace(/[٩۹]/g, '9');
};

/**
 * Normalizes Arabic text for flexible matching across different vocalization / diacritics
 * and ensures numbers are converted to English digits for consistent search.
 */
export const normalizeArabic = (text: string): string => {
  if (!text) return '';
  return convertArabicToEnglishNumbers(text)
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '') // Remove harakat
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width characters
    .replace(/ٱ/g, 'ا') // Alef wasla
    .replace(/[أإآ]/g, 'ا') // Normalize alefs
    .replace(/ة/g, 'ه') // Taa marbouta
    .replace(/ى/g, 'ي') // Yaa
    .replace(/ـ/g, '') // Tatweel
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Finds the index (0..479) of a given Quran part in the ATHMAN array.
 * Supports exact match, normalized match, Qalun Hizb/Thumn, legacy Rub/Thumn, quarter match, and surah match.
 */
export const findThumnIndex = (part: string | null | undefined): number => {
  if (!part) return -1;
  const trimmed = part.trim();
  if (!trimmed) return -1;

  // 1. Direct match in ATHMAN
  const directIdx = ATHMAN.indexOf(trimmed);
  if (directIdx !== -1) return directIdx;

  // 2. Normalize and check contains / match
  const normTarget = normalizeArabic(trimmed);

  // Check if it's in ATHMAN by normalized string
  for (let i = 0; i < ATHMAN.length; i++) {
    const normAthman = normalizeArabic(ATHMAN[i]);
    if (normAthman === normTarget || normAthman.includes(normTarget) || normTarget.includes(normAthman)) {
      return i;
    }
  }

  // 3. Match by Qalun Hizb & Thumn: "الحزب Y - الثمن Z"
  const thumnMap: Record<string, number> = {
    'الاول': 0,
    'الثاني': 1,
    'الثالث': 2,
    'الرابع': 3,
    'الخامس': 4,
    'السادس': 5,
    'السابع': 6,
    'الثامن': 7
  };
  const thumnMatch = normTarget.match(/الحزب\s*(\d+)\s*-\s*الثمن\s*([\u0621-\u064A]+)/);
  if (thumnMatch) {
    const hizbNum = parseInt(thumnMatch[1], 10);
    const thumnWord = thumnMatch[2].trim();
    if (hizbNum >= 1 && hizbNum <= 60 && thumnMap[thumnWord] !== undefined) {
      const targetIdx = (hizbNum - 1) * 8 + thumnMap[thumnWord];
      if (targetIdx >= 0 && targetIdx < ATHMAN.length) {
        return targetIdx;
      }
    }
  }

  // 4. Match legacy Rub & Thumn format: "الحزب Y - الربع Z"
  const rubRankMap: Record<string, number> = {
    'الاول': 0,
    'الثاني': 1,
    'الثالث': 2,
    'الرابع': 3
  };
  const legacyRubMatch = normTarget.match(/الحزب\s*(\d+)\s*-\s*الربع\s*([\u0621-\u064A]+)/);
  if (legacyRubMatch) {
    const hizbNum = parseInt(legacyRubMatch[1], 10);
    const rubWord = legacyRubMatch[2].trim();
    if (hizbNum >= 1 && hizbNum <= 60 && rubRankMap[rubWord] !== undefined) {
      const rubBase = (hizbNum - 1) * 8 + rubRankMap[rubWord] * 2;
      const isSecondThumn = normTarget.includes('الثمن الثاني');
      const targetIdx = Math.min(rubBase + (isSecondThumn ? 1 : 0), ATHMAN.length - 1);
      return targetIdx;
    }
  }

  // 5. Match by quarter string in QUARTERS
  const qIdx = QUARTERS.findIndex((q) => normalizeArabic(q) === normTarget || normalizeArabic(q).includes(normTarget));
  if (qIdx !== -1) {
    // In Qalun, each quarter corresponds to 2 thumns (qIdx * 2)
    const athmanCandidate = qIdx * 2;
    if (athmanCandidate < ATHMAN.length) return athmanCandidate;
  }

  // 6. Match by Surah name
  const surahMatch = trimmed.match(/سورة\s*([^\s\(\)\|]+)/);
  if (surahMatch) {
    const sName = normalizeArabic(surahMatch[1]);
    for (let i = 0; i < ATHMAN.length; i++) {
      if (normalizeArabic(ATHMAN[i]).includes(sName)) {
        return i;
      }
    }
  }

  return -1;
};

/**
 * Returns the next Thumn in the Holy Quran sequence.
 * @param currentPart Current part/thumn string
 * @param step Number of thumns to advance (default 1)
 */
export const getNextThumn = (currentPart: string | null | undefined, step: number = 1): string => {
  if (!currentPart) {
    // If empty, start with the very first thumn (Al-Fatihah)
    return ATHMAN[0];
  }
  const idx = findThumnIndex(currentPart);
  if (idx === -1) {
    return ATHMAN[0];
  }
  const nextIdx = Math.min(idx + step, ATHMAN.length - 1);
  return ATHMAN[nextIdx];
};

/**
 * Returns the previous Thumn in the Holy Quran sequence.
 * @param currentPart Current part/thumn string
 * @param step Number of thumns to go back (default 1)
 */
export const getPreviousThumn = (currentPart: string | null | undefined, step: number = 1): string => {
  if (!currentPart) return ATHMAN[0];
  const idx = findThumnIndex(currentPart);
  if (idx <= 0) return ATHMAN[0];
  const prevIdx = Math.max(idx - step, 0);
  return ATHMAN[prevIdx];
};

/**
 * Returns a friendly, compact title for a Thumn string.
 * e.g. "سورة الشعراء (الثمن الرابع)"
 */
export const getThumnDisplayTitle = (thumn: string | null | undefined): string => {
  if (!thumn) return '';
  if (thumn.includes('|')) {
    const parts = thumn.split('|');
    const location = parts[0].trim();
    const surah = parts[1].trim();

    // Clean surah name
    const surahName = surah.replace(/\(.*?\)/, '').trim();

    // Extract thumn rank (e.g. "الثمن الأول", "الثمن الثالث (الربع)", etc.)
    const thumnMatch = location.match(/الثمن\s*[\u0621-\u064A]+(\s*\([^)]+\))?/);
    const thumnRank = thumnMatch ? thumnMatch[0] : '';

    return `${surahName} ${thumnRank ? `(${thumnRank})` : ''}`.trim();
  }
  return thumn;
};

export interface ParsedQuranPart {
  surah: string;
  position: string;
  ayah: string;
  fullDisplay: string;
}

/**
 * Parses any Quran part string into clean, structured components:
 * Surah, Position (Juz/Hizb/Rub/Thumn), Ayah snippet, and complete readable display string.
 */
export const parseQuranPart = (part: string | null | undefined): ParsedQuranPart => {
  if (!part) {
    return { surah: '', position: '', ayah: '', fullDisplay: '' };
  }

  const trimmed = part.trim();

  // Pattern with pipe: "الجزء 19 - الحزب 37 - الربع الثالث - الثمن الثاني | سورة الشعراء (فَإِنَّهُمْ عَدُوٌّ...)"
  if (trimmed.includes('|')) {
    const [left, right] = trimmed.split('|').map((s) => s.trim());
    const surahMatch = right.match(/^سورة\s*([^(\]]+)/);
    const rawSurah = surahMatch ? surahMatch[1].trim() : right;
    const surah = rawSurah.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '').trim();
    const ayahMatch = right.match(/\((.*?)\)/);
    const ayah = ayahMatch ? ayahMatch[1].trim() : '';

    const fullDisplay = `سورة ${surah} • ${left}${ayah ? `: «${ayah}»` : ''}`;
    return { surah: `سورة ${surah}`, position: left, ayah, fullDisplay };
  }

  // Beginning of Surah: "بداية سورة الشعراء"
  if (trimmed.startsWith('بداية سورة ')) {
    const surah = trimmed.replace('بداية سورة ', '').trim();
    return {
      surah: `سورة ${surah}`,
      position: 'بداية السورة (الآية 1)',
      ayah: '',
      fullDisplay: `بداية سورة ${surah}`,
    };
  }

  // Ayahs count format: "5 آيات من سورة النبأ (1-5)"
  if (trimmed.includes('آيات من سورة') || trimmed.includes('آية من سورة')) {
    const surahMatch = trimmed.match(/سورة\s*([^(\]]+)/);
    const surah = surahMatch ? surahMatch[1].trim() : '';
    const ayahMatch = trimmed.match(/\((.*?)\)/);
    const ayah = ayahMatch ? ayahMatch[1].trim() : '';
    return {
      surah: surah ? `سورة ${surah}` : '',
      position: trimmed.split('(')[0].trim(),
      ayah: ayah ? `الآيات: ${ayah}` : '',
      fullDisplay: trimmed,
    };
  }

  // Check if it has an ayah in parenthesis: "الموضع (الآية...)"
  const parenMatch = trimmed.match(/\((.*?)\)/);
  const ayah = parenMatch ? parenMatch[1].trim() : '';
  const position = trimmed.replace(/\(.*?\)/, '').trim();

  return {
    surah: '',
    position,
    ayah,
    fullDisplay: trimmed,
  };
};

/**
 * Checks if two Quran part strings refer to the same selection,
 * taking into account different formatting, pipe separators, and Arabic normalization.
 */
export const isPartMatch = (partA: string | null | undefined, partB: string | null | undefined): boolean => {
  if (!partA || !partB) return false;
  if (partA === partB) return true;

  const normA = normalizeArabic(partA);
  const normB = normalizeArabic(partB);
  if (normA === normB) return true;

  // Check Thumn index match in master ATHMAN array
  const idxA = findThumnIndex(partA);
  const idxB = findThumnIndex(partB);
  if (idxA !== -1 && idxB !== -1 && idxA === idxB) {
    return true;
  }

  // Check if stripped positions match
  const posA = normA.split('|')[0].trim();
  const posB = normB.split('|')[0].trim();
  if (posA && posB && posA === posB) {
    return true;
  }

  return false;
};

/**
 * Formats a date relative to the base date in friendly Arabic:
 * - 0 days: 'اليوم'
 * - 1 day: 'أمس'
 * - 2 days: 'قبل يومين'
 * - 3 days: 'قبل 3 أيام'
 * - > 3 days: 'الخميس 10 سبتمبر' (day name + date)
 */
export const formatRelativeArabicDate = (
  targetDateStr: string | null | undefined,
  baseDateStr?: string
): { label: string; fullDate: string } => {
  if (!targetDateStr) return { label: 'لا يوجد رصد سابق', fullDate: '' };

  const targetDate = new Date(targetDateStr);
  const baseDate = baseDateStr ? new Date(baseDateStr) : new Date();

  // Normalize dates to midnight for exact calendar day diff
  const tMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const bMidnight = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

  const diffMs = bMidnight.getTime() - tMidnight.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const dayName = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(targetDate);
  const dayAndMonth = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long' }).format(targetDate);
  const fullDate = `${dayName} ${dayAndMonth}`;

  let label = '';
  if (diffDays === 0) {
    label = 'اليوم';
  } else if (diffDays === 1) {
    label = 'أمس';
  } else if (diffDays === 2) {
    label = 'قبل يومين';
  } else if (diffDays === 3) {
    label = 'قبل 3 أيام';
  } else {
    label = fullDate;
  }

  return { label, fullDate };
};

