import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Search, 
  ChevronLeft, 
  X, 
  Users, 
  UserPlus, 
  User, 
  BookOpen, 
  Layers, 
  MessageSquare,
  Printer,
  Crown,
  Bookmark,
  UserCheck
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { SurahSelector } from '../components/ui/surah-selector';
import api from '../utils/api';
import { formatPart } from '../utils/formatPart';
import { QURAN_STAGES, getQuranStage } from '../utils/quranStages';
import { getKhatmahLabel } from '../utils/khatmahUtils';
import SheikhsSupervisionTab from '../components/SheikhsSupervisionTab';

export default function StudentsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStage = searchParams.get('stage') || 'all';
  const initialTab = searchParams.get('tab') === 'supervision' ? 'supervision' : 'directory';

  const [activeMainTab, setActiveMainTab] = useState<'directory' | 'supervision'>(initialTab);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [stageFilter, setStageFilter] = useState(initialStage);
  const [sheikhFilter, setSheikhFilter] = useState('all');
  const [khatmahCycleFilter, setKhatmahCycleFilter] = useState<'all' | '1' | '2' | '3' | '4plus'>('all');

  // Sync with searchParams when URL changes
  useEffect(() => {
    const fromUrlStage = searchParams.get('stage');
    if (fromUrlStage) {
      setStageFilter(fromUrlStage);
    }
    const fromUrlTab = searchParams.get('tab');
    if (fromUrlTab === 'supervision') {
      setActiveMainTab('supervision');
    } else if (fromUrlTab === 'directory') {
      setActiveMainTab('directory');
    }
  }, [searchParams]);

  const { data: sheikhs } = useQuery({
    queryKey: ['sheikhs'],
    queryFn: async () => {
      const res = await api.get('/sheikhs');
      return res.data;
    },
  });

  const { data: students, isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const res = await api.get('/students');
      return res.data;
    },
  });

  const handleStageChange = (newStage: string) => {
    setStageFilter(newStage);
    if (newStage !== 'khatmeen') {
      setKhatmahCycleFilter('all');
    }
    if (newStage === 'all') {
      searchParams.delete('stage');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ stage: newStage });
    }
  };

  const filtered = students?.filter((s: any) => {
    const matchesSearch = s.name.includes(search) || s.serialNumber.includes(search);
    const matchesLevel = levelFilter ? (s.currentReach && s.currentReach.includes(levelFilter)) : true;
    
    let matchesStage = true;
    if (stageFilter === 'khatmeen') {
      if (!s.isKhatim) return false;
      const count = Number(s.khatmahCount) || 1;
      if (khatmahCycleFilter === '1') matchesStage = count === 1;
      else if (khatmahCycleFilter === '2') matchesStage = count === 2;
      else if (khatmahCycleFilter === '3') matchesStage = count === 3;
      else if (khatmahCycleFilter === '4plus') matchesStage = count >= 4;
      else matchesStage = true;
    } else if (stageFilter !== 'all') {
      const studentStage = getQuranStage(s.currentReach);
      matchesStage = studentStage === stageFilter;
    }

    let matchesSheikh = true;
    if (sheikhFilter === 'unassigned') {
      matchesSheikh = !s.sheikhId;
    } else if (sheikhFilter !== 'all') {
      matchesSheikh = s.sheikhId === Number(sheikhFilter);
    }

    return matchesSearch && matchesLevel && matchesStage && matchesSheikh;
  });

  const openWhatsapp = (student: any) => {
    if (!student.guardianPhone) return;
    const cleanPhone = student.guardianPhone.replace(/\D/g, '');
    const text = `السلام عليكم ورحمة الله وبركاته،\nتحية طيبة من إدارة حلقات تحفيظ القرآن الكريم بخصوص الطالب/ة: *${student.name}*.`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
      {/* Top Segmented Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveMainTab('directory');
              searchParams.delete('tab');
              setSearchParams(searchParams);
            }}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-xs transition-all cursor-pointer ${
              activeMainTab === 'directory'
                ? 'bg-gradient-to-r from-emerald-800 to-teal-900 text-white shadow-md shadow-emerald-900/15'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80 shadow-2xs'
            }`}
          >
            <Users size={16} />
            <span>دليل الطلاب العام والمراحل</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeMainTab === 'directory' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {students?.length || 0}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveMainTab('supervision');
              setSearchParams({ tab: 'supervision' });
            }}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-xs transition-all cursor-pointer ${
              activeMainTab === 'supervision'
                ? 'bg-gradient-to-r from-indigo-700 to-slate-800 text-white shadow-md shadow-indigo-900/20'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80 shadow-2xs'
            }`}
          >
            <UserCheck size={16} />
            <span>متابعة وإشراف المشايخ</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeMainTab === 'supervision' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-800 border border-indigo-200/60'
            }`}>
              توزيع ومتابعة إنجاز
            </span>
          </button>
        </div>

        <Link
          to="/register"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md shadow-emerald-700/20 transition-all active:scale-95 whitespace-nowrap"
        >
          <UserPlus size={15} />
          <span>تسجيل طالب جديد</span>
        </Link>
      </div>

      {activeMainTab === 'supervision' ? (
        <SheikhsSupervisionTab />
      ) : (
        <>
          {/* Executive Page Header */}
          <div className="bg-white p-6 md:p-7 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center font-bold shrink-0 shadow-xs">
                <Users size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-2xl font-black text-slate-900 font-heading">دليل الطلاب الشامل</h2>
                  <span className="bg-emerald-100/90 text-emerald-900 text-xs font-black px-3 py-1 rounded-full border border-emerald-200">
                    {filtered?.length || 0} من أصل {students?.length || 0} طالب
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-0.5">إدارة بيانات الطلاب ومتابعة تقدمهم حسب المراحل القرآنية السبع</p>
              </div>
            </div>
          </div>

      {/* 7 Quran Stages Filter Section */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Layers size={14} />
            </div>
            <span className="text-xs font-black text-slate-800 font-heading">تصنيف مراحل الحفظ السبع:</span>
          </div>
          {stageFilter !== 'all' && (
            <button
              onClick={() => handleStageChange('all')}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 transition-colors"
            >
              <span>إلغاء التصفية</span>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => handleStageChange('all')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all ${
              stageFilter === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            الكل ({students?.length || 0})
          </button>

          {QURAN_STAGES.map((stg) => {
            const count = students?.filter((s: any) => getQuranStage(s.currentReach) === stg.name).length || 0;
            const isSelected = stageFilter === stg.name;
            return (
              <button
                key={stg.id}
                onClick={() => handleStageChange(stg.name)}
                className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-gradient-to-r from-emerald-800 to-teal-900 text-white shadow-md shadow-emerald-900/20'
                    : 'bg-slate-50 hover:bg-emerald-50/70 text-slate-700 border border-slate-200/80 hover:border-emerald-300'
                }`}
              >
                <span>{stg.name}</span>
                <span
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/70 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          <button
            onClick={() => handleStageChange('khatmeen')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              stageFilter === 'khatmeen'
                ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md shadow-amber-700/20'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300'
            }`}
          >
            <Crown size={14} className={stageFilter === 'khatmeen' ? 'text-amber-200' : 'text-amber-600'} />
            <span>الطلاب الخاتمون</span>
            <span
              className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                stageFilter === 'khatmeen' ? 'bg-white/20 text-white' : 'bg-amber-200/80 text-amber-900'
              }`}
            >
              {students?.filter((s: any) => s.isKhatim).length || 0}
            </span>
          </button>
        </div>

        {stageFilter === 'khatmeen' && (
          <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200/80 flex flex-wrap items-center gap-2 animate-in fade-in duration-200">
            <span className="text-xs font-bold text-amber-950 ml-1">تصفية حسب الختمة:</span>
            <button
              onClick={() => setKhatmahCycleFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                khatmahCycleFilter === 'all'
                  ? 'bg-amber-700 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-amber-100/50'
              }`}
            >
              جميع الختمات
            </button>
            <button
              onClick={() => setKhatmahCycleFilter('1')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                khatmahCycleFilter === '1'
                  ? 'bg-amber-700 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-amber-100/50'
              }`}
            >
              🥇 الختمة الأولى
            </button>
            <button
              onClick={() => setKhatmahCycleFilter('2')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                khatmahCycleFilter === '2'
                  ? 'bg-amber-700 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-amber-100/50'
              }`}
            >
              🥈 الختمة الثانية
            </button>
            <button
              onClick={() => setKhatmahCycleFilter('3')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                khatmahCycleFilter === '3'
                  ? 'bg-amber-700 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-amber-100/50'
              }`}
            >
              🥉 الختمة الثالثة
            </button>
            <button
              onClick={() => setKhatmahCycleFilter('4plus')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                khatmahCycleFilter === '4plus'
                  ? 'bg-amber-700 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-amber-100/50'
              }`}
            >
              👑 الختمة ٤ فأكثر
            </button>
          </div>
        )}
      </div>

      {/* Surah Filter, Sheikh Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col xl:flex-row items-center justify-between gap-3">
        <div className="relative w-full xl:w-[380px] z-30 flex items-center gap-2">
          <div className="flex-1">
            <SurahSelector
              value={levelFilter}
              onChange={setLevelFilter}
              placeholder="تصفية حسب السورة (اختر سورة)..."
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
          {/* Supervising Sheikh Filter */}
          <select
            value={sheikhFilter}
            onChange={(e) => setSheikhFilter(e.target.value)}
            className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 focus:bg-white outline-none cursor-pointer"
          >
            <option value="all">جميع المشايخ والمشرفين</option>
            <option value="unassigned">طلاب بدون مشرف محدد</option>
            {sheikhs?.map((sh: any) => (
              <option key={sh.id} value={sh.id.toString()}>
                {sh.name} ({sh.role || 'محفظ'})
              </option>
            ))}
          </select>

          <div className="relative w-full sm:w-64">
            <Search className="absolute right-3.5 top-3 text-slate-400" size={18} />
            <Input
              className="pr-10 w-full rounded-2xl h-11 bg-slate-50 border-slate-200 text-sm focus:bg-white"
              placeholder="بحث باسم الطالب أو الرقم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto min-h-[380px]">
          <table className="w-full text-right">
            <thead className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 text-xs font-bold">
              <tr>
                <th className="py-4 px-6">الطالب</th>
                <th className="py-4 px-6">الرقم المتسلسل</th>
                <th className="py-4 px-6">الشيخ المشرف</th>
                <th className="py-4 px-6">المرحلة القرآنية</th>
                <th className="py-4 px-6">آخر موضع محفوظ</th>
                <th className="py-4 px-6">ولي الأمر</th>
                <th className="py-4 px-6 text-center">تواصل واتساب</th>
                <th className="py-4 px-6 text-left w-24">الملف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 text-sm">
                    جاري تحميل دليل الطلاب...
                  </td>
                </tr>
              )}

              {filtered?.map((student: any) => {
                const stage = getQuranStage(student.currentReach);

                const parseReach = (reach: string | null) => {
                  if (!reach) return { surah: '-', part: '-' };
                  if (reach.includes('|')) {
                    const snippet = reach.split('|')[1].trim();
                    const surah = snippet.split('(')[0].replace('سورة', '').trim();
                    const part = snippet.includes('(') ? '(' + snippet.split('(')[1] : '-';
                    return { surah, part };
                  }
                  if (reach.includes('سورة') && reach.includes('(') && reach.includes('-')) {
                    const surah = reach.substring(reach.indexOf('سورة'), reach.indexOf('-')).replace('سورة', '').trim();
                    const part = reach.substring(reach.indexOf('(')).trim();
                    return { surah, part };
                  }
                  return { surah: '-', part: reach };
                };

                const reachInfo = parseReach(student.currentReach);

                return (
                  <tr key={student.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-900 flex items-center justify-center font-bold text-sm border border-emerald-200/60 shadow-2xs">
                          {student.name.charAt(0) || 'ط'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/students/${student.id}`}
                              className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors text-sm font-heading"
                            >
                              {student.name}
                            </Link>
                            {student.isKhatim && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black bg-gradient-to-r from-amber-500 to-amber-600 text-white px-2 py-0.5 rounded-md shadow-2xs">
                                <Crown size={10} className="text-amber-100" />
                                <span>خاتم ({getKhatmahLabel(student.khatmahCount)})</span>
                              </span>
                            )}
                          </div>
                          {student.startReach && (
                            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                              <Bookmark size={9} className="text-amber-600" />
                              <span>البداية: {formatPart(student.startReach)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6 text-xs font-mono font-bold text-slate-600">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80">
                        {student.serialNumber}
                      </span>
                    </td>

                    {/* Supervising Sheikh */}
                    <td className="py-4 px-6 text-xs">
                      {student.sheikh ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-200/70 font-bold whitespace-nowrap">
                          <UserCheck size={12} className="text-indigo-700" />
                          <span>{student.sheikh.name}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium text-xs">غير مسند</span>
                      )}
                    </td>

                    {/* Stage Badge */}
                    <td className="py-4 px-6 text-xs">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                        {stage}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-xs">
                      {reachInfo.surah !== '-' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-slate-700 bg-slate-100/90 px-3 py-1 rounded-xl border border-slate-200/60">
                          <BookOpen size={13} className="text-emerald-700" />
                          <span>سورة {reachInfo.surah}</span>
                          {reachInfo.part !== '-' && <span className="text-slate-400 font-normal">{reachInfo.part}</span>}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">{reachInfo.part}</span>
                      )}
                    </td>

                    <td className="py-4 px-6 text-xs text-slate-600 font-medium">
                      <div className="flex items-center gap-1.5">
                        <User size={13} className="text-slate-400" />
                        <span>{student.guardianName || 'غير مسجل'}</span>
                      </div>
                    </td>

                    <td className="py-4 px-6 text-center">
                      {student.guardianPhone ? (
                        <button
                          onClick={() => openWhatsapp(student)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200 transition-colors shadow-2xs"
                          title="مراسلة ولي الأمر عبر الواتساب"
                        >
                          <MessageSquare size={13} />
                          <span dir="ltr" className="font-mono text-[11px]">{student.guardianPhone}</span>
                        </button>
                      ) : (
                        <span className="text-slate-300 text-xs">-</span>
                      )}
                    </td>

                    <td className="py-4 px-6 text-left">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/students/${student.id}/report`}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 hover:text-white hover:bg-teal-700 hover:border-teal-700 transition-all shadow-2xs"
                          title="طباعة تقرير المتابعة لولي الأمر"
                        >
                          <Printer size={15} />
                        </Link>
                        <Link
                          to={`/students/${student.id}`}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 transition-all shadow-2xs"
                          title="عرض الملف الكامل"
                        >
                          <ChevronLeft size={18} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered?.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 text-sm">
                    لا يوجد طلاب يطابقون خيارات التصفية المحددة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
