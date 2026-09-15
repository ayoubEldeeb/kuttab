import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, X, BookOpen } from 'lucide-react';
import { SURAHS } from './quran-selector';

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export function SurahSelector({
  value,
  onChange,
  placeholder = 'تصفية حسب السورة...',
  className = '',
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizeArabic = (text: string) => {
    return text
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
      .replace(/ٱ/g, 'ا')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/ـ/g, '')
      .trim();
  };

  const filteredSurahs = useMemo(() => {
    if (!search.trim()) return SURAHS;
    const normSearch = normalizeArabic(search);
    return SURAHS.filter((s) => normalizeArabic(s).includes(normSearch));
  }, [search]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        className={`flex h-11 w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm transition-all cursor-pointer hover:bg-white hover:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-600/30 focus-within:border-emerald-600 focus-within:bg-white ${
          value ? 'border-emerald-300 bg-emerald-50/40 text-emerald-950 font-bold' : 'text-slate-600'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <BookOpen size={15} className={value ? 'text-emerald-700 shrink-0' : 'text-slate-400 shrink-0'} />
          <span className="truncate">
            {value ? `سورة ${value}` : placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setSearch('');
              }}
              className="p-1 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors"
              title="إلغاء تصفية السورة"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-emerald-700' : ''}`}
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-72 w-full min-w-[240px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 animate-in fade-in zoom-in-95 duration-150">
          {/* Search bar inside dropdown */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80">
            <input
              type="text"
              className="w-full bg-white rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              placeholder="اكتب اسم السورة للبحث..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {/* All / Clear option */}
            <div
              className={`flex cursor-pointer items-center justify-between px-4 py-2.5 text-xs transition-colors hover:bg-slate-100 ${
                !value ? 'bg-emerald-50 text-emerald-800 font-bold' : 'text-slate-700'
              }`}
              onClick={() => {
                onChange('');
                setIsOpen(false);
                setSearch('');
              }}
            >
              <span>جميع السور (إلغاء التصفية)</span>
              {!value && <Check size={14} className="text-emerald-700" />}
            </div>

            {filteredSurahs.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">لا توجد سورة بهذا الاسم</div>
            ) : (
              filteredSurahs.map((surah, idx) => (
                <div
                  key={surah}
                  className={`flex cursor-pointer items-center justify-between px-4 py-2.5 text-xs transition-colors hover:bg-emerald-50/70 hover:text-emerald-900 ${
                    value === surah ? 'bg-emerald-100/70 text-emerald-950 font-bold' : 'text-slate-700'
                  }`}
                  onClick={() => {
                    onChange(surah);
                    setIsOpen(false);
                    setSearch('');
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-400 w-5">
                      {idx + 1}.
                    </span>
                    <span>سورة {surah}</span>
                  </div>
                  {value === surah && <Check size={14} className="text-emerald-700" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
