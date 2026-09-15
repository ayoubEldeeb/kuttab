export const QURAN_STAGES = [
  { id: 'amma', name: 'جزء عمّ', range: 'سورة النبأ - سورة الناس (الجزء 30)' },
  { id: 'tabarak', name: 'جزء تبارك', range: 'سورة الملك - سورة المرسلات (الجزء 29)' },
  { id: 'qadsamaa', name: 'جزء قد سمع', range: 'سورة المجادلة - سورة التحريم (الجزء 28)' },
  { id: 'yasin', name: 'ربع ياسين', range: 'سورة يس / الأحزاب - سورة الحديد (الأجزاء 22-27)' },
  { id: 'maryam', name: 'ربع مريم', range: 'سورة مريم - سورة السجدة (الأجزاء 16-21)' },
  { id: 'aaraf', name: 'ربع الأعراف', range: 'سورة الأعراف - سورة الكهف (الأجزاء 9-15)' },
  { id: 'baqarah', name: 'ربع البقرة', range: 'سورة الفاتحة - سورة الأنعام (الأجزاء 1-8)' },
] as const;

export type QuranStageName = typeof QURAN_STAGES[number]['name'];

export function getQuranStage(reach: string | null | undefined): string {
  if (!reach || reach.trim() === '' || reach === '-' || reach === 'لم يحدد' || reach === 'لم يحدد بعد' || reach === 'لم يحدد المستوى') {
    return 'غير محدد';
  }

  // 1. Match by Juz number (e.g. "الجزء 30", "الجزء 4")
  const juzMatch = reach.match(/الجزء\s*(\d+)/);
  if (juzMatch) {
    const juz = parseInt(juzMatch[1], 10);
    if (juz === 30) return 'جزء عمّ';
    if (juz === 29) return 'جزء تبارك';
    if (juz === 28) return 'جزء قد سمع';
    if (juz >= 22 && juz <= 27) return 'ربع ياسين';
    if (juz >= 16 && juz <= 21) return 'ربع مريم';
    if (juz >= 9 && juz <= 15) return 'ربع الأعراف';
    if (juz >= 1 && juz <= 8) return 'ربع البقرة';
  }

  const normalized = reach.replace(/[ًٌٍَُِّْٰٓ]/g, '');

  // جزء عمّ (78 - 114)
  const ammaSurahs = [
    'النبأ', 'النازعات', 'عبس', 'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج',
    'الطارق', 'الأعلى', 'الغاشية', 'الفجر', 'البلد', 'الشمس', 'الليل', 'الضحى', 'الشرح',
    'التين', 'العلق', 'القدر', 'البينة', 'الزلزلة', 'العاديات', 'القارعة', 'التكاثر',
    'العصر', 'الهمزة', 'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر', 'المسد',
    'الإخلاص', 'الفلق', 'الناس', 'عم'
  ];
  if (ammaSurahs.some(s => normalized.includes(s.replace(/[ًٌٍَُِّْٰٓ]/g, '')))) return 'جزء عمّ';

  // جزء تبارك (67 - 77)
  const tabarakSurahs = [
    'الملك', 'القلم', 'الحاقة', 'المعارج', 'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات', 'تبارك'
  ];
  if (tabarakSurahs.some(s => normalized.includes(s.replace(/[ًٌٍَُِّْٰٓ]/g, '')))) return 'جزء تبارك';

  // جزء قد سمع (58 - 66)
  const qadSamaaSurahs = [
    'المجادلة', 'الحشر', 'الممتحنة', 'الصف', 'الجمعة', 'المنافقون', 'الطلاق', 'التحريم', 'قد سمع'
  ];
  if (qadSamaaSurahs.some(s => normalized.includes(s.replace(/[ًٌٍَُِّْٰٓ]/g, '')))) return 'جزء قد سمع';

  // ربع ياسين (33 - 57)
  const yasinSurahs = [
    'يس', 'ياسين', 'الأحزاب', 'سبأ', 'فاطر', 'الصافات', 'ص', 'الزمر', 'غافر', 'فصلت',
    'الشورى', 'الزخرف', 'الدخان', 'الجاثية', 'الأحقاف', 'محمد', 'الفتح', 'الحجرات', 'ق',
    'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة', 'الحديد'
  ];
  if (yasinSurahs.some(s => normalized.includes(s.replace(/[ًٌٍَُِّْٰٓ]/g, '')))) return 'ربع ياسين';

  // ربع مريم (19 - 32)
  const maryamSurahs = [
    'مريم', 'طه', 'الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء', 'النمل', 'القصص', 'العنكبوت', 'الروم', 'لقمان', 'السجدة'
  ];
  if (maryamSurahs.some(s => normalized.includes(s.replace(/[ًٌٍَُِّْٰٓ]/g, '')))) return 'ربع مريم';

  // ربع الأعراف (7 - 18)
  const aarafSurahs = [
    'الأعراف', 'الأنفال', 'التوبة', 'يونس', 'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل', 'الإسراء', 'الكهف'
  ];
  if (aarafSurahs.some(s => normalized.includes(s.replace(/[ًٌٍَُِّْٰٓ]/g, '')))) return 'ربع الأعراف';

  // ربع البقرة (1 - 6)
  const baqarahSurahs = [
    'الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام'
  ];
  if (baqarahSurahs.some(s => normalized.includes(s.replace(/[ًٌٍَُِّْٰٓ]/g, '')))) return 'ربع البقرة';

  return 'غير محدد';
}
