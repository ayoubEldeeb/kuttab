import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  UserCheck, 
  Users, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Check, 
  X, 
  RotateCcw, 
  FileText, 
  LayoutGrid, 
  List, 
  ChevronLeft, 
  Sparkles, 
  MessageSquare,
  ShieldCheck,
  CheckCheck
} from 'lucide-react';
import { format, subDays, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import { Input } from '../components/ui/input';
import api from '../utils/api';
import { useThemeAndSettings } from '../context/ThemeAndSettingsContext';
import { QURAN_STAGES, getQuranStage } from '../utils/quranStages';
import { formatPart } from '../utils/formatPart';

type AttendanceStatus = 'all' | 'attended' | 'absent' | 'unrecorded';

export default function DailyAttendance() {
  const { activeSheikh, getHolidayInfo } = useThemeAndSettings();
  const queryClient = useQueryClient();

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const holidayInfo = getHolidayInfo(selectedDate);
  const isSelectedDateHoliday = holidayInfo.isHoliday;
  const isSelectedToday = selectedDate === todayStr;

  // Fetch students with their histories
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students', selectedDate],
    queryFn: async () => {
      const res = await api.get(`/students?date=${selectedDate}`);
      return res.data;
    },
  });

  // Single attendance mutation with optimistic update
  const attendanceMutation = useMutation({
    mutationFn: async ({ studentId, status }: { studentId: number; status: string }) => {
      const res = await api.post('/students/attendance/record', {
        studentId,
        date: selectedDate,
        status,
        sheikhId: activeSheikh?.id || undefined,
        sheikhName: activeSheikh?.name || undefined,
      });
      return res.data;
    },
    onMutate: async ({ studentId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['students', selectedDate] });
      const previousStudents = queryClient.getQueryData(['students', selectedDate]);

      queryClient.setQueryData(['students', selectedDate], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((student: any) => {
          if (student.id !== studentId) return student;

          const existingHistories = student.histories || [];
          const existingIndex = existingHistories.findIndex((h: any) => h.date.startsWith(selectedDate));
          
          let updatedHistories = [...existingHistories];
          if (existingIndex >= 0) {
            updatedHistories[existingIndex] = {
              ...updatedHistories[existingIndex],
              status,
              sheikhName: activeSheikh?.name || updatedHistories[existingIndex].sheikhName,
            };
          } else {
            updatedHistories.unshift({
              id: Date.now(),
              studentId,
              date: selectedDate,
              status,
              type: 'حضور',
              sheikhName: activeSheikh?.name,
            });
          }

          return {
            ...student,
            histories: updatedHistories,
          };
        });
      });

      return { previousStudents };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousStudents) {
        queryClient.setQueryData(['students', selectedDate], context.previousStudents);
      }
      toast.error('حدث خطأ أثناء حفظ حالة الحضور');
    },
    onSuccess: (_data, variables) => {
      if (variables.status === 'حاضر') {
        toast.success('تم تسجيل الحضور بنجاح', { duration: 1200 });
      } else {
        toast.error('تم تسجيل الغياب', { duration: 1200, icon: '⚠️' });
      }
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  // Bulk attendance mutation (Mark All Present)
  const bulkMutation = useMutation({
    mutationFn: async ({ studentIds, status }: { studentIds: number[]; status: string }) => {
      const res = await api.post('/students/attendance/bulk', {
        date: selectedDate,
        studentIds,
        status,
        sheikhId: activeSheikh?.id || undefined,
        sheikhName: activeSheikh?.name || undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`تم تسجيل ${data.count} طالباً حاضرين بنجاح!`, { icon: '✅' });
      queryClient.invalidateQueries({ queryKey: ['students', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setIsBulkConfirmOpen(false);
    },
    onError: () => {
      toast.error('حدث خطأ أثناء تسجيل الحضور الجماعي');
    },
  });

  // Reset attendance mutation
  const resetMutation = useMutation({
    mutationFn: async (studentIds?: number[]) => {
      const res = await api.post('/students/attendance/reset', {
        date: selectedDate,
        studentIds,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('تم إلغاء تسجيل الحضور لليوم المحدد');
      queryClient.invalidateQueries({ queryKey: ['students', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setIsResetConfirmOpen(false);
    },
    onError: () => {
      toast.error('حدث خطأ أثناء إلغاء التسجيل');
    },
  });

  // Process students status for the selected date
  const processedStudents = useMemo(() => {
    return students.map((student: any) => {
      const todayHistory = (student.histories || []).find((h: any) => h.date.startsWith(selectedDate));
      
      let state: 'attended' | 'absent' | 'unrecorded' = 'unrecorded';
      let statusText = 'لم يُسجل بعد';
      let hasAcademicActivity = false;
      let academicDescription = '';

      if (todayHistory) {
        if (todayHistory.status === 'لم يحضر') {
          state = 'absent';
          statusText = 'غائب (لم يحضر)';
        } else {
          state = 'attended';
          statusText = todayHistory.status;
          
          if (todayHistory.status.includes('حفظ') || todayHistory.status.includes('كتب') || todayHistory.fromPart || todayHistory.writtenParts) {
            hasAcademicActivity = true;
            academicDescription = todayHistory.status;
          }
        }
      }

      const stage = getQuranStage(student.currentReach);

      return {
        ...student,
        todayHistory,
        attendanceState: state,
        statusText,
        hasAcademicActivity,
        academicDescription,
        stage,
      };
    });
  }, [students, selectedDate]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = processedStudents.length;
    const attended = processedStudents.filter((s: any) => s.attendanceState === 'attended').length;
    const absent = processedStudents.filter((s: any) => s.attendanceState === 'absent').length;
    const unrecorded = processedStudents.filter((s: any) => s.attendanceState === 'unrecorded').length;
    
    const recorded = attended + absent;
    const attendanceRate = total > 0 ? Math.round((attended / total) * 100) : 0;
    const progressRate = total > 0 ? Math.round((recorded / total) * 100) : 0;

    return { total, attended, absent, unrecorded, attendanceRate, progressRate, recorded };
  }, [processedStudents]);

  // Filtered students list
  const filteredStudents = useMemo(() => {
    return processedStudents.filter((s: any) => {
      const matchesSearch = 
        s.name.toLowerCase().includes(search.toLowerCase()) || 
        (s.serialNumber && s.serialNumber.toLowerCase().includes(search.toLowerCase())) ||
        (s.guardianPhone && s.guardianPhone.includes(search));

      const matchesStatus = 
        statusFilter === 'all' ? true : s.attendanceState === statusFilter;

      const matchesStage = 
        stageFilter === 'all' ? true : s.stage === stageFilter;

      return matchesSearch && matchesStatus && matchesStage;
    });
  }, [processedStudents, search, statusFilter, stageFilter]);

  // Helper date shortcuts
  const handleSetToday = () => setSelectedDate(todayStr);
  const handleSetYesterday = () => setSelectedDate(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const handlePrevDay = () => setSelectedDate(format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd'));
  const handleNextDay = () => setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'));

  // Mark all present
  const handleMarkAllPresent = () => {
    const allIds = processedStudents.map((s: any) => s.id);
    if (allIds.length === 0) return;
    bulkMutation.mutate({ studentIds: allIds, status: 'حاضر' });
  };

  // WhatsApp Absence Notification
  const sendAbsenceWhatsapp = (student: any) => {
    if (!student.guardianPhone) {
      toast.error('لم يتم تسجيل هاتف ولي الأمر لهذا الطالب');
      return;
    }
    const cleanPhone = student.guardianPhone.replace(/\D/g, '');
    const dateFormatted = new Intl.DateTimeFormat('ar-EG', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }).format(new Date(selectedDate));

    const message = `السلام عليكم ورحمة الله وبركاته،\nولي أمر الطالب/ة: *${student.name}*\n\nنود إحاطتكم علماً بأن الطالب/ة لم يحضر حلقة القرآن الكريم اليوم (${dateFormatted}).\nنرجو المتابعة والحرص على عدم التغيب لضمان ثبات الحفظ والاستمرار.\n\nجزاكم الله خيراً،\n*إدارة حلقة تحفيظ القرآن الكريم*`;

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto pb-20 font-sans" dir="rtl">
      
      {/* Top Header & Date Controller */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-700/20 ring-4 ring-emerald-50">
              <UserCheck size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-heading tracking-tight">
                  تسجيل الحضور
                </h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                  <Sparkles size={12} />
                  رصد فوري
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                تسجيل ومتابعة حضور وغياب طلاب الحلقة بنقرة واحدة بألوان واضحة وتحديث تلقائي
              </p>
            </div>
          </div>
        </div>

        {/* Date Selector & Fast Shortcuts */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full lg:w-auto bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={handleSetToday}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isSelectedToday
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/70'
            }`}
          >
            اليوم
          </button>
          
          <button
            type="button"
            onClick={handleSetYesterday}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/70 transition-all cursor-pointer"
          >
            أمس
          </button>

          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-slate-200/70 flex-1 sm:flex-initial">
            <button
              onClick={handlePrevDay}
              title="اليوم السابق"
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} className="rotate-180" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-bold text-slate-800 outline-none px-1 cursor-pointer"
            />
            <button
              onClick={handleNextDay}
              title="اليوم التالي"
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Holiday Alert if Selected Date is Holiday */}
      {isSelectedDateHoliday && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-300 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="font-bold text-sm">
                تنبيه: التاريخ المحدد ({selectedDate}) يوافق «{holidayInfo.holidayName || 'عطلة رسمية بالمركز'}»
                {holidayInfo.holidayReason && ` (السبب: ${holidayInfo.holidayReason})`}
              </div>
              <div className="text-xs text-amber-800/90 mt-0.5">
                يمكنك تسجيل الحضور الاستثنائي إن وجدت حلقة إضافية، ولن تؤثر أيام العطلة سلباً على معدل الطالب التراكمي.
              </div>
            </div>
          </div>
          <span className="text-xs font-bold bg-amber-200 text-amber-950 px-3 py-1 rounded-xl shrink-0 self-start sm:self-auto">
            {holidayInfo.holidayName || 'عطلة رسمية'}
          </span>
        </div>
      )}

      {/* Real-time KPI Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Students */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-1">إجمالي الطلاب</span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-heading">
              {stats.total}
            </div>
            <span className="text-[11px] text-slate-500 font-medium block mt-1">
              المسجلون في الحلقة
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Users size={24} />
          </div>
        </div>

        {/* Attended Students */}
        <div className="bg-emerald-50/80 p-5 rounded-3xl border border-emerald-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-800 block mb-1">الحاضرون اليوم</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-emerald-900 font-heading">
                {stats.attended}
              </span>
              <span className="text-xs font-extrabold text-emerald-700 bg-emerald-200/70 px-2 py-0.5 rounded-full">
                {stats.attendanceRate}%
              </span>
            </div>
            <span className="text-[11px] text-emerald-700 font-medium block mt-1">
              حضروا الحلقة بنجاح
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-600/30">
            <CheckCircle2 size={24} />
          </div>
        </div>

        {/* Absent Students */}
        <div className="bg-rose-50/80 p-5 rounded-3xl border border-rose-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-rose-800 block mb-1">الغائبون اليوم</span>
            <div className="text-2xl sm:text-3xl font-black text-rose-900 font-heading">
              {stats.absent}
            </div>
            <span className="text-[11px] text-rose-700 font-medium block mt-1">
              تم توثيق غيابهم
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-sm shadow-rose-600/30">
            <XCircle size={24} />
          </div>
        </div>

        {/* Pending / Unrecorded Students */}
        <div className="bg-amber-50/70 p-5 rounded-3xl border border-amber-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-800 block mb-1">بانتظار التسجيل</span>
            <div className="text-2xl sm:text-3xl font-black text-amber-900 font-heading">
              {stats.unrecorded}
            </div>
            <span className="text-[11px] text-amber-700 font-medium block mt-1">
              لم تُحدد حالتهم بعد
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm shadow-amber-500/30">
            <Clock size={24} />
          </div>
        </div>
      </div>

      {/* Completion Progress Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <ShieldCheck size={18} className="text-emerald-700 shrink-0" />
          <span className="text-xs font-bold text-slate-700">
            نسبة اكتمال رصد حضور الحلقة لليوم:
          </span>
          <span className="text-xs font-black text-slate-900 font-heading">
            {stats.recorded} من {stats.total} ({stats.progressRate}%)
          </span>
        </div>

        <div className="w-full sm:w-64 bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
          <div 
            className="bg-emerald-600 h-full transition-all duration-300" 
            style={{ width: `${stats.total > 0 ? (stats.attended / stats.total) * 100 : 0}%` }}
            title={`حاضر: ${stats.attended}`}
          />
          <div 
            className="bg-rose-500 h-full transition-all duration-300" 
            style={{ width: `${stats.total > 0 ? (stats.absent / stats.total) * 100 : 0}%` }}
            title={`غائب: ${stats.absent}`}
          />
        </div>
      </div>

      {/* Main Action Bar: Filters, Search, and Bulk Actions */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3.5">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3.5 top-3 text-slate-400" size={18} />
            <Input
              type="text"
              placeholder="بحث باسم الطالب، الرقم التعريفي، أو هاتف ولي الأمر..."
              className="pr-10 h-11 rounded-2xl bg-slate-50 border-slate-200 text-sm focus:bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Quick Bulk Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setIsBulkConfirmOpen(true)}
              disabled={bulkMutation.isPending || stats.total === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-black shadow-sm shadow-emerald-700/20 transition-all cursor-pointer disabled:opacity-50"
              title="تسجيل جميع طلاب الحلقة حاضرين بضغطة واحدة"
            >
              <CheckCheck size={17} />
              <span>تحضير الكل حاضر ({stats.total})</span>
            </button>

            <button
              onClick={() => setIsResetConfirmOpen(true)}
              disabled={resetMutation.isPending || stats.recorded === 0}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-40"
              title="إلغاء ومسح تسجيل الحضور لجميع الطلاب اليوم"
            >
              <RotateCcw size={15} />
              <span>إعادة تعيين اليوم</span>
            </button>

            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80 mr-auto">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                  viewMode === 'grid' 
                    ? 'bg-white text-emerald-800 shadow-2xs font-bold' 
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                title="عرض البطاقات"
              >
                <LayoutGrid size={17} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                  viewMode === 'table' 
                    ? 'bg-white text-emerald-800 shadow-2xs font-bold' 
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                title="عرض القائمة والجدول"
              >
                <List size={17} />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Pills and Stage Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          
          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              الكل ({stats.total})
            </button>

            <button
              onClick={() => setStatusFilter('attended')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'attended'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              حاضر ({stats.attended})
            </button>

            <button
              onClick={() => setStatusFilter('absent')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'absent'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              غائب ({stats.absent})
            </button>

            <button
              onClick={() => setStatusFilter('unrecorded')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'unrecorded'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              بانتظار التسجيل ({stats.unrecorded})
            </button>
          </div>

          {/* Stage Dropdown Filter */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-400 font-bold hidden sm:inline">المرحلة:</span>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3 py-1.5 text-slate-700 outline-none hover:bg-white transition-colors cursor-pointer"
            >
              <option value="all">جميع المراحل القرآنيّة</option>
              {QURAN_STAGES.map((st) => (
                <option key={st.id} value={st.name}>
                  {st.name}
                </option>
              ))}
              <option value="غير محدد">غير محدد</option>
            </select>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Bulk Mark All Present */}
      {isBulkConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
              <CheckCheck size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-900 font-heading">
              تأكيد تحضير جميع الطلاب
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              هل أنت متأكد من تسجيل جميع طلاب الحلقة (عدد: {stats.total}) كـ <strong className="text-emerald-700">«حاضر»</strong> لتاريخ <strong>{selectedDate}</strong>؟
              <br />
              يمكنك بعد ذلك تعديل أي طالب غائب بشكل فردي بنقرة واحدة.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={handleMarkAllPresent}
                disabled={bulkMutation.isPending}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
              >
                {bulkMutation.isPending ? 'جاري التحضير...' : 'نعم، تحضير الكل حاضر'}
              </button>
              <button
                onClick={() => setIsBulkConfirmOpen(false)}
                className="py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Reset Attendance */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-4">
              <RotateCcw size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-900 font-heading">
              تأكيد إعادة تعيين سجل اليوم
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              سيتم مسح وإلغاء تسجيل حضور جميع الطلاب لتاريخ <strong>{selectedDate}</strong> وإعادتهم لحالة «بانتظار التسجيل». هل ترغب في الاستمرار؟
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => resetMutation.mutate(undefined)}
                disabled={resetMutation.isPending}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-700/20 transition-all cursor-pointer"
              >
                {resetMutation.isPending ? 'جاري المسح...' : 'تأكيد مسح الحضور لليوم'}
              </button>
              <button
                onClick={() => setIsResetConfirmOpen(false)}
                className="py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Students List Display */}
      {isLoading ? (
        <div className="py-24 text-center bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-emerald-600 border-t-transparent"></div>
          <div className="text-sm font-bold text-slate-600">جاري تحميل بيانات حضور الطلاب...</div>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Users size={30} />
          </div>
          <div className="text-base font-bold text-slate-700">لا يوجد طلاب يطابقون خيارات البحث أو التصفية</div>
          <p className="text-xs text-slate-400">جرب تغيير معيار البحث أو تصفية الحضور والمرحلة.</p>
          {(search || statusFilter !== 'all' || stageFilter !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setStageFilter('all');
              }}
              className="mt-2 text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              إعادة تعيين خيارات التصفية
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredStudents.map((student: any) => {
            const isAttended = student.attendanceState === 'attended';
            const isAbsent = student.attendanceState === 'absent';
            const isUnrecorded = student.attendanceState === 'unrecorded';

            return (
              <div
                key={student.id}
                className={`bg-white rounded-3xl p-5 border transition-all duration-200 relative flex flex-col justify-between shadow-xs hover:shadow-md ${
                  isAttended 
                    ? 'border-emerald-200/90 ring-1 ring-emerald-500/20 bg-gradient-to-b from-emerald-50/20 to-white' 
                    : isAbsent 
                    ? 'border-rose-200/90 ring-1 ring-rose-500/20 bg-gradient-to-b from-rose-50/20 to-white' 
                    : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                {/* Card Top: Student Info & Badges */}
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-2xs ${
                        isAttended 
                          ? 'bg-emerald-600 text-white' 
                          : isAbsent 
                          ? 'bg-rose-600 text-white' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {student.name.substring(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <Link 
                          to={`/students/${student.id}`} 
                          className="font-black text-base text-slate-900 hover:text-emerald-700 truncate block font-heading transition-colors"
                          title="عرض ملف الطالب"
                        >
                          {student.name}
                        </Link>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <span className="font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                            {student.serialNumber || `STU-${student.id}`}
                          </span>
                          <span>•</span>
                          <span className="text-emerald-800 font-bold truncate">
                            {student.stage}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Profile / Report Links */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        to={`/students/${student.id}/report`}
                        className="p-2 rounded-xl text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                        title="تقرير ولي الأمر"
                      >
                        <FileText size={16} />
                      </Link>
                      {student.guardianPhone && isAbsent && (
                        <button
                          onClick={() => sendAbsenceWhatsapp(student)}
                          className="p-2 rounded-xl text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                          title="إرسال إشعار غياب لولي الأمر عبر واتساب"
                        >
                          <MessageSquare size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Reach / Daily Activity Hint */}
                  <div className="text-xs bg-slate-50 p-2.5 rounded-2xl border border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-slate-400 font-medium truncate">
                      المستوى الحالي: {formatPart(student.currentReach) || 'لم يحدد'}
                    </span>
                    {student.hasAcademicActivity ? (
                      <span className="text-[10px] font-black text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full shrink-0">
                        {student.academicDescription}
                      </span>
                    ) : (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        isAttended 
                          ? 'text-emerald-800 bg-emerald-100' 
                          : isAbsent 
                          ? 'text-rose-800 bg-rose-100' 
                          : 'text-amber-800 bg-amber-100'
                      }`}>
                        {student.statusText}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Bottom: Big Clear Action Buttons */}
                <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
                  <div className="grid grid-cols-2 gap-2.5">
                    
                    {/* Present Button (حاضر) */}
                    <button
                      type="button"
                      onClick={() => attendanceMutation.mutate({ studentId: student.id, status: 'حاضر' })}
                      disabled={attendanceMutation.isPending}
                      className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl text-xs font-black transition-all cursor-pointer active:scale-95 ${
                        isAttended
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-700/25 ring-2 ring-emerald-400'
                          : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200'
                      }`}
                    >
                      <Check size={16} className={isAttended ? 'stroke-[3]' : ''} />
                      <span>حاضر</span>
                    </button>

                    {/* Absent Button (لم يحضر) */}
                    <button
                      type="button"
                      onClick={() => attendanceMutation.mutate({ studentId: student.id, status: 'لم يحضر' })}
                      disabled={attendanceMutation.isPending}
                      className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl text-xs font-black transition-all cursor-pointer active:scale-95 ${
                        isAbsent
                          ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-700/25 ring-2 ring-rose-400'
                          : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-800 hover:border-rose-300 border border-slate-200'
                      }`}
                    >
                      <X size={16} className={isAbsent ? 'stroke-[3]' : ''} />
                      <span>لم يحضر</span>
                    </button>
                  </div>

                  {/* Reset single student button (only if already recorded) */}
                  {!isUnrecorded && (
                    <button
                      type="button"
                      onClick={() => resetMutation.mutate([student.id])}
                      className="w-full text-center text-[10px] text-slate-400 hover:text-slate-600 font-bold py-1 transition-colors cursor-pointer"
                    >
                      إلغاء وتفريغ الحالة
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                <tr>
                  <th className="p-4 w-12 text-center">#</th>
                  <th className="p-4">اسم الطالب</th>
                  <th className="p-4">الرقم التعريفي</th>
                  <th className="p-4">المرحلة الحالية</th>
                  <th className="p-4 text-center">حالة اليوم</th>
                  <th className="p-4 text-center">تسجيل الحضور السريع</th>
                  <th className="p-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredStudents.map((student: any, idx: number) => {
                  const isAttended = student.attendanceState === 'attended';
                  const isAbsent = student.attendanceState === 'absent';
                  const isUnrecorded = student.attendanceState === 'unrecorded';

                  return (
                    <tr 
                      key={student.id} 
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isAttended ? 'bg-emerald-50/20' : isAbsent ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      <td className="p-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-4">
                        <Link 
                          to={`/students/${student.id}`} 
                          className="font-bold text-sm text-slate-900 hover:text-emerald-700 font-heading"
                        >
                          {student.name}
                        </Link>
                        {student.guardianName && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            ولي الأمر: {student.guardianName}
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-500">
                        {student.serialNumber || `STU-${student.id}`}
                      </td>
                      <td className="p-4">
                        <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-1 rounded-lg">
                          {student.stage}
                        </span>
                        <div className="text-[11px] text-slate-400 mt-1">
                          {formatPart(student.currentReach) || 'لم يحدد'}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${
                          isAttended 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : isAbsent 
                            ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {isAttended && <CheckCircle2 size={13} />}
                          {isAbsent && <XCircle size={13} />}
                          {isUnrecorded && <Clock size={13} />}
                          <span>{student.statusText}</span>
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => attendanceMutation.mutate({ studentId: student.id, status: 'حاضر' })}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                              isAttended
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-800'
                            }`}
                          >
                            حاضر
                          </button>
                          <button
                            type="button"
                            onClick={() => attendanceMutation.mutate({ studentId: student.id, status: 'لم يحضر' })}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                              isAbsent
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-rose-100 hover:text-rose-800'
                            }`}
                          >
                            لم يحضر
                          </button>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {student.guardianPhone && isAbsent && (
                            <button
                              onClick={() => sendAbsenceWhatsapp(student)}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                              title="إشعار غياب واتساب"
                            >
                              <MessageSquare size={15} />
                            </button>
                          )}
                          <Link
                            to={`/students/${student.id}/report`}
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                            title="تقرير ولي الأمر"
                          >
                            <FileText size={15} />
                          </Link>
                          {!isUnrecorded && (
                            <button
                              onClick={() => resetMutation.mutate([student.id])}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="تفريغ الحالة"
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating Bottom Action Bar for Quick Summary & Halaqah Finish */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-8 sm:right-8 lg:right-96 z-30 pointer-events-none">
        <div className="bg-slate-900/90 text-white backdrop-blur-md px-5 py-3.5 rounded-3xl shadow-xl border border-slate-700/60 max-w-xl mx-auto flex items-center justify-between gap-4 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-xs">
              ✓
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">
                الحاضرون اليوم: <span className="text-emerald-400 font-extrabold">{stats.attended}</span> / {stats.total}
              </div>
              <div className="text-[10px] text-slate-400">
                {stats.unrecorded > 0 ? `متبقي ${stats.unrecorded} طالب بانتظار التسجيل` : 'اكتمل رصد حضور جميع الطلاب!'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/daily-log"
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition-colors flex items-center gap-1.5"
            >
              <span>السجل اليومي</span>
              <ChevronLeft size={14} />
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
}
