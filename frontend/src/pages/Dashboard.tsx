import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Users, 
  CalendarClock, 
  BookOpen, 
  Repeat, 
  UserPlus, 
  Award, 
  Clock, 
  ChevronLeft, 
  Search,
  TrendingUp,
  AlertCircle,
  Filter,
  X,
  Send,
  Crown,
  Sparkles,
  Bookmark,
  Edit2
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { formatPart } from '../utils/formatPart';
import { QURAN_STAGES, getQuranStage } from '../utils/quranStages';
import { KHATMAH_PRESETS, getKhatmahLabel, getKhatmahBadgeClass } from '../utils/khatmahUtils';

interface DashboardStats {
  totalStudents: number;
  khatmeenStats?: {
    totalCount: number;
    percentage: number;
    breakdown: {
      first: number;
      second: number;
      third: number;
      fourthPlus: number;
    };
    students: Array<{
      id: number;
      name: string;
      serialNumber: string;
      currentReach: string | null;
      startReach: string | null;
      isKhatim: boolean;
      khatmahCount: number;
      guardianPhone?: string | null;
      guardianName?: string | null;
    }>;
  };
  today: {
    recordedCount: number;
    attendedCount: number;
    absentCount: number;
    memorizedCount: number;
    writtenCount: number;
    needsRevisionCount: number;
    attendanceRate: number;
    completionRate: number;
    isHoliday?: boolean;
  };
  weeklyTrend: Array<{
    date: string;
    dayName: string;
    attended: number;
    absent: number;
    memorized: number;
    isHoliday?: boolean;
  }>;
  quranLevels: Array<{
    level: string;
    count: number;
  }>;
  recentActivities: Array<{
    id: number;
    studentId: number;
    studentName: string;
    studentSerial: string;
    status: string;
    type?: string;
    fromPart?: string;
    toPart?: string;
    sheikhId?: number | null;
    sheikhName?: string | null;
    date: string;
    createdAt: string;
  }>;
}

