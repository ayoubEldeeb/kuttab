import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, BookOpen } from 'lucide-react';
import { QUARTERS, ATHMAN } from './quran-data';

export const SURAHS = [
  "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", 
  "التوبة", "يونس", "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", 
  "الكهف", "مريم", "طه", "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", 
  "النمل", "القصص", "العنكبوت", "الروم", "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", 
  "يس", "الصافات", "ص", "الزمر", "غافر", "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", 
  "الأحقاف", "محمد", "الفتح", "الحجرات", "ق", "الذاريات", "الطور", "النجم", "القمر", 
  "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة", "الصف", "الجمعة", 
  "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج", 
  "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", 
  "عبس", "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", 
  "الغاشية", "الفجر", "البلد", "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", 
  "القدر", "البينة", "الزلزلة", "العاديات", "القارعة", "التكاثر", "العصر", "الهمزة", 
  "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر", "المسد", "الإخلاص", "الفلق", 
  "الناس"
];

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export function QuranSelector({ value, onChange, placeholder = "اختر السورة...", className = "" }: Props) {
  const [isOpenSurah, setIsOpenSurah] = useState(false);
  const [isOpenPart, setIsOpenPart] = useState(false);
  const [searchSurah, setSearchSurah] = useState('');
  const [searchPart, setSearchPart] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract current surah from value if it exists
  const currentSurah = useMemo(() => {
    if (!value) return '';
    if (value.startsWith('سورة ')) return value.replace('سورة ', '');
    if (value.startsWith('بداية سورة ')) return value.replace('بداية سورة ', '');
    const pipeMatch = value.match(/\| سورة ([^\(]+)/);
    if (pipeMatch) return pipeMatch[1].trim();
    const oldMatch = value.match(/\((.*?)\)/);
    return oldMatch ? oldMatch[1].trim() : '';
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpenSurah(false);
        setIsOpenPart(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const normalizeArabic = (text: string) => {
    return text
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '') // Remove harakat
      .replace(/ٱ/g, 'ا') // Alef wasla
      .replace(/[أإآ]/g, 'ا') // Normalize alefs
      .replace(/ة/g, 'ه') // Taa marbouta
      .replace(/ى/g, 'ي'); // Yaa
  };

  const filteredSurahs = SURAHS.filter(s => normalizeArabic(s).includes(normalizeArabic(searchSurah)));
  
  const availableParts = useMemo(() => {
    if (!currentSurah) return [];
    const all = [
      `بداية سورة ${currentSurah}`,
      ...QUARTERS.filter(q => q.includes(`سورة ${currentSurah} (`)),
      ...ATHMAN.filter(a => a.includes(`سورة ${currentSurah} (`))
    ];
    if (!searchPart) return all;
    
    const searchNormalized = normalizeArabic(searchPart);
    return all.filter(p => normalizeArabic(p).includes(searchNormalized));
  }, [currentSurah, searchPart]);

  // Compute what to display when not searching
  const displayValue = useMemo(() => {
    if (!value) return '';
    if (value.includes('|')) return value.replace(/ \| سورة [^\(]+/, '').trim();
    if (value.includes('-')) return value.split('(')[0].trim();
    return value.startsWith('بداية') ? value : 'بداية السورة';
  }, [value]);

  return (
    <div className={`relative flex flex-col sm:flex-row gap-2 ${className}`} ref={containerRef}>
      {/* Surah Selector */}
      <div className="relative flex-1">
        <div 
          className="flex h-12 w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent cursor-text transition-all"
          onClick={() => {
            setIsOpenSurah(true);
            setIsOpenPart(false);
          }}
        >
          <input
            type="text"
            className="w-full bg-transparent outline-none placeholder:text-gray-400"
            placeholder={currentSurah ? `سورة ${currentSurah}` : placeholder}
            value={isOpenSurah ? searchSurah : (currentSurah ? `سورة ${currentSurah}` : '')}
            onChange={(e) => {
              setSearchSurah(e.target.value);
              setIsOpenSurah(true);
            }}
            onFocus={() => {
              setIsOpenSurah(true);
              setIsOpenPart(false);
            }}
          />
          <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpenSurah ? 'rotate-180' : ''}`} />
        </div>

        {isOpenSurah && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-gray-100 bg-white py-1 shadow-lg shadow-black/5 animate-in fade-in zoom-in-95 duration-200">
            {filteredSurahs.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500">لا توجد سورة بهذا الاسم</div>
            ) : (
              filteredSurahs.map((surah) => (
                <div
                  key={surah}
                  className={`relative flex cursor-pointer select-none items-center px-4 py-2.5 text-sm hover:bg-primary/5 hover:text-primary transition-colors ${
                    currentSurah === surah ? 'bg-primary/10 text-primary font-bold' : 'text-gray-700'
                  }`}
                  onClick={() => {
                    onChange(`بداية سورة ${surah}`);
                    setSearchSurah('');
                    setIsOpenSurah(false);
                    setTimeout(() => setIsOpenPart(true), 100);
                  }}
                >
                  <span className="flex-1">سورة {surah}</span>
                  {currentSurah === surah && <Check size={16} className="text-primary" />}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Part (Thumn/Quarter) Selector */}
      <div className="relative flex-1">
        <div 
          className={`flex h-12 w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm transition-all focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent ${!currentSurah ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-text hover:border-gray-300'} ${isOpenPart ? 'ring-2 ring-primary border-transparent' : ''}`}
          onClick={() => {
            if (currentSurah) {
              setIsOpenPart(true);
              setIsOpenSurah(false);
            }
          }}
        >
          <input
            type="text"
            className="w-full bg-transparent outline-none placeholder:text-gray-400"
            placeholder={!currentSurah ? 'اختر السورة أولاً...' : 'ابحث عن الربع أو الثمن...'}
            value={isOpenPart ? searchPart : displayValue}
            disabled={!currentSurah}
            onChange={(e) => {
              setSearchPart(e.target.value);
              setIsOpenPart(true);
            }}
            onFocus={() => {
              if (currentSurah) {
                setIsOpenPart(true);
                setIsOpenSurah(false);
              }
            }}
          />
          <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpenPart ? 'rotate-180' : ''}`} />
        </div>

        {isOpenPart && currentSurah && (
          <div className="absolute z-50 mt-1 max-h-60 w-[150%] sm:w-full sm:min-w-[300px] left-0 sm:right-0 overflow-auto rounded-xl border border-gray-100 bg-white py-1 shadow-lg shadow-black/5 animate-in fade-in zoom-in-95 duration-200">
            {availableParts.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500">لا توجد نتائج تطابق بحثك</div>
            ) : (
              availableParts.map((part) => (
                <div
                  key={part}
                  className={`relative flex cursor-pointer select-none items-center px-4 py-2.5 text-sm hover:bg-primary/5 hover:text-primary transition-colors ${
                    value === part ? 'bg-primary/10 text-primary font-bold' : 'text-gray-700'
                  }`}
                  onClick={() => {
                    onChange(part);
                    setSearchPart('');
                    setIsOpenPart(false);
                  }}
                >
                  <span className="flex-1">{part.replace(` | سورة ${currentSurah}`, '')}</span>
                  {value === part && <Check size={16} className="text-primary" />}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
