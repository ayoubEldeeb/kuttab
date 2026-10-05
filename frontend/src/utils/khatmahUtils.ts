/**
 * Utility functions and constants for managing Quran Khatmah (إتمام ختم القرآن الكريم)
 */

export interface KhatmahOption {
  value: number;
  label: string;
  shortLabel: string;
  badgeClass: string;
}

export const KHATMAH_PRESETS: KhatmahOption[] = [
  { 
    value: 1, 
    label: 'الختمة الأولى (أتم ختمة واحدة)', 
    shortLabel: 'الختمة الأولى',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-300/80 shadow-xs'
  },
  { 
    value: 2, 
    label: 'الختمة الثانية (أتم ختمتين)', 
    shortLabel: 'الختمة الثانية',
    badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-300/80 shadow-xs'
  },
  { 
    value: 3, 
    label: 'الختمة الثالثة (أتم ٣ ختمات)', 
    shortLabel: 'الختمة الثالثة',
    badgeClass: 'bg-teal-50 text-teal-900 border-teal-300/80 shadow-xs'
  },
  { 
    value: 4, 
    label: 'الختمة الرابعة (أتم ٤ ختمات)', 
    shortLabel: 'الختمة الرابعة',
    badgeClass: 'bg-sky-50 text-sky-900 border-sky-300/80 shadow-xs'
  },
  { 
    value: 5, 
    label: 'الختمة الخامسة فأكثر', 
    shortLabel: 'الختمة الخامسة+',
    badgeClass: 'bg-purple-50 text-purple-900 border-purple-300/80 shadow-xs'
  },
];

export function getKhatmahLabel(count?: number | null): string {
  const c = Math.max(1, Number(count) || 1);
  if (c === 1) return 'الختمة الأولى';
  if (c === 2) return 'الختمة الثانية';
  if (c === 3) return 'الختمة الثالثة';
  if (c === 4) return 'الختمة الرابعة';
  if (c === 5) return 'الختمة الخامسة';
  return `الختمة ${c}`;
}

export function getKhatmahBadgeClass(count?: number | null): string {
  const c = Math.max(1, Number(count) || 1);
  const found = KHATMAH_PRESETS.find((p) => p.value === c);
  if (found) return found.badgeClass;
  return 'bg-amber-50 text-amber-900 border-amber-300/80 shadow-xs';
}