export default function Dashboard() {
  const [quickSearch, setQuickSearch] = useState('');
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [modalSelectedStage, setModalSelectedStage] = useState<string>('all');
  const [modalSurahFilter, setModalSurahFilter] = useState('');

  // Khatmeen Management State
  const [khatmahFilter, setKhatmahFilter] = useState<'all' | '1' | '2' | '3' | '4plus'>('all');
  const [khatmeenSearch, setKhatmeenSearch] = useState('');
  const [editingKhatmahStudent, setEditingKhatmahStudent] = useState<any | null>(null);
  const [editKhatmahCount, setEditKhatmahCount] = useState<number>(1);

  const queryClient = useQueryClient();

  // Fetch Dashboard Stats from backend
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await api.get('/students/dashboard/stats');
      return res.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds for live updates
  });

  // Fetch all students for quick lookup
  const { data: students } = useQuery({
    queryKey: ['students-quick'],
    queryFn: async () => {
      const res = await api.get('/students');
      return res.data;
    },
  });

  const updateKhatmahMutation = useMutation({
    mutationFn: async ({ id, khatmahCount, isKhatim }: { id: number; khatmahCount: number; isKhatim: boolean }) => {
      const res = await api.put(`/students/${id}`, { khatmahCount, isKhatim });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students-quick'] });
      toast.success('تم حفظ وتحديث بيانات الختمة بنجاح');
      setEditingKhatmahStudent(null);
    },
    onError: () => {
      toast.error('حدث خطأ أثناء تحديث حالة الختمة');
    },
  });

  const handlePromoteKhatmah = (student: any) => {
    const current = Number(student.khatmahCount) || 1;
    const nextCount = current + 1;
    updateKhatmahMutation.mutate({
      id: student.id,
      khatmahCount: nextCount,
      isKhatim: true,
    });
    toast.success(`تمت ترقية الطالب ${student.name} إلى ${getKhatmahLabel(nextCount)}! مبارك للطالب 🎉`);
  };

  const todayFormatted = new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  // Filter students for quick search popup
  const filteredStudents = quickSearch.trim()
    ? students?.filter((s: any) =>
        s.name.includes(quickSearch.trim()) || s.serialNumber.includes(quickSearch.trim())
      )?.slice(0, 5)
    : [];

  const getStatusBadge = (status: string) => {
    if (status === 'عرض وحفظ وكتب') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          عرض وحفظ وكتب
        </span>
      );
    }
    if (status === 'عرض وحفظ ولم يكتب' || status === 'حفظ') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
          حفظ فقط
        </span>
      );
    }
    if (status === 'كتب فقط') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
          كتب فقط
        </span>
      );
    }
    if (status === 'عرض ولم يحفظ' || status === 'لم يحفظ') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          بحاجة لمراجعة
        </span>
      );
    }
    if (status === 'لم يحضر') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          غائب
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
        {status}
      </span>
    );
  };

  const totalStudents = stats?.totalStudents || students?.length || 0;
  const attendedCount = stats?.today.attendedCount || 0;
  const absentCount = stats?.today.absentCount || 0;
  const memorizedCount = stats?.today.memorizedCount || 0;
  const writtenCount = stats?.today.writtenCount || 0;
  const unrecordedCount = Math.max(0, totalStudents - (attendedCount + absentCount));
  const attendanceRate = totalStudents > 0 ? Math.round((attendedCount / totalStudents) * 100) : 0;

  // Compute stats for the 7 Quranic stages
  const stageStats = QURAN_STAGES.map((stg) => {
    const backendCount = stats?.quranLevels?.find((l) => l.level === stg.name)?.count;
    const directCount = students?.filter((s: any) => getQuranStage(s.currentReach) === stg.name).length || 0;
    const count = backendCount !== undefined ? backendCount : directCount;
    const pct = totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0;
    return {
      ...stg,
      count,
      pct,
    };
  });

  const unclassifiedCount = students?.filter((s: any) => getQuranStage(s.currentReach) === 'غير محدد').length || 0;

  // Khatmeen Computed Lists
  const khatmeenStudentsList = useMemo(() => {
    if (stats?.khatmeenStats?.students && stats.khatmeenStats.students.length > 0) {
      return stats.khatmeenStats.students;
    }
    return students?.filter((s: any) => s.isKhatim) || [];
  }, [stats?.khatmeenStats?.students, students]);

  const totalKhatmeen = stats?.khatmeenStats?.totalCount ?? khatmeenStudentsList.length;

  const khatmahCounts = useMemo(() => {
    if (stats?.khatmeenStats?.breakdown) {
      return stats.khatmeenStats.breakdown;
    }
    return {
      first: khatmeenStudentsList.filter((s: any) => (s.khatmahCount || 1) === 1).length,
      second: khatmeenStudentsList.filter((s: any) => s.khatmahCount === 2).length,
      third: khatmeenStudentsList.filter((s: any) => s.khatmahCount === 3).length,
      fourthPlus: khatmeenStudentsList.filter((s: any) => (s.khatmahCount || 0) >= 4).length,
    };
  }, [stats?.khatmeenStats?.breakdown, khatmeenStudentsList]);

  const filteredKhatmeen = useMemo(() => {
    return khatmeenStudentsList.filter((s: any) => {
      const matchesSearch = !khatmeenSearch.trim() || 
        s.name.includes(khatmeenSearch.trim()) || 
        s.serialNumber.includes(khatmeenSearch.trim());

      if (!matchesSearch) return false;

      const count = Number(s.khatmahCount) || 1;
      if (khatmahFilter === 'all') return true;
      if (khatmahFilter === '1') return count === 1;
      if (khatmahFilter === '2') return count === 2;
      if (khatmahFilter === '3') return count === 3;
      if (khatmahFilter === '4plus') return count >= 4;
      return true;
    });
  }, [khatmeenStudentsList, khatmeenSearch, khatmahFilter]);

  // Filter students for the Stage & Surah Modal
  const modalFilteredStudents = students?.filter((s: any) => {
    if (modalSelectedStage === 'khatmeen') {
      return s.isKhatim;
    }
    const stageName = getQuranStage(s.currentReach);
    const matchesStage = modalSelectedStage === 'all' || stageName === modalSelectedStage;
    const matchesSurah = !modalSurahFilter.trim() || 
      (s.currentReach && s.currentReach.includes(modalSurahFilter.trim()));
    return matchesStage && matchesSurah;
  }) || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Top Welcome & Islamic Greeting Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-emerald-900 via-emerald-800 to-teal-900 text-white p-8 shadow-xl shadow-emerald-950/10 border border-emerald-700/30">
        {/* Subtle decorative geometric circles */}
        <div className="absolute -left-20 -top-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute right-0 bottom-0 w-96 h-96 rounded-full bg-teal-400/10 blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-emerald-200 text-xs font-semibold border border-white/15 shadow-2xs">
              <span>«خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ»</span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white font-heading">
              لوحة تحكم نظام كُتّاب
            </h1>
            <p className="text-emerald-100/90 text-sm md:text-base max-w-2xl leading-relaxed">
              مرحباً بك! يمكنك متابعة سير الحلقات القرآنية، ومعدلات الحضور والتسميع اليومية لطلاب المركز بكل سهولة ودقة.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15 text-center">
              <div className="text-xs text-emerald-200 font-medium">تاريخ اليوم</div>
              <div className="text-sm font-bold text-white mt-0.5">{todayFormatted}</div>
              {stats?.today?.isHoliday && (
                <div className="mt-1 inline-block bg-amber-400/20 text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-300/30">
                  عطلة أسبوعية
                </div>
              )}
            </div>
            <Link
              to="/daily-log"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold shadow-lg shadow-amber-400/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <CalendarClock size={18} />
              <span>بدء رصد اليوم</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Search & Instant Jump Bar */}
      <div className="relative">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute right-3.5 top-3 text-slate-400" size={18} />
            <input
              type="text"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="بحث سريع عن طالب (بالاسم أو الرقم)..."
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <Link
              to="/daily-log"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 transition-colors whitespace-nowrap"
            >
              <CalendarClock size={15} />
              السجل اليومي
            </Link>
            <Link
              to="/revision-log"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200/60 transition-colors whitespace-nowrap"
            >
              <Repeat size={15} />
              سجل المراجعة
            </Link>
            <Link
              to="/students"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors whitespace-nowrap"
            >
              <Users size={15} />
              دليل الطلاب
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-sm transition-colors whitespace-nowrap"
            >
              <UserPlus size={15} />
              تسجيل طالب
            </Link>
          </div>
        </div>

        {/* Quick search dropdown results */}
        {quickSearch.trim() && (
          <div className="absolute top-full mt-2 right-0 w-full md:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-2 divide-y divide-slate-100">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((s: any) => (
                  <Link
                    key={s.id}
                    to={`/students/${s.id}`}
                    onClick={() => setQuickSearch('')}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-emerald-50/70 transition-colors group"
                  >
                    <div>
                      <div className="font-bold text-slate-800 group-hover:text-emerald-700 text-sm">
                        {s.name}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {s.serialNumber} • {s.currentReach ? formatPart(s.currentReach) : 'لم يحدد'}
                      </div>
                    </div>
                    <ChevronLeft size={16} className="text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:-translate-x-1" />
                  </Link>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-400">
                  لا توجد نتائج مطابقة لـ "{quickSearch}"
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5 Core KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Card 1: Total Students */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                إجمالي الطلاب
              </span>
              <div className="text-3xl font-black text-slate-900 font-heading">
                {statsLoading ? '...' : totalStudents}
              </div>
              <p className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                <TrendingUp size={13} />
                <span>جميع الحلقات القرآنية</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-110 transition-transform">
              <Users size={24} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link to="/students" className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1">
              دليل الطلاب
              <ChevronLeft size={14} />
            </Link>
            <span className="text-slate-400">{unrecordedCount > 0 ? `${unrecordedCount} لم يرصدوا` : 'الكل مسجل'}</span>
          </div>
        </div>

        {/* Card 2: Khatmeen Students (الطلاب الخاتمون) */}
        <div className="bg-white rounded-2xl p-6 border border-amber-200/80 shadow-sm hover:shadow-md hover:border-amber-400 transition-all relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-amber-900/80 uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={12} className="text-amber-600" />
                <span>الطلاب الخاتمون</span>
              </span>
              <div className="text-3xl font-black text-amber-950 font-heading">
                {statsLoading ? '...' : totalKhatmeen}
              </div>
              <p className="text-xs text-amber-800 font-medium flex items-center gap-1">
                <Crown size={13} className="text-amber-600" />
                <span>{totalStudents > 0 ? Math.round((totalKhatmeen / totalStudents) * 100) : 0}% من إجمالي الطلاب</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center border border-amber-300 shadow-sm group-hover:scale-110 transition-transform">
              <Crown size={22} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-amber-100 flex items-center justify-between text-xs">
            <a href="#khatmeen-section" className="text-amber-800 hover:text-amber-950 font-black flex items-center gap-1">
              إدارة الخاتمين
              <ChevronLeft size={14} />
            </a>
            <span className="text-slate-500 font-mono text-[11px] font-bold">
              {khatmahCounts.first} أولى • {khatmahCounts.second} ثانية • {khatmahCounts.third + khatmahCounts.fourthPlus} ٣+
            </span>
          </div>
        </div>

        {/* Card 2: Attendance Rate */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                نسبة الحضور اليوم
              </span>
              <div className="text-3xl font-black text-slate-900 font-heading flex items-center gap-2">
                <span>{statsLoading ? '...' : `${attendanceRate}%`}</span>
                {stats?.today?.isHoliday && (
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200">
                    عطلة أسبوعية
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                حضر <strong className="text-emerald-700">{attendedCount}</strong> من أصل {totalStudents}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100 group-hover:scale-110 transition-transform">
              <CalendarClock size={24} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="text-emerald-600 font-semibold">{attendedCount} حاضر</span>
              <span className="text-rose-500 font-semibold">{absentCount} غائب</span>
            </div>
            <Link to="/daily-log" className="text-teal-700 hover:text-teal-800 font-bold">
              التفاصيل
            </Link>
          </div>
        </div>

        {/* Card 3: Memorization Completed */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                أتموا الحفظ اليوم
              </span>
              <div className="text-3xl font-black text-slate-900 font-heading">
                {statsLoading ? '...' : memorizedCount}
              </div>
              <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                <Award size={13} />
                <span>{writtenCount} أتموا الكتابة أيضاً</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 group-hover:scale-110 transition-transform">
              <BookOpen size={24} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              {stats?.today.completionRate || 0}% نسبة الإنجاز
            </span>
            <Link to="/daily-log" className="text-amber-700 hover:text-amber-800 font-bold flex items-center gap-1">
              السجل
              <ChevronLeft size={14} />
            </Link>
          </div>
        </div>

        {/* Card 4: Needs Revision / Attention */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                بحاجة لمتابعة
              </span>
              <div className="text-3xl font-black text-rose-600 font-heading">
                {statsLoading ? '...' : (absentCount + (stats?.today.needsRevisionCount || 0))}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {absentCount} غياب • {stats?.today.needsRevisionCount || 0} لم يحفظوا
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 group-hover:scale-110 transition-transform">
              <AlertCircle size={24} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-rose-600 font-bold">تنبيهات فورية</span>
            <Link to="/revision-log" className="text-rose-700 hover:text-rose-800 font-bold flex items-center gap-1">
              سجل المراجعة
              <ChevronLeft size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Visual Today's Session Progress Bar */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-800 text-base">شريط تقدم جلسة اليوم</h3>
            <p className="text-xs text-slate-400">توزيع حالات الطلاب في حلقة اليوم</p>
          </div>
          <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg w-fit">
            تم رصد {attendedCount + absentCount} من {totalStudents} طالب ({totalStudents > 0 ? Math.round(((attendedCount + absentCount) / totalStudents) * 100) : 0}%)
          </div>
        </div>

        {/* Multi-segment Progress Bar */}
        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex gap-0.5 p-0.5">
          {totalStudents > 0 ? (
            <>
              {memorizedCount > 0 && (
                <div
                  style={{ width: `${(memorizedCount / totalStudents) * 100}%` }}
                  className="h-full bg-emerald-500 rounded-sm transition-all duration-500"
                  title={`حفظ: ${memorizedCount}`}
                />
              )}
              {writtenCount > 0 && (
                <div
                  style={{ width: `${(writtenCount / totalStudents) * 100}%` }}
                  className="h-full bg-purple-500 rounded-sm transition-all duration-500"
                  title={`كتب: ${writtenCount}`}
                />
              )}
              {(stats?.today.needsRevisionCount || 0) > 0 && (
                <div
                  style={{ width: `${((stats?.today.needsRevisionCount || 0) / totalStudents) * 100}%` }}
                  className="h-full bg-amber-500 rounded-sm transition-all duration-500"
                  title={`لم يحفظ: ${stats?.today.needsRevisionCount}`}
                />
              )}
              {absentCount > 0 && (
                <div
                  style={{ width: `${(absentCount / totalStudents) * 100}%` }}
                  className="h-full bg-rose-500 rounded-sm transition-all duration-500"
                  title={`غائب: ${absentCount}`}
                />
              )}
              {unrecordedCount > 0 && (
                <div
                  style={{ width: `${(unrecordedCount / totalStudents) * 100}%` }}
                  className="h-full bg-slate-200 rounded-sm transition-all duration-500"
                  title={`لم يُرصد: ${unrecordedCount}`}
                />
              )}
            </>
          ) : (
            <div className="w-full h-full bg-slate-200 rounded-sm"></div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <span className="text-slate-600 font-medium">أتموا الحفظ ({memorizedCount})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-purple-500"></span>
            <span className="text-slate-600 font-medium">كتب فقط ({writtenCount})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span className="text-slate-600 font-medium">يحتاج مراجعة ({stats?.today.needsRevisionCount || 0})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500"></span>
            <span className="text-slate-600 font-medium">غائب ({absentCount})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-300"></span>
            <span className="text-slate-600 font-medium">لم يرصد بعد ({unrecordedCount})</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Weekly Activity + Quran Levels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Weekly Activity Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-base">نشاط الحضور والتسميع خلال الأسبوع</h3>
              <p className="text-xs text-slate-400">معدل التفاعل للأيام السبعة الماضية</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 font-semibold text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                حضور
              </span>
              <span className="flex items-center gap-1 font-semibold text-rose-600">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
                غياب
              </span>
              <span className="flex items-center gap-1 font-semibold text-amber-700">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                عطلة
              </span>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="h-56 flex items-end justify-between gap-3 pt-6 border-b border-slate-100 px-2">
            {stats?.weeklyTrend && stats.weeklyTrend.length > 0 ? (
              stats.weeklyTrend.map((day, idx) => {
                const maxVal = Math.max(
                  ...stats.weeklyTrend.map((d) => d.attended + d.absent),
                  5
                );
                const attendedHeight = (day.attended / maxVal) * 100;
                const absentHeight = (day.absent / maxVal) * 100;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                    <div className="text-[11px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      {day.attended}
                    </div>
                    <div className="w-full max-w-[40px] flex flex-col items-stretch gap-1">
                      {day.attended > 0 && (
                        <div
                          style={{ height: `${Math.max(attendedHeight * 1.5, 8)}px` }}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 rounded-t-lg transition-all"
                          title={`حضر: ${day.attended}`}
                        />
                      )}
                      {day.absent > 0 && (
                        <div
                          style={{ height: `${Math.max(absentHeight * 1.5, 6)}px` }}
                          className="w-full bg-rose-400 hover:bg-rose-300 rounded-b-lg transition-all"
                          title={`غاب: ${day.absent}`}
                        />
                      )}
                      {day.attended === 0 && day.absent === 0 && (
                        day.isHoliday ? (
                          <div 
                            className="h-7 w-full bg-amber-100/90 border border-amber-300 rounded-lg flex items-center justify-center text-[9px] font-bold text-amber-800"
                            title="عطلة أسبوعية"
                          >
                            عطلة
                          </div>
                        ) : (
                          <div className="h-2 w-full bg-slate-100 rounded-full" />
                        )
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-0.5 mt-2">
                      <span className="text-xs font-bold text-slate-600">{day.dayName}</span>
                      {day.isHoliday && (
                        <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md border border-amber-200">
                          عطلة
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                جاري تجميع بيانات الأسبوع...
              </div>
            )}
          </div>
        </div>

        {/* Quran Levels Distribution (1 col) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-base">مراحل الحفظ في المركز</h3>
              <p className="text-xs text-slate-400">توزيع الطلاب على مراحل الحفظ السبع</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <BookOpen size={18} />
            </div>
          </div>

          {/* 7 Stages List */}
          <div className="space-y-3">
            {stageStats.map((stg) => (
              <div
                key={stg.id}
                onClick={() => {
                  setModalSelectedStage(stg.name);
                  setStageModalOpen(true);
                }}
                className="p-2 -mx-2 rounded-xl hover:bg-emerald-50/50 transition-all cursor-pointer group space-y-1.5"
                title={`انقر لعرض وتصفية طلاب مرحلة ${stg.name}`}
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700 group-hover:text-emerald-700 transition-colors flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {stg.name}
                  </span>
                  <span className="text-slate-500 font-bold bg-slate-100 group-hover:bg-emerald-100 group-hover:text-emerald-800 px-2 py-0.5 rounded-md text-[11px] transition-colors">
                    {stg.count} طالب ({stg.pct}%)
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${stg.pct}%` }}
                    className="h-full bg-emerald-600 rounded-full transition-all duration-500 group-hover:bg-emerald-500"
                  />
                </div>
              </div>
            ))}

            {unclassifiedCount > 0 && (
              <div
                onClick={() => {
                  setModalSelectedStage('غير محدد');
                  setStageModalOpen(true);
                }}
                className="p-2 -mx-2 rounded-xl hover:bg-slate-50 transition-all cursor-pointer group flex justify-between items-center text-xs text-slate-400"
                title="طلاب لم يتم تحديد مستواهم بعد"
              >
                <span>غير محدد</span>
                <span className="bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">{unclassifiedCount} طالب</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100">
            <button
              onClick={() => {
                setModalSelectedStage('all');
                setStageModalOpen(true);
              }}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20 transition-all active:scale-[0.98]"
            >
              <Filter size={15} />
              <span>استعراض وتصفية الطلاب حسب المراحل والسور</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dedicated Khatmeen Management & Honor Board Section */}
      <div id="khatmeen-section" className="bg-white rounded-3xl p-6 sm:p-8 border border-amber-200/80 shadow-md shadow-amber-900/5 space-y-6 relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-amber-400/5 blur-3xl pointer-events-none"></div>

        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-amber-100/80">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center font-bold shadow-md shadow-amber-600/20 shrink-0">
              <Crown size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-heading">
                  لوحة شرف وإدارة الطلاب الخاتمين
                </h2>
                <span className="bg-amber-100 text-amber-900 text-xs font-black px-3 py-1 rounded-full border border-amber-300 shadow-2xs">
                  {totalKhatmeen} طالب خاتم ({totalStudents > 0 ? Math.round((totalKhatmeen / totalStudents) * 100) : 0}%)
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                متابعة وإدارة الطلاب الذين أتموا ختم كتاب الله عز وجل وتصنيفهم حسب الختمة مع إمكانية الترقية السريعة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition-all"
            >
              <UserPlus size={14} />
              <span>تسجيل طالب جديد</span>
            </Link>
          </div>
        </div>

        {/* Filter Pills and Search Bar */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
          {/* Khatmah Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setKhatmahFilter('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                khatmahFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              جميع الخاتمين ({totalKhatmeen})
            </button>

            <button
              onClick={() => setKhatmahFilter('1')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                khatmahFilter === '1'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <span>🥇 الختمة الأولى</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${khatmahFilter === '1' ? 'bg-white/20 text-white' : 'bg-amber-200/70 text-amber-900'}`}>
                {khatmahCounts.first}
              </span>
            </button>

            <button
              onClick={() => setKhatmahFilter('2')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                khatmahFilter === '2'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <span>🥈 الختمة الثانية</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${khatmahFilter === '2' ? 'bg-white/20 text-white' : 'bg-emerald-200/70 text-emerald-900'}`}>
                {khatmahCounts.second}
              </span>
            </button>

            <button
              onClick={() => setKhatmahFilter('3')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                khatmahFilter === '3'
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-teal-50 text-teal-900 border border-teal-200 hover:bg-teal-100'
              }`}
            >
              <span>🥉 الختمة الثالثة</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${khatmahFilter === '3' ? 'bg-white/20 text-white' : 'bg-teal-200/70 text-teal-900'}`}>
                {khatmahCounts.third}
              </span>
            </button>

            <button
              onClick={() => setKhatmahFilter('4plus')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                khatmahFilter === '4plus'
                  ? 'bg-purple-700 text-white shadow-sm'
                  : 'bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100'
              }`}
            >
              <span>👑 الختمة ٤ فأكثر</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${khatmahFilter === '4plus' ? 'bg-white/20 text-white' : 'bg-purple-200/70 text-purple-900'}`}>
                {khatmahCounts.fourthPlus}
              </span>
            </button>
          </div>

          {/* Quick Search in Khatmeen */}
          <div className="relative w-full xl:w-72">
            <Search className="absolute right-3.5 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              value={khatmeenSearch}
              onChange={(e) => setKhatmeenSearch(e.target.value)}
              placeholder="بحث في الخاتمين (بالاسم أو الرقم)..."
              className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
            />
            {khatmeenSearch && (
              <button
                onClick={() => setKhatmeenSearch('')}
                className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Khatmeen Students Cards Grid */}
        {filteredKhatmeen.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredKhatmeen.map((s: any) => {
              const khatmahNum = Number(s.khatmahCount) || 1;
              const badgeClass = getKhatmahBadgeClass(khatmahNum);
              return (
                <div
                  key={s.id}
                  className="bg-gradient-to-br from-white via-white to-amber-50/30 rounded-2xl p-5 border border-amber-200/80 hover:border-amber-400 hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center font-bold text-base shadow-sm ring-2 ring-amber-100 shrink-0">
                          {s.name.charAt(0) || 'خ'}
                        </div>
                        <div>
                          <Link
                            to={`/students/${s.id}`}
                            className="font-black text-slate-900 group-hover:text-amber-700 transition-colors text-sm font-heading"
                          >
                            {s.name}
                          </Link>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {s.serialNumber}
                          </div>
                        </div>
                      </div>

                      <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-xl border ${badgeClass}`}>
                        <Crown size={12} className="text-amber-600" />
                        <span>{getKhatmahLabel(khatmahNum)}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                          <Bookmark size={10} className="text-amber-600" />
                          <span>نقطة البداية:</span>
                        </div>
                        <div className="text-slate-800 font-bold truncate mt-0.5 text-[11px]">
                          {s.startReach ? formatPart(s.startReach) : 'بداية المصحف'}
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-amber-50/60 border border-amber-200/60">
                        <div className="text-[10px] text-amber-800 font-bold flex items-center gap-1">
                          <BookOpen size={10} className="text-amber-700" />
                          <span>الموضع الحالي:</span>
                        </div>
                        <div className="text-amber-950 font-bold truncate mt-0.5 text-[11px]">
                          {s.currentReach ? formatPart(s.currentReach) : 'المصحف الشريف'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handlePromoteKhatmah(s)}
                      disabled={updateKhatmahMutation.isPending}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
                      title={`ترقية إلى ${getKhatmahLabel(khatmahNum + 1)}`}
                    >
                      <Sparkles size={12} className="text-amber-600" />
                      <span>ترقية الختمة ({khatmahNum + 1})</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingKhatmahStudent(s);
                          setEditKhatmahCount(khatmahNum);
                        }}
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        title="تعديل الختمة يدوياً"
                      >
                        <Edit2 size={13} />
                      </button>

                      {s.guardianPhone && (
                        <button
                          onClick={() => {
                            const clean = s.guardianPhone.replace(/\D/g, '');
                            const text = `السلام عليكم ورحمة الله وبركاته، نبارك لولي أمر الطالب الخاتم *${s.name}*، تحية طيبة من إدارة حلقات كُتّاب لتحفيظ القرآن الكريم. نود إعلامكم بأن الطالب حالياً في: *${getKhatmahLabel(khatmahNum)}*. نسأل الله له التوفيق والثبات والبركة.`;
                            window.open(`https://wa.me/${clean}?text=${encodeURIComponent(text)}`, '_blank');
                          }}
                          className="p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors cursor-pointer"
                          title="إرسال تهنئة ومتابعة عبر واتساب"
                        >
                          <Send size={13} />
                        </button>
                      )}

                      <Link
                        to={`/students/${s.id}`}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                      >
                        الملف
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-amber-50/40 border border-amber-200/60 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 mx-auto flex items-center justify-center font-bold">
              <Crown size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800">
                {totalKhatmeen === 0
                  ? 'لم يتم تسجيل أي طالب خاتم حتى الآن'
                  : 'لا يوجد طلاب مطابقون لمعايير البحث في قائمة الخاتمين'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {totalKhatmeen === 0
                  ? 'يمكنك تحديد حالة الختم ورقم الختمة (الأولى، الثانية، الثالثة...) لأي طالب عند تسجيله أو عبر تعديل بياناته في ملفه الشخصي.'
                  : 'جرب تغيير تصفية الختمات أو مسح كلمة البحث لاستعراض جميع الطلاب الخاتمين.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Live Recent Activity Feed & Quick Actions */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">سجل العمليات الأخيرة</h3>
              <p className="text-xs text-slate-400">آخر تسجيلات التسميع والمراجعة في المركز</p>
            </div>
          </div>
          <Link
            to="/daily-log"
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            عرض السجل اليومي كاملاً
            <ChevronLeft size={14} />
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          {stats?.recentActivities && stats.recentActivities.length > 0 ? (
            stats.recentActivities.map((act) => (
              <div
                key={act.id}
                className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                    {act.studentName.charAt(0) || 'ط'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/students/${act.studentId}`}
                        className="font-bold text-slate-900 hover:text-emerald-700 text-sm transition-colors"
                      >
                        {act.studentName}
                      </Link>
                      <span className="text-[11px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-md">
                        {act.studentSerial}
                      </span>
                    </div>
                    {(act.fromPart || act.toPart) && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        {act.type === 'مراجعة' ? 'مراجعة: ' : 'تسميع: '}
                        <span className="text-emerald-800 font-medium">
                          {act.fromPart ? formatPart(act.fromPart) : ''}
                          {act.toPart ? ` إلى ${formatPart(act.toPart)}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  {act.sheikhName && (
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80 inline-flex items-center gap-1">
                      <span className="text-slate-400 font-normal">بإشراف:</span>
                      <span>{act.sheikhName}</span>
                    </span>
                  )}
                  {getStatusBadge(act.status)}
                  <span className="text-xs text-slate-400">
                    {new Date(act.createdAt || act.date).toLocaleDateString('ar-EG', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-sm text-slate-400">
              لا توجد عمليات مسجلة حتى الآن. ابدأ بتسجيل أول تسميع من{' '}
              <Link to="/daily-log" className="text-emerald-700 font-bold underline">
                السجل اليومي
              </Link>
              .
            </div>
          )}
        </div>
      </div>

      {/* Full Stage & Surah Filter Modal */}
      {stageModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <BookOpen size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 font-heading">
                    تصنيف ومراحل حفظ القرآن الكريم بالمركز
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    استعراض وتصفية الطلاب حسب المراحل السبع مع إمكانية التصفية المباشرة بالسورة
                  </p>
                </div>
              </div>

              <button
                onClick={() => setStageModalOpen(false)}
                className="w-10 h-10 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Stage Selector Tabs & Surah Filter Bar */}
            <div className="p-5 border-b border-slate-100 bg-white space-y-4">
              {/* Stage Pills */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">المرحلة القرآنية:</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setModalSelectedStage('all')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      modalSelectedStage === 'all'
                        ? 'bg-emerald-700 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    الكل ({totalStudents})
                  </button>

                    {QURAN_STAGES.map((stg) => {
                      const count = students?.filter((s: any) => getQuranStage(s.currentReach) === stg.name).length || 0;
                      return (
                        <button
                          key={stg.id}
                          onClick={() => setModalSelectedStage(stg.name)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                            modalSelectedStage === stg.name
                              ? 'bg-emerald-700 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {stg.name} ({count})
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setModalSelectedStage('khatmeen')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        modalSelectedStage === 'khatmeen'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      <Crown size={13} className="text-amber-500" />
                      <span>الطلاب الخاتمون ({totalKhatmeen})</span>
                    </button>
                </div>
              </div>

              {/* Surah Filter Input */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="absolute right-3.5 top-3 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={modalSurahFilter}
                    onChange={(e) => setModalSurahFilter(e.target.value)}
                    placeholder="تصفية حسب اسم السورة (مثال: البقرة، النساء، الشعراء، يس)..."
                    className="w-full pr-10 pl-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                  {modalSurahFilter && (
                    <button
                      onClick={() => setModalSurahFilter('')}
                      className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl shrink-0">
                  عرض {modalFilteredStudents.length} طالب
                </div>
              </div>
            </div>

            {/* Students List in Modal */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {modalFilteredStudents.length > 0 ? (
                modalFilteredStudents.map((s: any) => {
                  const stage = getQuranStage(s.currentReach);
                  return (
                    <div
                      key={s.id}
                      className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">
                          {s.name.charAt(0) || 'ط'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/students/${s.id}`}
                              className="font-black text-slate-900 hover:text-emerald-700 text-sm font-heading"
                              onClick={() => setStageModalOpen(false)}
                            >
                              {s.name}
                            </Link>
                            <span className="text-[11px] font-mono bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-md">
                              {s.serialNumber}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                            {s.isKhatim ? (
                              <span className="font-black text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-300 text-[11px] inline-flex items-center gap-1">
                                <Crown size={11} className="text-amber-600" />
                                <span>خاتم ({getKhatmahLabel(s.khatmahCount)})</span>
                              </span>
                            ) : (
                              <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200/60 text-[11px]">
                                {stage}
                              </span>
                            )}
                            <span>•</span>
                            <span className="text-slate-700 font-medium">
                              {s.currentReach ? formatPart(s.currentReach) : 'المستوى لم يحدد بعد'}
                            </span>
                            {s.startReach && (
                              <>
                                <span>•</span>
                                <span className="text-slate-500 text-[10px]">
                                  البداية: {formatPart(s.startReach)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {s.guardianPhone && (
                          <button
                            onClick={() => {
                              const clean = s.guardianPhone.replace(/\D/g, '');
                              const text = `السلام عليكم ورحمة الله وبركاته، ولي أمر الطالب *${s.name}*، تحية طيبة من إدارة حلقات تحفيظ القرآن الكريم. نود إعلامكم بأن الطالب حالياً في مرحلة: *${stage}* (${s.currentReach ? formatPart(s.currentReach) : ''}).`;
                              window.open(`https://wa.me/${clean}?text=${encodeURIComponent(text)}`, '_blank');
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1.5 transition-colors"
                            title="تواصل عبر واتساب"
                          >
                            <Send size={12} />
                            <span>واتساب</span>
                          </button>
                        )}
                        <Link
                          to={`/students/${s.id}`}
                          onClick={() => setStageModalOpen(false)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                          الملف الشخصي
                        </Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-16 text-xs text-slate-400">
                  لا يوجد طلاب في هذه المرحلة أو السورة المحددة.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <Link
                to={`/students?stage=${encodeURIComponent(modalSelectedStage !== 'all' ? modalSelectedStage : '')}`}
                onClick={() => setStageModalOpen(false)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
              >
                <span>عرض هذه القائمة في دليل الطلاب المتقدم</span>
                <ChevronLeft size={14} />
              </Link>

              <button
                onClick={() => setStageModalOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Edit Khatmah Modal */}
      {editingKhatmahStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Crown size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 font-heading">تعديل ختمة الطالب</h3>
                  <p className="text-xs text-slate-400 font-bold">{editingKhatmahStudent.name}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingKhatmahStudent(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700">اختر الختمة الحالية أو المنجزة:</label>
              <div className="grid grid-cols-2 gap-2">
                {KHATMAH_PRESETS.map((preset) => {
                  const isSel = editKhatmahCount === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setEditKhatmahCount(preset.value)}
                      className={`p-3 rounded-xl text-center text-xs font-bold border transition-all cursor-pointer ${
                        isSel
                          ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {editKhatmahCount >= 5 && (
                <div className="flex items-center gap-3 pt-2">
                  <label className="text-xs font-bold text-slate-700">رقم الختمة بدقة:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editKhatmahCount}
                    onChange={(e) => setEditKhatmahCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 h-10 px-3 rounded-xl border border-slate-200 font-bold text-center text-sm"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  updateKhatmahMutation.mutate({
                    id: editingKhatmahStudent.id,
                    khatmahCount: 0,
                    isKhatim: false,
                  });
                }}
                disabled={updateKhatmahMutation.isPending}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
              >
                إلغاء صفة خاتم
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingKhatmahStudent(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateKhatmahMutation.mutate({
                      id: editingKhatmahStudent.id,
                      khatmahCount: editKhatmahCount,
                      isKhatim: true,
                    });
                  }}
                  disabled={updateKhatmahMutation.isPending}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20 transition-all cursor-pointer"
                >
                  {updateKhatmahMutation.isPending ? 'جاري الحفظ...' : 'حفظ الختمة'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
