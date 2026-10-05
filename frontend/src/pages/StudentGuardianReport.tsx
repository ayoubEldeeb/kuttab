import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { 
  Printer, 
  ArrowRight, 
  Calendar, 
  Send, 
  Check, 
  BookOpen, 
  Layers, 
  Sparkles, 
  XCircle,
  Scroll,
  BookMarked,
  Repeat,
  Award,
  ShieldCheck,
  Clock,
  Crown,
  Bookmark
} from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { formatPart } from '../utils/formatPart';
import { getQuranStage } from '../utils/quranStages';
import { useThemeAndSettings } from '../context/ThemeAndSettingsContext';
import { getKhatmahLabel } from '../utils/khatmahUtils';

type WritingUnit = 'thumn' | 'ayah';
type PrintLayoutMode = 'full' | 'single_page';

export default function StudentGuardianReport() {
  const { id } = useParams();
  const { activeSheikh } = useThemeAndSettings();

  // Dates handling
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  // Default: last 14 days
  const [startDate, setStartDate] = useState(() => format(subDays(today, 13), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => todayStr);
  const [activePreset, setActivePreset] = useState<string>('last_14');
  const [writingUnit, setWritingUnit] = useState<WritingUnit>('thumn');
  const [printLayoutMode, setPrintLayoutMode] = useState<PrintLayoutMode>('full');

  // Fetch Report Data from backend
  const { data: reportData, isLoading, isError } = useQuery({
    queryKey: ['student-report', id, startDate, endDate],
    queryFn: async () => {
      const res = await api.get(`/students/${id}/report?startDate=${startDate}&endDate=${endDate}`);
      return res.data;
    },
    enabled: !!id && !!startDate && !!endDate,
  });

  const student = reportData?.student;
  const stats = reportData?.stats;
  const days = reportData?.days || [];
  const stage = useMemo(() => getQuranStage(student?.currentReach), [student?.currentReach]);

  // Filter active attended days for compact 1-page view
  const activeAttendedDays = useMemo(() => {
    return days.filter((d: any) => d.attendanceType === 'attended');
  }, [days]);

  // Safe Date Display formatter (DD/MM/YYYY)
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return format(d, 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  // Quick Preset Handlers
  const applyPreset = (preset: 'this_week' | 'last_week' | 'last_14' | 'this_month' | 'last_month') => {
    setActivePreset(preset);
    const now = new Date();
    switch (preset) {
      case 'this_week': {
        const start = startOfWeek(now, { weekStartsOn: 6 }); // Saturday
        const end = endOfWeek(now, { weekStartsOn: 6 });
        setStartDate(format(start, 'yyyy-MM-dd'));
        setEndDate(format(end > now ? now : end, 'yyyy-MM-dd'));
        break;
      }
      case 'last_week': {
        const lastWeekDay = subDays(now, 7);
        const start = startOfWeek(lastWeekDay, { weekStartsOn: 6 });
        const end = endOfWeek(lastWeekDay, { weekStartsOn: 6 });
        setStartDate(format(start, 'yyyy-MM-dd'));
        setEndDate(format(end, 'yyyy-MM-dd'));
        break;
      }
      case 'last_14': {
        setStartDate(format(subDays(now, 13), 'yyyy-MM-dd'));
        setEndDate(format(now, 'yyyy-MM-dd'));
        break;
      }
      case 'this_month': {
        const start = startOfMonth(now);
        setStartDate(format(start, 'yyyy-MM-dd'));
        setEndDate(format(now, 'yyyy-MM-dd'));
        break;
      }
      case 'last_month': {
        const prevMonth = subMonths(now, 1);
        const start = startOfMonth(prevMonth);
        const end = endOfMonth(prevMonth);
        setStartDate(format(start, 'yyyy-MM-dd'));
        setEndDate(format(end, 'yyyy-MM-dd'));
        break;
      }
    }
  };

  // WhatsApp Share Function
  const shareReportViaWhatsApp = () => {
    if (!student?.guardianPhone) {
      toast.error('لا يوجد رقم هاتف مسجل لولي الأمر');
      return;
    }

    const cleanPhone = student.guardianPhone.replace(/\D/g, '');
    let msg = `*بسم الله الرحمن الرحيم*\n`;
    msg += `السلام عليكم ورحمة الله وبركاته،\n`;
    msg += `المكرم ولي أمر الطالب/ة: *${student.name}*\n`;
    msg += `تحية طيبة مباركة من *منظومة حلقات كُتّاب لتحفيظ القرآن الكريم*.\n\n`;
    msg += `📄 *تقرير المتابعة الدورية للفترة:* من ${formatDateDisplay(startDate)} إلى ${formatDateDisplay(endDate)}\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n`;
    if (student.isKhatim) {
      msg += `👑 *صفة الطالب:* خاتم لكتاب الله تعالى (${getKhatmahLabel(student.khatmahCount)})\n`;
    }
    msg += `📖 *المرحلة القرآنية:* ${stage}\n`;
    if (student.startReach) {
      msg += `🌱 *نقطة البداية عند الالتحاق:* ${formatPart(student.startReach)}\n`;
    }
    msg += `📌 *آخر موضع محفوظ:* ${formatPart(student.currentReach) || 'بداية المصحف'}\n`;
    if (student.currentRevisionFrom || student.currentRevisionTo) {
      msg += `🔁 *ورد المراجعة:* من ${formatPart(student.currentRevisionFrom)} إلى ${formatPart(student.currentRevisionTo)}\n`;
    }
    msg += `\n📊 *ملخص أداء الطالب خلال الفترة:*\n`;
    msg += `• نسبة الحضور والالتزام: *${stats?.attendanceRate || 0}%*\n`;
    msg += `• عدد أيام الحضور: *${stats?.attendedDays || 0} يوم*\n`;
    msg += `• عدد أيام الغياب: *${stats?.absentDays || 0} يوم*\n`;
    msg += `• أيام العطلات الرسمية: *${stats?.holidayDays || 0} يوم*\n`;
    
    // Explicitly list custom holidays with reasons if present in period
    const customHolidaysInPeriod = days.filter((d: any) => d.isCustomHoliday || (d.isHoliday && d.holidayReason));
    if (customHolidaysInPeriod.length > 0) {
      msg += `\n🏖️ *الإجازات والعطلات الخاصة خلال الفترة:*\n`;
      customHolidaysInPeriod.forEach((ch: any) => {
        msg += `• ${ch.dayName} (${formatDateDisplay(ch.date)}): *${ch.holidayName || 'إجازة'}*`;
        if (ch.holidayReason) {
          msg += ` (السبب: ${ch.holidayReason})`;
        }
        msg += `\n`;
      });
    }

    msg += `• المحفوظ والمسَمّع: *${stats?.memorizedPortions || 0} مقطع/ثمن*\n`;
    
    if (writingUnit === 'ayah') {
      msg += `• المقدار المكتوب في اللوح: *${stats?.writtenAyahs || 0} آية*\n`;
    } else {
      msg += `• المقدار المكتوب في اللوح: *${stats?.writtenThumns || 0} ثمن (${stats?.writtenAyahs || 0} آية تقريباً)*\n`;
    }
    
    msg += `• جلسات المراجعة المنجزة: *${stats?.revisionSessions || 0} جلسة*\n`;
    msg += `• التقييم العام للفترة: *${stats?.overallEvaluation || 'ممتاز ومواظب'}*\n`;

    if (activeSheikh?.name) {
      msg += `\n👤 *المشرف على الحلقة:* ${activeSheikh.name}\n`;
    }
    msg += `\nنسأل الله تعالى أن يبارك فيكم وفي ابنكم وأن يجعله من أهل القرآن الكريم الذين هم أهل الله وخاصته.`;

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-slate-400 space-y-3 print:hidden">
        <div className="w-10 h-10 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-slate-600">جاري تجهيز تقرير المتابعة المعتمد لولي الأمر...</p>
      </div>
    );
  }

  if (isError || !student) {
    return (
      <div className="text-center py-24 space-y-4 max-w-md mx-auto print:hidden">
        <div className="text-rose-600 font-black text-lg">لم يتم العثور على بيانات تقرير الطالب</div>
        <Link to="/students" className="inline-flex items-center gap-2 text-emerald-700 font-bold text-sm hover:underline">
          <ArrowRight size={16} />
          <span>الرجوع لدليل الطلاب</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 font-sans text-slate-800 animate-in fade-in duration-300 print:max-w-none print:p-0 print:m-0 print:space-y-0">
      {/* 1. TOP CONTROL & FILTER BAR (HIDDEN IN PRINT) */}
      <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-200/90 space-y-5 print:hidden">
        {/* Header Row: Title, Student Name, and Primary Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3.5">
            <Link 
              to={`/students/${id}`}
              className="w-11 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors border border-slate-200 shrink-0"
              title="الرجوع لملف الطالب"
            >
              <ArrowRight size={20} />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 font-heading">
                  تقرير المتابعة الدورية لولي الأمر
                </h1>
                <span className="bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-black px-3 py-0.5 rounded-full">
                  جاهز للطباعة A4
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                الطالب: <span className="font-bold text-slate-900">{student.name}</span> • رقم القيد: <span className="font-mono font-bold text-emerald-800">{student.serialNumber}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {student.guardianPhone && (
              <button
                onClick={shareReportViaWhatsApp}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition-all active:scale-95 cursor-pointer"
                title="إرسال ملخص التقرير المباشر لولي الأمر عبر واتساب"
              >
                <Send size={15} className="text-emerald-700" />
                <span>إرسال واتساب</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition-all active:scale-95 cursor-pointer"
            >
              <Printer size={16} />
              <span>
                طباعة التقرير {printLayoutMode === 'single_page' ? '(صفحة واحدة)' : '(كامل التفاصيل)'}
              </span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row: Cleanly Structured Box */}
        <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-3.5">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 font-bold text-xs flex items-center gap-1 ml-1 shrink-0">
              <Clock size={13} className="text-emerald-700" />
              <span>فترات سريعة:</span>
            </span>
            {[
              { id: 'this_week', label: 'هذا الأسبوع' },
              { id: 'last_week', label: 'الأسبوع الماضي' },
              { id: 'last_14', label: 'آخر 14 يوماً' },
              { id: 'this_month', label: 'هذا الشهر' },
              { id: 'last_month', label: 'الشهر الماضي' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activePreset === p.id
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'bg-white hover:bg-emerald-50 text-slate-700 border border-slate-200 hover:border-emerald-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date Pickers & Unit Switcher & Layout Mode Switcher */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-200/60">
            {/* Custom Date Pickers */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-600 font-bold">من تاريخ:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setActivePreset('');
                  setStartDate(e.target.value);
                }}
                className="h-9 px-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <span className="text-slate-600 font-bold">إلى تاريخ:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setActivePreset('');
                  setEndDate(e.target.value);
                }}
                className="h-9 px-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            {/* Layout Mode (Full vs Single Page) + Writing Unit Switchers */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Print Layout Mode: Full vs 1-Page A4 */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPrintLayoutMode('full')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    printLayoutMode === 'full'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                  title="تقرير شامل متعدد الصفحات يحتوي كامل السجل اليومي بدون أي قص"
                >
                  <Layers size={13} />
                  <span>تقرير شامل (كامل السجل)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintLayoutMode('single_page')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    printLayoutMode === 'single_page'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                  title="شهادة وملخص تنفيذي مصمم ليلائم ورقة A4 واحدة فقط"
                >
                  <Award size={13} />
                  <span>صفحة واحدة A4 (موجز)</span>
                </button>
              </div>

              {/* Writing Unit Switcher */}
              <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold shadow-2xs">
                <button
                  type="button"
                  onClick={() => setWritingUnit('thumn')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    writingUnit === 'thumn'
                      ? 'bg-teal-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                  title="عرض المقدار المكتوب في اللوح بالأثمان القرآنية"
                >
                  <Scroll size={13} />
                  <span>بالأثمان</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWritingUnit('ayah')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    writingUnit === 'ayah'
                      ? 'bg-teal-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                  title="عرض المقدار المكتوب في اللوح بعدد الآيات (للأطفال الصغار)"
                >
                  <BookMarked size={13} />
                  <span>بالآيات</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. OFFICIAL PRINTABLE CERTIFICATE DOCUMENT (RENDERED ON SCREEN & PRINTED ON A4) */}
      <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border-2 border-emerald-900/25 print:border-none print:p-0 print:rounded-none printable-report">
        <div className={`rounded-2xl bg-white ${
          printLayoutMode === 'single_page'
            ? 'border border-emerald-800/30 p-4 sm:p-6 space-y-3.5 print:p-2 print:space-y-2.5' 
            : 'border border-emerald-800/20 p-5 sm:p-8 space-y-6 print:border-none print:p-0 print:space-y-4'
        }`}>
          {/* Bismillah Header */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 text-emerald-900 mb-1">
              <span className="h-px w-20 bg-gradient-to-r from-transparent via-emerald-800/40 to-transparent"></span>
              <span className="font-heading font-black text-sm sm:text-base tracking-widest text-emerald-950">
                بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
              </span>
              <span className="h-px w-20 bg-gradient-to-r from-transparent via-emerald-800/40 to-transparent"></span>
            </div>
          </div>

          {/* Institutional 3-Column Header */}
          <div className="grid grid-cols-3 items-center border-b-2 border-emerald-900/20 pb-4">
            {/* Right: Organization & Section */}
            <div className="text-right space-y-0.5">
              <div className="text-base sm:text-lg font-black text-emerald-950 font-heading leading-tight">
                منظومة كُتّاب لتحفيظ القرآن الكريم
              </div>
              <div className="text-xs text-slate-600 font-medium">
                إدارة الشؤون التعليمية والمتابعة التربوية
              </div>
              <div className="text-xs text-emerald-800 font-bold">
                حلقة الشيخ: <span className="text-slate-900">{activeSheikh?.name || 'الشيخ المشرف'}</span>
              </div>
            </div>

            {/* Center: Official Emblem */}
            <div className="flex justify-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-800 via-emerald-900 to-teal-950 text-amber-300 flex flex-col items-center justify-center shadow-xs border-2 border-amber-400/40 shrink-0">
                <BookOpen size={22} className="text-amber-300" />
                <span className="text-[10px] font-black tracking-wider text-white mt-0.5">كُتّاب</span>
              </div>
            </div>

            {/* Left: Document Metadata Box */}
            <div className="flex justify-end">
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 sm:p-3 text-right text-xs space-y-0.5 w-full max-w-[190px]">
                <div>
                  <span className="text-slate-500 font-medium">تاريخ التقرير:</span>{' '}
                  <span className="font-bold text-slate-900 font-mono" dir="ltr">
                    {format(today, 'dd/MM/yyyy')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">رقم القيد:</span>{' '}
                  <span className="font-bold text-emerald-900 font-mono">
                    {student.serialNumber}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">حالة الطالب:</span>{' '}
                  <span className="font-bold text-emerald-700">منتظم بالحلقة</span>
                </div>
              </div>
            </div>
          </div>

          {/* Document Title Banner with Safe Bidi Date Display */}
          <div className="text-center">
            <div className="inline-block bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-900 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-2xl shadow-sm border border-emerald-700/50 max-w-2xl w-full">
              <h2 className="text-base sm:text-lg font-black font-heading tracking-wide">
                تقرير الأداء والمتابعة الدورية للطالب (نسخة ولي الأمر)
              </h2>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-emerald-100 font-bold mt-1">
                <span>عن الفترة من:</span>
                <span dir="ltr" className="font-mono bg-white/20 px-2.5 py-0.5 rounded-lg text-white font-black">
                  {formatDateDisplay(startDate)}
                </span>
                <span>إلى:</span>
                <span dir="ltr" className="font-mono bg-white/20 px-2.5 py-0.5 rounded-lg text-white font-black">
                  {formatDateDisplay(endDate)}
                </span>
                <span className="text-amber-300 font-black">({stats?.totalDays || days.length} يوماً)</span>
              </div>
            </div>
          </div>

          {/* Student & Guardian Info Card */}
          <div className="bg-gradient-to-br from-emerald-50/50 via-slate-50/50 to-amber-50/20 rounded-2xl border-2 border-emerald-900/15 p-4 sm:p-5 print-avoid-break">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-slate-500 block font-bold text-[11px] mb-0.5">اسم الطالب الرباعي:</span>
                <span className="text-sm font-black text-slate-900 font-heading block">{student.name}</span>
              </div>

              <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-slate-500 block font-bold text-[11px] mb-0.5">اسم ولي الأمر:</span>
                <span className="text-sm font-black text-slate-900 block">{student.guardianName || 'ولي أمر الطالب'}</span>
              </div>

              <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-slate-500 block font-bold text-[11px] mb-0.5">رقم هاتف ولي الأمر:</span>
                <span className="text-xs font-mono font-bold text-slate-800 block" dir="ltr">
                  {student.guardianPhone || 'غير مسجل'}
                </span>
              </div>

              <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-slate-500 block font-bold text-[11px] mb-0.5">المرحلة القرآنية الحالية:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-950 font-black text-xs border border-emerald-200">
                    <Layers size={13} className="text-emerald-700" />
                    <span>{stage}</span>
                  </span>
                  {student.isKhatim && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-950 font-black text-xs border border-amber-300">
                      <Crown size={12} className="text-amber-600" />
                      <span>خاتم ({getKhatmahLabel(student.khatmahCount)})</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="col-span-2 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-slate-500 block font-bold text-[11px] mb-0.5 flex items-center gap-1">
                  <BookOpen size={13} className="text-emerald-700" />
                  <span>آخر موضع محفوظ (المستوى المعتمد بالحلقة):</span>
                </span>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black text-emerald-950">
                    {student.currentReach ? formatPart(student.currentReach) : 'بداية المصحف الشريف'}
                  </span>
                  {student.startReach && (
                    <span className="text-[11px] text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-bold inline-flex items-center gap-1">
                      <Bookmark size={10} className="text-amber-600" />
                      <span>نقطة البداية عند الالتحاق: {formatPart(student.startReach)}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="col-span-2 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-slate-500 block font-bold text-[11px] mb-0.5 flex items-center gap-1">
                  <Repeat size={13} className="text-teal-700" />
                  <span>ورد المراجعة والتثبيت المعتمد:</span>
                </span>
                <span className="text-xs font-black text-teal-950">
                  {student.currentRevisionFrom || student.currentRevisionTo ? (
                    `من ${formatPart(student.currentRevisionFrom) || '-'} إلى ${formatPart(student.currentRevisionTo) || '-'}`
                  ) : (
                    'لم يتم تحديد ورد مراجعة بعد'
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Executive Summary Metrics (6 Cards) */}
          <div className="space-y-2.5 print-avoid-break">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 print:grid-cols-6">
              {/* Metric 1: Attendance Rate */}
              <div className="p-3 rounded-2xl bg-emerald-50/80 border-2 border-emerald-200/90 text-center">
                <span className="text-[11px] font-black text-emerald-900 block mb-0.5">نسبة الالتزام</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-950 font-heading">
                  {stats?.attendanceRate || 0}%
                </span>
                <span className="text-[10px] text-emerald-800 font-bold block mt-0.5">
                  {stats?.attendedDays || 0} من {stats?.workingDays || 0} يوم عمل
                </span>
              </div>

              {/* Metric 2: Attended Days */}
              <div className="p-3 rounded-2xl bg-slate-50 border-2 border-slate-200 text-center">
                <span className="text-[11px] font-black text-slate-700 block mb-0.5">أيام الحضور</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-heading">
                  {stats?.attendedDays || 0}
                </span>
                <span className="text-[10px] text-slate-500 font-bold block mt-0.5">حضر واستفاد</span>
              </div>

              {/* Metric 3: Absent Days */}
              <div className="p-3 rounded-2xl bg-rose-50/70 border-2 border-rose-200/80 text-center">
                <span className="text-[11px] font-black text-rose-900 block mb-0.5">أيام الغياب</span>
                <span className="text-xl sm:text-2xl font-black text-rose-950 font-heading">
                  {stats?.absentDays || 0}
                </span>
                <span className="text-[10px] text-rose-700 font-bold block mt-0.5">غياب عن الحلقة</span>
              </div>

              {/* Metric 4: Holidays */}
              <div className="p-3 rounded-2xl bg-amber-50/70 border-2 border-amber-200/80 text-center">
                <span className="text-[11px] font-black text-amber-900 block mb-0.5">عطلات أسبوعية</span>
                <span className="text-xl sm:text-2xl font-black text-amber-950 font-heading">
                  {stats?.holidayDays || 0}
                </span>
                <span className="text-[10px] text-amber-700 font-bold block mt-0.5">إجازة رسمية</span>
              </div>

              {/* Metric 5: Total Written */}
              <div className="p-3 rounded-2xl bg-teal-50/70 border-2 border-teal-200/80 text-center">
                <span className="text-[11px] font-black text-teal-900 block mb-0.5">
                  المكتوب في اللوح {writingUnit === 'ayah' ? '(بالآيات)' : '(بالأثمان)'}
                </span>
                <span className="text-xl sm:text-2xl font-black text-teal-950 font-heading">
                  {writingUnit === 'ayah' ? stats?.writtenAyahs || 0 : stats?.writtenThumns || 0}
                </span>
                <span className="text-[10px] text-teal-800 font-bold block mt-0.5">
                  {writingUnit === 'ayah' 
                    ? `${stats?.writtenThumns || 0} ثمن تقريباً` 
                    : `${stats?.writtenAyahs || 0} آية تقريباً`}
                </span>
              </div>

              {/* Metric 6: Memorized Portions */}
              <div className="p-3 rounded-2xl bg-indigo-50/70 border-2 border-indigo-200/80 text-center">
                <span className="text-[11px] font-black text-indigo-900 block mb-0.5">المحفوظ والمسَمّع</span>
                <span className="text-xl sm:text-2xl font-black text-indigo-950 font-heading">
                  {stats?.memorizedPortions || 0}
                </span>
                <span className="text-[10px] text-indigo-700 font-bold block mt-0.5">مقاطع مجتازة</span>
              </div>
            </div>

            {/* Granular Activity Distribution Bar */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold pt-1 print:text-[9.5pt]">
              <span className="text-slate-500">تفصيل الأيام بالحلقة:</span>
              <span className="bg-emerald-100/90 text-emerald-950 px-2.5 py-0.5 rounded-lg border border-emerald-300">
                حَفِظَ وكَتَبَ: {stats?.daysMemorizedAndWritten || 0} يوم
              </span>
              <span className="bg-teal-100/90 text-teal-950 px-2.5 py-0.5 rounded-lg border border-teal-300">
                حَفِظَ ولم يكتب: {stats?.daysMemorizedOnly || 0} يوم
              </span>
              <span className="bg-purple-100/90 text-purple-950 px-2.5 py-0.5 rounded-lg border border-purple-300">
                كَتَبَ فقط: {stats?.daysWrittenOnly || 0} يوم
              </span>
              {(stats?.daysAttemptedOnly || 0) > 0 && (
                <span className="bg-amber-100/90 text-amber-950 px-2.5 py-0.5 rounded-lg border border-amber-300">
                  عَرَضَ ولم يحفظ: {stats?.daysAttemptedOnly} يوم
                </span>
              )}
            </div>
          </div>

          {/* Educational Overall Evaluation Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-800 via-teal-900 to-emerald-950 text-white shadow-xs print-avoid-break">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center border border-amber-400/30 shrink-0">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="text-[11px] text-emerald-200 font-bold">التقييم التربوي والقرآني العام للفترة:</div>
                <div className="text-sm sm:text-base font-black text-amber-300 font-heading">
                  {stats?.overallEvaluation || 'ممتاز ومواظب'}
                </div>
              </div>
            </div>
            <div className="text-xs text-emerald-100/90 font-medium flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-300" />
              <span>وثيقة رسمية معتمدة من إدارة الحلقة</span>
            </div>
          </div>

          {/* EITHER: Compact 1-Page Summary OR Full Detailed Daily Table */}
          {printLayoutMode === 'single_page' ? (
            /* ======================================================== */
            /* 1-PAGE COMPACT EXECUTIVE MODE                            */
            /* ======================================================== */
            <div className="space-y-3 print-avoid-break">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-900 font-heading flex items-center gap-1.5">
                  <Award size={15} className="text-emerald-700" />
                  <span>ملخص الإنجازات التفصيلية للجلسات (شهادة صفحة واحدة)</span>
                </h3>
                <span className="text-[10px] text-slate-500 font-bold">
                  إجمالي أيام الفترة: {days.length} يوماً ({activeAttendedDays.length} يوم حضور منجز)
                </span>
              </div>

              {/* If custom holidays occurred during the period, print note in 1-page mode */}
              {days.some((d: any) => d.isCustomHoliday || (d.isHoliday && d.holidayReason)) && (
                <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-950 flex flex-wrap items-center gap-2">
                  <span className="font-bold flex items-center gap-1 text-amber-900">
                    <Calendar size={13} className="text-amber-700" />
                    <span>إجازات خاصة خلال الفترة:</span>
                  </span>
                  {days.filter((d: any) => d.isCustomHoliday || (d.isHoliday && d.holidayReason)).map((ch: any, cIdx: number) => (
                    <span key={cIdx} className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-amber-300/80 text-[11px] font-bold">
                      <span>{ch.dayName} ({formatDateDisplay(ch.date)}):</span>
                      <span className="text-amber-900">{ch.holidayName || 'إجازة'}</span>
                      {ch.holidayReason && <span className="text-slate-600 font-normal">({ch.holidayReason})</span>}
                    </span>
                  ))}
                </div>
              )}

              {/* 3 Overview Highlights Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="font-black text-emerald-950 flex items-center gap-1.5 mb-1">
                    <Check size={13} className="text-emerald-700" />
                    <span>الحفظ الجديد والتسميع</span>
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-1">
                    <div>• المقاطع المجتازة: <span className="font-bold text-slate-900">{stats?.memorizedPortions || 0} مقطع</span></div>
                    <div>• مستوى الإتقان: <span className="font-bold text-emerald-800">{stats?.overallEvaluation || 'ممتاز'}</span></div>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="font-black text-teal-950 flex items-center gap-1.5 mb-1">
                    <Scroll size={13} className="text-teal-700" />
                    <span>الكتابة في اللوح</span>
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-1">
                    <div>
                      • المقدار الإجمالي: <span className="font-bold text-slate-900">
                        {writingUnit === 'ayah' ? `${stats?.writtenAyahs || 0} آية` : `${stats?.writtenThumns || 0} ثمن`}
                      </span>
                    </div>
                    <div>
                      • المعادل: <span className="font-bold text-teal-800">
                        {writingUnit === 'ayah' ? `${stats?.writtenThumns || 0} ثمن تقريباً` : `${stats?.writtenAyahs || 0} آية تقريباً`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="font-black text-indigo-950 flex items-center gap-1.5 mb-1">
                    <Repeat size={13} className="text-indigo-700" />
                    <span>المراجعة والتثبيت</span>
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-1">
                    <div>• جلسات التثبيت: <span className="font-bold text-slate-900">{stats?.revisionSessions || 0} جلسة</span></div>
                    <div>• الورد الحالي: <span className="font-bold text-indigo-900 truncate block">{formatPart(student.currentRevisionFrom) || 'مقرر الحلقة'}</span></div>
                  </div>
                </div>
              </div>

              {/* Compact Active Sessions Snippet Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-emerald-950 text-white font-bold text-[11px]">
                      <th className="py-2 px-2.5 w-24 text-right border-l border-emerald-900/50">التاريخ</th>
                      <th className="py-2 px-2.5 text-right border-l border-emerald-900/50">حالة اليوم</th>
                      <th className="py-2 px-2.5 text-right border-l border-emerald-900/50">الحفظ الجديد والتسميع</th>
                      <th className="py-2 px-2.5 text-right border-l border-emerald-900/50">
                        المكتوب في اللوح {writingUnit === 'ayah' ? '(آيات)' : '(أثمان)'}
                      </th>
                      <th className="py-2 px-2.5 text-right">المراجعة وملاحظات الشيخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {activeAttendedDays.slice(0, 5).map((day: any, idx: number) => (
                      <tr key={idx} className="bg-white hover:bg-slate-50/70">
                        <td className="py-2 px-2.5 font-bold align-top border-l border-slate-200">
                          <div className="text-slate-900">{day.dayName}</div>
                          <div className="text-[10px] text-slate-500 font-mono" dir="ltr">
                            {formatDateDisplay(day.date)}
                          </div>
                        </td>
                        <td className="py-2 px-2.5 align-top border-l border-slate-200">
                          <span className={`inline-flex items-center text-[9.5px] font-black px-1.5 py-0.5 rounded border ${
                            day.activityBadgeColor === 'emerald'
                              ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                              : day.activityBadgeColor === 'teal'
                              ? 'bg-teal-100 text-teal-950 border-teal-300'
                              : day.activityBadgeColor === 'purple'
                              ? 'bg-purple-100 text-purple-950 border-purple-300'
                              : day.activityBadgeColor === 'amber'
                              ? 'bg-amber-100 text-amber-950 border-amber-300'
                              : 'bg-slate-100 text-slate-800 border-slate-300'
                          }`}>
                            {day.activityLabel || 'حاضر'}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 align-top border-l border-slate-200">
                          {day.recitation?.didRecite ? (
                            <div>
                              <span className="font-bold text-slate-900">{day.recitation.text}</span>
                              <span className="mr-1.5 text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                                {day.recitation.status || 'أُنجز'}
                              </span>
                            </div>
                          ) : day.activityType === 'wrote_only' ? (
                            <span className="text-[9.5px] text-slate-400">لم يُسمّع جديداً</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 align-top border-l border-slate-200">
                          {day.writing?.didWrite ? (
                            <div className="text-teal-950 font-bold">
                              {day.writing.parts.slice(0, 1).map((p: string, pIdx: number) => (
                                <span key={pIdx}>{formatPart(p)}</span>
                              ))}
                              <span className="mr-1 text-[9px] text-teal-800 bg-teal-100 px-1.5 py-0.5 rounded font-black">
                                {writingUnit === 'ayah' ? `${day.writing.ayahs || 20} آية` : `${day.writing.thumns || 1} ثمن`}
                              </span>
                            </div>
                          ) : day.activityType === 'recited_only' ? (
                            <span className="text-[9.5px] text-slate-400">لم يكتب باللوح</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 align-top">
                          <div className="text-slate-700">
                            {day.revision?.didReview ? day.revision.text : day.notes || 'حضور ومشاركة طيبة'}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {activeAttendedDays.length > 5 && (
                      <tr className="bg-slate-50 text-[10px] text-slate-500 text-center font-bold">
                        <td colSpan={5} className="py-1.5">
                          تم إنجاز {activeAttendedDays.length} جلسة تعليمية خلال الفترة المحددة (موجز معتمد بصفحة واحدة)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* FULL MULTI-PAGE DETAILED DAY-BY-DAY TABLE                */
            /* ======================================================== */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 font-heading flex items-center gap-2">
                  <Calendar size={16} className="text-emerald-700" />
                  <span>البيان اليومي التفصيلي لسجل الجلسات (كامل الفترة)</span>
                </h3>
                <span className="text-[11px] text-slate-500 font-bold">
                  عرض مفصل لكل يوم في الفترة المحددة ({days.length} يوماً)
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border-2 border-emerald-900/20">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-emerald-950 text-white font-bold">
                      <th className="py-3 px-3 w-28 text-right border-l border-emerald-900/50">اليوم والتاريخ</th>
                      <th className="py-3 px-3 w-36 text-right border-l border-emerald-900/50">حالة الحضور والإنجاز</th>
                      <th className="py-3 px-3 text-right border-l border-emerald-900/50">التسميع (الحفظ الجديد)</th>
                      <th className="py-3 px-3 text-right border-l border-emerald-900/50">
                        الكتابة في اللوح {writingUnit === 'ayah' ? '(بالآيات)' : '(بالأثمان)'}
                      </th>
                      <th className="py-3 px-3 text-right border-l border-emerald-900/50">المراجعة والتثبيت</th>
                      <th className="py-3 px-3 text-right">ملاحظات المحفظ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {days.map((day: any, idx: number) => {
                      const isWeekend = day.isHoliday;
                      const isAttended = day.attendanceType === 'attended';
                      const isAbsent = day.attendanceType === 'absent';

                      if (isWeekend) {
                        const isCustom = day.isCustomHoliday || !!day.holidayReason;
                        const holidayTitle = day.holidayName || (isCustom ? 'إجازة خاصة' : 'عطلة أسبوعية رسمية للمركز');
                        return (
                          <tr key={idx} className="bg-amber-50/60 print-avoid-break">
                            <td className="py-2.5 sm:py-3 px-3 align-top font-bold border-l border-slate-200">
                              <div className="text-amber-950 font-black">{day.dayName}</div>
                              <div className="text-[10px] text-amber-800 font-mono" dir="ltr">
                                {formatDateDisplay(day.date)}
                              </div>
                            </td>
                            <td colSpan={5} className="py-2.5 sm:py-3 px-3 align-middle">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-900 bg-amber-100/90 px-3 py-1 rounded-lg border border-amber-300">
                                  <Calendar size={13} className="text-amber-700" />
                                  <span>{holidayTitle}</span>
                                </span>
                                {day.holidayReason && (
                                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 bg-white px-3 py-1 rounded-lg border border-amber-300/80 shadow-2xs">
                                    <span className="text-amber-800 font-black">السبب:</span>
                                    <span>{day.holidayReason}</span>
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      if (isAbsent) {
                        return (
                          <tr key={idx} className="bg-rose-50/40 print-avoid-break">
                            <td className="py-2.5 sm:py-3 px-3 align-top font-bold border-l border-slate-200">
                              <div className="text-rose-950 font-black">{day.dayName}</div>
                              <div className="text-[10px] text-rose-800 font-mono" dir="ltr">
                                {formatDateDisplay(day.date)}
                              </div>
                            </td>
                            <td className="py-2.5 sm:py-3 px-3 align-top border-l border-slate-200">
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-900 bg-rose-100 px-2 py-0.5 rounded-lg border border-rose-300">
                                <XCircle size={12} className="text-rose-600" />
                                <span>لم يحضر (غائب)</span>
                              </span>
                            </td>
                            <td colSpan={4} className="py-2.5 sm:py-3 px-3 align-middle text-rose-700 text-xs italic font-medium">
                              غائب عن جلسة الحلقة
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr 
                          key={idx} 
                          className={`transition-colors print-avoid-break ${isAttended ? 'hover:bg-slate-50/70' : 'bg-slate-50/20'}`}
                        >
                          {/* 1. Date & Day */}
                          <td className="py-2.5 sm:py-3 px-3 align-top font-bold border-l border-slate-200">
                            <div className="text-slate-900 font-black">{day.dayName}</div>
                            <div className="text-[10px] text-slate-500 font-mono" dir="ltr">
                              {formatDateDisplay(day.date)}
                            </div>
                          </td>

                          {/* 2. Attendance Status & Activity Badge */}
                          <td className="py-2.5 sm:py-3 px-3 align-top border-l border-slate-200">
                            {isAttended ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-900 bg-emerald-100/90 px-2 py-0.5 rounded-lg border border-emerald-300">
                                  <Check size={12} className="text-emerald-700" />
                                  <span>حاضر</span>
                                </span>
                                {day.activityLabel && day.activityType !== 'attended_only' && (
                                  <div>
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md border ${
                                      day.activityBadgeColor === 'emerald'
                                        ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                                        : day.activityBadgeColor === 'teal'
                                        ? 'bg-teal-100 text-teal-950 border-teal-300'
                                        : day.activityBadgeColor === 'purple'
                                        ? 'bg-purple-100 text-purple-950 border-purple-300'
                                        : day.activityBadgeColor === 'amber'
                                        ? 'bg-amber-100 text-amber-950 border-amber-300'
                                        : day.activityBadgeColor === 'indigo'
                                        ? 'bg-indigo-100 text-indigo-950 border-indigo-300'
                                        : 'bg-slate-100 text-slate-800 border-slate-300'
                                    }`}>
                                      {day.activityLabel}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">لا توجد حلقة</span>
                            )}
                          </td>

                          {/* 3. Recitation / Memorization */}
                          <td className="py-2.5 sm:py-3 px-3 align-top border-l border-slate-200">
                            {day.recitation?.didRecite ? (
                              <div className="space-y-1">
                                <div className="font-black text-slate-900 leading-snug">
                                  {day.recitation.text}
                                </div>
                                <span className="inline-block text-[10px] font-black text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                                  {day.recitation.status || 'تم التسميع بنجاح'}
                                </span>
                              </div>
                            ) : day.activityType === 'wrote_only' ? (
                              <span className="inline-block text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                لم يُسمّع جديداً (كتابة فقط)
                              </span>
                            ) : day.activityType === 'attempted_recitation' ? (
                              <div className="space-y-0.5">
                                <div className="text-amber-900 font-bold text-xs">عرض ولم يحفظ</div>
                                <span className="inline-block text-[10px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  بحاجة لإعادة وتثبيت
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>

                          {/* 4. Tablet Writing (Thumn vs Ayah) */}
                          <td className="py-2.5 sm:py-3 px-3 align-top border-l border-slate-200">
                            {day.writing?.didWrite ? (
                              <div className="space-y-1.5">
                                <div className="font-black text-teal-950 leading-snug">
                                  {day.writing.parts.map((p: string, pIdx: number) => (
                                    <div key={pIdx} className="text-xs">
                                      • {formatPart(p)}
                                    </div>
                                  ))}
                                </div>
                                <div className="inline-flex items-center gap-1 text-[10px] text-teal-950 font-black bg-teal-100 px-2 py-0.5 rounded-md border border-teal-300">
                                  <Scroll size={11} className="text-teal-800" />
                                  <span>
                                    {writingUnit === 'ayah'
                                      ? `المقدار: ${day.writing.ayahs || 20} آية`
                                      : `المقدار: ${day.writing.thumns || 1} ثمن`}
                                  </span>
                                </div>
                              </div>
                            ) : day.activityType === 'recited_only' ? (
                              <span className="inline-block text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                لم يكتب في اللوح اليوم
                              </span>
                            ) : day.writing?.text === 'لم يكتب في اللوح' ? (
                              <span className="text-slate-500 text-xs font-medium">لم يكتب في اللوح</span>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>

                          {/* 5. Revision */}
                          <td className="py-2.5 sm:py-3 px-3 align-top border-l border-slate-200">
                            {day.revision?.didReview ? (
                              <div className="font-bold text-slate-900 leading-snug text-xs">
                                {day.revision.text}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>

                          {/* 6. Notes & Sheikh */}
                          <td className="py-2.5 sm:py-3 px-3 align-top text-xs">
                            {day.notes ? (
                              <div className="text-slate-800 italic bg-slate-50 p-2 rounded-xl border border-slate-200 mb-1">
                                {day.notes}
                              </div>
                            ) : null}
                            {day.sheikhName && (
                              <div className="text-[10px] text-slate-500 font-medium">
                                المشرف: <span className="text-slate-900 font-bold">{day.sheikhName}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Guidance Message for the Guardian */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-slate-50 to-emerald-50 border border-emerald-200 text-xs leading-relaxed text-slate-700 space-y-1 print-avoid-break">
            <div className="font-black text-emerald-950 flex items-center gap-1.5 font-heading">
              <Award size={15} className="text-emerald-700" />
              <span>رسالة وتوجيه لولي الأمر الكريم:</span>
            </div>
            <p className="text-[11px] sm:text-xs">
              حفظ كتاب الله تعالى أمانة مباركة وشرف عظيم، ونجاح الطالب وتثبيته يعتمد بعد توفيق الله على المتابعة المنزلية المستمرة، والحرص على تسميع الألواح المكتوبة ومراجعة المحفوظ السابق يومياً. شكر الله حرصكم المبارك ودعمكم المتواصل لابنكم.
            </p>
          </div>

          {/* Official Signatures and Stamp Box */}
          <div className="pt-4 sm:pt-6 border-t-2 border-emerald-900/20 grid grid-cols-3 gap-4 sm:gap-6 text-center text-xs print-avoid-break">
            <div className="space-y-4 sm:space-y-6">
              <span className="font-black text-slate-700 block">المشرف على الحلقة</span>
              <div className="font-black text-slate-900 text-sm font-heading">
                {activeSheikh?.name || 'فضيلة الشيخ المحفظ'}
              </div>
              <div className="text-[10px] text-slate-400 font-medium">التوقيع: .....................</div>
            </div>

            <div className="space-y-3 sm:space-y-5 border-x-2 border-slate-200 px-2 sm:px-3">
              <span className="font-black text-slate-700 block">إدارة الكُتّاب والختم الرسمي</span>
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-emerald-700/60 mx-auto flex flex-col items-center justify-center text-[9px] text-emerald-800 font-bold bg-emerald-50/50">
                <span>الختم</span>
                <span>الرسمي</span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">الاعتماد: .....................</div>
            </div>

            <div className="space-y-4 sm:space-y-6">
              <span className="font-black text-slate-700 block">ولي الأمر (بالعلم والمتابعة)</span>
              <div className="font-black text-slate-900 text-sm font-heading">
                {student.guardianName || 'ولي أمر الطالب'}
              </div>
              <div className="text-[10px] text-slate-400 font-medium">التوقيع: .....................</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

