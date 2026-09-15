import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, X, BookOpen, Eye, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { ATHMAN } from './quran-data';
import { 
  normalizeArabic, 
  convertArabicToEnglishNumbers, 
  parseQuranPart, 
  isPartMatch 
} from '../../utils/quranHelpers';

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
  const [showFullModal, setShowFullModal] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedPartRef = useRef<HTMLDivElement>(null);
  const selectedSurahRef = useRef<HTMLDivElement>(null);

  // Extract current surah from value if it exists
  const currentSurah = useMemo(() => {
    if (!value) return '';
    let surahStr = '';
    if (value.startsWith('سورة ')) surahStr = value.replace('سورة ', '').trim();
    else if (value.startsWith('بداية سورة ')) surahStr = value.replace('بداية سورة ', '').trim();
    else {
      const pipeMatch = value.match(/\| سورة ([^\(]+)/);
      if (pipeMatch) surahStr = pipeMatch[1].trim();
      else {
        const parsed = parseQuranPart(value);
        if (parsed.surah) surahStr = parsed.surah.replace('سورة ', '').trim();
        else {
          const oldMatch = value.match(/\((.*?)\)/);
          surahStr = oldMatch ? oldMatch[1].trim() : '';
        }
      }
    }
    return surahStr.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '').trim();
  }, [value]);

  const partDetails = useMemo(() => {
    return parseQuranPart(value);
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

  // Auto-scroll to selected item in part dropdown
  useEffect(() => {
    if (isOpenPart && selectedPartRef.current) {
      selectedPartRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isOpenPart]);

  // Auto-scroll to selected item in surah dropdown
  useEffect(() => {
    if (isOpenSurah && selectedSurahRef.current) {
      selectedSurahRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isOpenSurah]);

  const filteredSurahs = useMemo(() => {
    const term = normalizeArabic(searchSurah);
    if (!term) return SURAHS;
    return SURAHS.filter(s => normalizeArabic(s).includes(term));
  }, [searchSurah]);
  
  const availableParts = useMemo(() => {
    if (!currentSurah) return [];
    
    const normalizedTarget = normalizeArabic(currentSurah);
    
    const all = [
      `بداية سورة ${currentSurah}`,
      ...ATHMAN.filter(a => {
        const surahPart = a.match(/\| سورة ([^\(]+)/)?.[1]?.trim() || '';
        return normalizeArabic(surahPart) === normalizedTarget;
      })
    ];
    
    if (!searchPart) return all;
    
    const searchNormalized = normalizeArabic(searchPart);
    return all.filter(p => normalizeArabic(p).includes(searchNormalized));
  }, [currentSurah, searchPart]);

  // Compute clean compact title to display inside the input trigger
  const displayValue = useMemo(() => {
    if (!value) return '';
    if (value.includes('|')) return value.replace(/ \| سورة [^\(]+/, '').trim();
    if (value.includes('-')) return value.split('(')[0].trim();
    return value.startsWith('بداية') ? value : 'بداية السورة';
  }, [value]);

  const handleCopyText = () => {
    if (partDetails.fullDisplay) {
      navigator.clipboard.writeText(partDetails.fullDisplay);
      toast.success('تم نسخ النص القرآني كاملاً');
    }
  };

  return (
    <div className={`relative flex flex-col gap-1.5 ${className}`} ref={containerRef}>
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Surah Selector Trigger */}
        <div className="relative flex-1">
          <div 
            className={`flex h-11 w-full items-center justify-between rounded-xl border px-3 py-2 text-sm cursor-text transition-all ${
              currentSurah
                ? 'border-emerald-400 bg-emerald-50/50 text-emerald-950 font-bold shadow-xs'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            } ${isOpenSurah ? 'ring-2 ring-emerald-600/30 border-emerald-600' : ''}`}
            onClick={() => {
              setIsOpenSurah(true);
              setIsOpenPart(false);
            }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <BookOpen size={14} className={currentSurah ? 'text-emerald-700 shrink-0' : 'text-slate-400 shrink-0'} />
              <input
                type="text"
                className="w-full bg-transparent outline-none placeholder:text-slate-400 placeholder:font-normal text-xs sm:text-sm truncate"
                placeholder={currentSurah ? `سورة ${currentSurah}` : placeholder}
                value={isOpenSurah ? searchSurah : (currentSurah ? `سورة ${currentSurah}` : '')}
                onChange={(e) => {
                  setSearchSurah(convertArabicToEnglishNumbers(e.target.value));
                  setIsOpenSurah(true);
                }}
                onFocus={() => {
                  setIsOpenSurah(true);
                  setIsOpenPart(false);
                }}
              />
            </div>

            <div className="flex items-center gap-1 shrink-0 mr-1">
              {currentSurah && !isOpenSurah && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange('');
                    setSearchSurah('');
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="مسح اختيار السورة"
                >
                  <X size={13} />
                </button>
              )}
              <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpenSurah ? 'rotate-180 text-emerald-700' : ''}`} />
            </div>
          </div>

          {/* Surah Dropdown Popover */}
          {isOpenSurah && (
            <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-2xl border border-slate-200 bg-white py-1.5 shadow-xl shadow-slate-900/10 animate-in fade-in zoom-in-95 duration-150">
              {filteredSurahs.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 font-medium">لا توجد سورة بهذا الاسم</div>
              ) : (
                filteredSurahs.map((surah) => {
                  const isSelected = currentSurah === surah;
                  return (
                    <div
                      key={surah}
                      ref={isSelected ? selectedSurahRef : null}
                      className={`relative flex cursor-pointer select-none items-center justify-between px-3.5 py-2 text-xs sm:text-sm transition-colors mx-1 rounded-xl ${
                        isSelected 
                          ? 'bg-emerald-100 text-emerald-950 font-bold border-r-4 border-emerald-600 shadow-2xs' 
                          : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-900'
                      }`}
                      onClick={() => {
                        onChange(`بداية سورة ${surah}`);
                        setSearchSurah('');
                        setIsOpenSurah(false);
                        setTimeout(() => setIsOpenPart(true), 100);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen size={13} className={isSelected ? 'text-emerald-700' : 'text-slate-400'} />
                        <span>سورة {surah}</span>
                      </div>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Check size={11} className="stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Part (Thumn/Quarter) Selector Trigger */}
        <div className="relative flex-1">
          <div 
            className={`flex h-11 w-full items-center justify-between rounded-xl border px-3 py-2 text-sm transition-all ${
              !currentSurah 
                ? 'opacity-60 cursor-not-allowed bg-slate-50 border-slate-200' 
                : value
                  ? 'border-emerald-400 bg-emerald-50/50 text-emerald-950 font-bold shadow-xs cursor-text'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 cursor-text'
            } ${isOpenPart ? 'ring-2 ring-emerald-600/30 border-emerald-600' : ''}`}
            title={partDetails.fullDisplay || displayValue}
            onClick={() => {
              if (currentSurah) {
                setIsOpenPart(true);
                setIsOpenSurah(false);
              }
            }}
          >
            <input
              type="text"
              className="w-full bg-transparent outline-none placeholder:text-slate-400 placeholder:font-normal text-xs sm:text-sm truncate"
              placeholder={!currentSurah ? 'اختر السورة أولاً...' : 'ابحث عن الربع أو الثمن...'}
              value={isOpenPart ? searchPart : displayValue}
              disabled={!currentSurah}
              onChange={(e) => {
                setSearchPart(convertArabicToEnglishNumbers(e.target.value));
                setIsOpenPart(true);
              }}
              onFocus={() => {
                if (currentSurah) {
                  setIsOpenPart(true);
                  setIsOpenSurah(false);
                }
              }}
            />

            <div className="flex items-center gap-1 shrink-0 mr-1">
              {value && !isOpenPart && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange('');
                    setSearchPart('');
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="مسح اختيار الثمن"
                >
                  <X size={13} />
                </button>
              )}
              <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpenPart ? 'rotate-180 text-emerald-700' : ''}`} />
            </div>
          </div>

          {/* Part Dropdown Popover */}
          {isOpenPart && currentSurah && (
            <div className="absolute z-50 mt-1 max-h-72 w-[160%] sm:w-full sm:min-w-[340px] left-0 sm:right-0 overflow-auto rounded-2xl border border-slate-200 bg-white py-1.5 shadow-xl shadow-slate-900/10 animate-in fade-in zoom-in-95 duration-150">
              {availableParts.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 font-medium">لا توجد نتائج تطابق بحثك</div>
              ) : (
                availableParts.map((part) => {
                  const isSelected = isPartMatch(part, value);
                  const parsed = parseQuranPart(part);
                  
                  return (
                    <div
                      key={part}
                      ref={isSelected ? selectedPartRef : null}
                      className={`relative flex cursor-pointer select-none items-start gap-2.5 px-3.5 py-2.5 text-xs sm:text-sm transition-all mx-1 my-0.5 rounded-xl ${
                        isSelected 
                          ? 'bg-emerald-100 text-emerald-950 font-bold border-r-4 border-emerald-600 shadow-2xs' 
                          : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-900'
                      }`}
                      onClick={() => {
                        onChange(part);
                        setSearchPart('');
                        setIsOpenPart(false);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 text-xs">
                          {parsed.position || part.replace(` | سورة ${currentSurah}`, '')}
                        </div>
                        {parsed.ayah && (
                          <div className="text-[11px] text-emerald-800/90 font-medium mt-0.5 break-words leading-snug">
                            «{parsed.ayah}»
                          </div>
                        )}
                      </div>

                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                          <Check size={11} className="stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dedicated Full Text Preview Bar when a choice is selected */}
      {value && (
        <div className="p-2.5 rounded-xl bg-gradient-to-l from-emerald-50/90 to-teal-50/90 border border-emerald-200/90 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            <BookOpen size={14} className="text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="font-bold text-emerald-800 shrink-0">الموضع المختار:</span>
              <span className="font-semibold text-slate-800 break-words">{partDetails.position}</span>
              {partDetails.ayah && (
                <span className="inline-block bg-white/95 border border-emerald-300 px-2 py-0.5 rounded-lg text-emerald-900 font-bold break-words text-[11px] leading-relaxed shadow-2xs">
                  «{partDetails.ayah}»
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowFullModal(true)}
            className="self-end sm:self-auto text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-lg hover:bg-emerald-100/60 transition-colors cursor-pointer"
            title="عرض التفاصيل الكاملة للموضع"
          >
            <Eye size={12} />
            <span>عرض النص كاملاً</span>
          </button>
        </div>
      )}

      {/* Modal Popup: View Complete Details and Full Quranic Text */}
      {showFullModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <BookOpen size={16} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 font-heading">تفاصيل الموضع القرآني المختار</h3>
                  <p className="text-[11px] text-slate-400">النص القرآني الكامل والمرجع التفصيلي</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFullModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">السورة القرآنية:</span>
                  <span className="font-black text-emerald-800 text-sm">
                    {partDetails.surah || `سورة ${currentSurah}`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">الموقع في المصحف:</span>
                  <span className="font-bold text-slate-800">
                    {partDetails.position || 'بداية السورة'}
                  </span>
                </div>
              </div>

              {partDetails.ayah ? (
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                  <span className="text-[11px] font-bold text-emerald-800 block">بداية الآية الكريمة:</span>
                  <div className="text-sm font-bold text-emerald-950 font-heading leading-loose text-center bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                    «{partDetails.ayah}»
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center text-slate-500">
                  بداية السورة من الآية الأولى.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleCopyText}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Copy size={14} />
                <span>نسخ المرجع كاملاً</span>
              </button>
              <button
                type="button"
                onClick={() => setShowFullModal(false)}
                className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
