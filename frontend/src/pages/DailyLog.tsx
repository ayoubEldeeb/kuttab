import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Check, 
  Calendar, 
  Save, 
  X, 
  CalendarClock, 
  CheckCircle2, 
  Send,
  BookOpen,
  FastForward,
  Plus,
  Scroll,
  BookMarked,
  History,
  CalendarDays,
  AlertCircle,
  Info,
  ChevronLeft
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { format, subDays, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import { QuranSelector, SURAHS } from '../components/ui/quran-selector';
import { formatPart } from '../utils/formatPart';
import { getNextThumn, formatRelativeArabicDate, convertArabicToEnglishNumbers } from '../utils/quranHelpers';
import { ATHMAN } from '../components/ui/quran-data';
import api from '../utils/api';
import { useThemeAndSettings } from '../context/ThemeAndSettingsContext';

const STATUS_OPTIONS = [
  { label: 'عرض وحفظ وكتب', color: 'emerald', text: 'عرض وحفظ وكتب' },
  { label: 'عرض وحفظ ولم يكتب', color: 'teal', text: 'عرض وحفظ ولم يكتب' },
  { label: 'كتب فقط', color: 'purple', text: 'كتب فقط' },
  { label: 'عرض ولم يحفظ', color: 'amber', text: 'عرض ولم يحفظ' },
  { label: 'لم يحضر', color: 'rose', text: 'لم يحضر' },
];

export const shouldShowRecitation = (status: string) => {
  return status === 'عرض وحفظ وكتب' || status === 'عرض وحفظ ولم يكتب' || status === 'عرض ولم يحفظ';
};

export const shouldShowWriting = (status: string) => {
  return status === 'عرض وحفظ وكتب' || status === 'كتب فقط';
};

export const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'عرض وحفظ وكتب':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold';
    case 'عرض وحفظ ولم يكتب':
      return 'bg-teal-50 text-teal-800 border-teal-200 font-bold';
    case 'كتب فقط':
      return 'bg-purple-50 text-purple-800 border-purple-200 font-bold';
    case 'عرض ولم يحفظ':
      return 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
    case 'لم يحضر':
      return 'bg-rose-50 text-rose-800 border-rose-200 font-bold';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 font-bold';
  }
};

export const getStatusDescription = (status: string) => {
  switch (status) {
    case 'عرض وحفظ وكتب':
      return 'أتم الطالب التسميع بنجاح، وسجل أثماناً جديدة في لوحه للجلسة القادمة.';
    case 'عرض وحفظ ولم يكتب':
      return 'أتم الطالب التسميع بنجاح اليوم، ولم يكتب أثماناً جديدة في لوحه.';
    case 'كتب فقط':
      return 'حضر الطالب وكتب في لوحه القرآني دون تسميع اليوم (سيكون هذا المقدار مقرراً لتسميعه القادم).';
    case 'عرض ولم يحفظ':
      return 'عرض الطالب المقدار ولم يتقنه، سيعيد نفس المقدار في الجلسة القادمة ولن ينتقل لأثمان جديدة.';
    default:
      return '';
  }
};

export default function DailyLog() {
  const { activeSheikh, getHolidayInfo } = useThemeAndSettings();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'recorded' | 'unrecorded' | 'attended' | 'absent'>('all');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const queryClient = useQueryClient();

  const [activeFormId, setActiveFormId] = useState<number | null>(null);
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<any | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'10' | '30' | '60' | 'all'>('10');

  const [formData, setFormData] = useState({
    status: '',
    fromPart: '',
    toPart: '',
    recitedAthman: [] as string[],
    entryMode: 'athman' as 'athman' | 'range',
    notes: '',
    writtenParts: [] as string[],
  });
  const [writingMode, setWritingMode] = useState<'thumn' | 'ayah'>('thumn');
  const [ayahInput, setAyahInput] = useState({ surah: 'النبأ', count: '5', fromAyah: '1', toAyah: '5' });

  // Completely reset active student form and selection when switching dates or canceling
  const resetForm = () => {
    setActiveFormId(null);
    setFormData({
      status: '',
      fromPart: '',
      toPart: '',
      recitedAthman: [],
      entryMode: 'athman',
      notes: '',
      writtenParts: [],
    });
    setWritingMode('thumn');
    setAyahInput({ surah: 'النبأ', count: '5', fromAyah: '1', toAyah: '5' });
  };

  // Automatically clear active form/selection whenever date changes so state is never carried over
  useEffect(() => {
    resetForm();
  }, [date]);

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const isSelectedToday = date === todayStr;

  const handleSetToday = () => {
    resetForm();
    setDate(todayStr);
  };
  const handleSetYesterday = () => {
    resetForm();
    setDate(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  };
  const handlePrevDay = () => {
    resetForm();
    setDate(format(subDays(new Date(date + 'T12:00:00'), 1), 'yyyy-MM-dd'));
  };
  const handleNextDay = () => {
    resetForm();
    setDate(format(addDays(new Date(date + 'T12:00:00'), 1), 'yyyy-MM-dd'));
  };

  const { data: students, isLoading } = useQuery({
    queryKey: ['students', date],
    queryFn: async () => {
      const res = await api.get(`/students?date=${date}`);
      return res.data;
    },
  });

  const addHistoryMutation = useMutation({
    mutationFn: async (data: any) => {
      await api.post(`/students/${data.studentId}/history`, data);
    },
    onSuccess: () => {
      toast.success('تم حفظ سجل الطالب بنجاح');
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      resetForm();
    },
    onError: () => {
      toast.error('حدث خطأ أثناء حفظ السجل');
    },
  });

  const dateStr = date;

  const handleStatusClick = (studentId: number, opt: string, todayHistory?: any, student?: any) => {
    if (opt === 'لم يحضر') {
      addHistoryMutation.mutate({ 
        studentId, 
        status: opt, 
        date, 
        type: 'تسميع',
        sheikhId: activeSheikh?.id || null,
        sheikhName: activeSheikh?.name || null,
      });
      resetForm();
    } else {
      if (activeFormId === studentId && formData.status === opt) {
        resetForm();
      } else {
        let initialFrom = '';
        let initialTo = '';
        let initialAthman: string[] = [];
        let initialWrittenParts: string[] = [];
        let initialNotes = '';

        if (todayHistory) {
          // Editing existing record for today
          initialFrom = todayHistory.fromPart || '';
          initialTo = todayHistory.toPart || '';
          initialNotes = todayHistory.notes || '';
          try {
            if (todayHistory.writtenParts) {
              const parsed = JSON.parse(todayHistory.writtenParts);
              initialWrittenParts = Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
            }
          } catch {
            initialWrittenParts = [];
          }

          if (initialFrom && initialTo && initialFrom !== initialTo) {
            initialAthman = [initialFrom, initialTo];
          } else if (initialFrom) {
            initialAthman = [initialFrom];
          } else {
            initialAthman = [''];
          }
        } else {
          // Find the most recent previous session's history for this student
          const sortedPastHistories = (student?.histories || [])
            .filter((h: any) => h.date < dateStr && h.status !== 'لم يحضر')
            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
          const lastHistory = sortedPastHistories[0];

          let previousWrittenParts: string[] = [];
          if (lastHistory?.writtenParts) {
            try {
              const parsed = JSON.parse(lastHistory.writtenParts);
              if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]) {
                previousWrittenParts = parsed;
              }
            } catch {
              previousWrittenParts = [];
            }
          }

          // Case 1: Recitation initialization (for statuses with recitation)
          if (shouldShowRecitation(opt)) {
            if (previousWrittenParts.length > 0) {
              initialFrom = previousWrittenParts[0];
              initialTo = previousWrittenParts[previousWrittenParts.length - 1];
              initialAthman = [...previousWrittenParts];
            } else if (lastHistory?.nextReviewFrom || lastHistory?.nextReviewTo) {
              initialFrom = lastHistory.nextReviewFrom || lastHistory.nextReviewTo || '';
              initialTo = lastHistory.nextReviewTo || lastHistory.nextReviewFrom || '';
              initialAthman = initialFrom && initialTo && initialFrom !== initialTo 
                ? [initialFrom, initialTo] 
                : (initialFrom ? [initialFrom] : ['']);
            } else if (student?.currentReach) {
              const nextThumn = getNextThumn(student.currentReach);
              initialFrom = nextThumn;
              initialTo = nextThumn;
              initialAthman = [nextThumn];
            } else {
              initialFrom = ATHMAN[0];
              initialTo = ATHMAN[0];
              initialAthman = [ATHMAN[0]];
            }
          } else {
            // Did not recite (كتب فقط)
            initialFrom = '';
            initialTo = '';
            initialAthman = [''];
          }

          // Case 2: Writing initialization (ONLY for عرض وحفظ وكتب or كتب فقط)
          if (opt === 'عرض وحفظ وكتب') {
            const recitedEnd = initialTo || initialFrom || (initialAthman.length > 0 ? initialAthman[initialAthman.length - 1] : '');
            const nextToWrite = getNextThumn(recitedEnd);
            initialWrittenParts = [nextToWrite];
          } else if (opt === 'كتب فقط') {
            const nextToWrite = getNextThumn(student?.currentReach);
            initialWrittenParts = [nextToWrite];
          } else {
            // عرض وحفظ ولم يكتب or عرض ولم يحفظ -> NO written parts
            initialWrittenParts = [];
          }
        }

        setActiveFormId(studentId);
        setFormData({
          status: opt,
          fromPart: initialFrom,
          toPart: initialTo,
          recitedAthman: initialAthman.length > 0 ? initialAthman : [''],
          entryMode: 'athman',
          notes: initialNotes,
          writtenParts: initialWrittenParts.length > 0 ? initialWrittenParts : [''],
        });
      }
    }
  };

  // Handlers for "ما تم تسميعه اليوم"
  const handleNextThumnForRecitation = (student: any) => {
    const cleanAthman = formData.recitedAthman.filter(Boolean);
    const lastPart = cleanAthman[cleanAthman.length - 1] || formData.toPart || formData.fromPart || student?.currentReach;
    const next = getNextThumn(lastPart);

    if (formData.entryMode === 'athman') {
      if (formData.recitedAthman.length === 1 && !formData.recitedAthman[0]) {
        setFormData((prev) => ({
          ...prev,
          recitedAthman: [next],
          fromPart: next,
          toPart: next,
        }));
      } else {
        const newAthman = [...formData.recitedAthman, next];
        setFormData((prev) => ({
          ...prev,
          recitedAthman: newAthman,
          fromPart: newAthman[0],
          toPart: next,
        }));
      }
    } else {
      if (!formData.fromPart) {
        setFormData((prev) => ({
          ...prev,
          fromPart: next,
          toPart: next,
          recitedAthman: [next],
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          toPart: next,
          recitedAthman: [prev.fromPart, next],
        }));
      }
    }
    toast.success(`تم اختيار: ${formatPart(next)}`);
  };

  const handleAddThumnForRecitation = (student: any) => {
    const cleanAthman = formData.recitedAthman.filter(Boolean);
    const lastPart = cleanAthman[cleanAthman.length - 1] || formData.toPart || formData.fromPart || student?.currentReach;
    const next = getNextThumn(lastPart);
    const newAthman = [...formData.recitedAthman, next];
    setFormData((prev) => ({
      ...prev,
      recitedAthman: newAthman,
      fromPart: newAthman[0],
      toPart: next,
    }));
  };

  const handleRecitedThumnChange = (index: number, val: string) => {
    const newAthman = [...formData.recitedAthman];
    newAthman[index] = val;
    const clean = newAthman.filter(Boolean);
    setFormData((prev) => ({
      ...prev,
      recitedAthman: newAthman,
      fromPart: clean[0] || '',
      toPart: clean[clean.length - 1] || clean[0] || '',
    }));
  };

  const handleRemoveRecitedThumn = (index: number) => {
    const newAthman = formData.recitedAthman.filter((_, i) => i !== index);
    const clean = newAthman.filter(Boolean);
    setFormData((prev) => ({
      ...prev,
      recitedAthman: newAthman.length > 0 ? newAthman : [''],
      fromPart: clean[0] || '',
      toPart: clean[clean.length - 1] || clean[0] || '',
    }));
  };

  // Handlers for "ما تم كتابته في اللوح اليوم (الأثمان)"
  const handleNextThumnForWriting = (student: any) => {
    const clean = formData.writtenParts.filter(Boolean);
    const lastPart = clean[clean.length - 1] || formData.toPart || formData.fromPart || student?.currentReach;
    const next = getNextThumn(lastPart);
    if (formData.writtenParts.length === 1 && !formData.writtenParts[0]) {
      setFormData((prev) => ({ ...prev, writtenParts: [next] }));
    } else {
      setFormData((prev) => ({ ...prev, writtenParts: [...prev.writtenParts, next] }));
    }
    toast.success(`تمت إضافة للكتابة: ${formatPart(next)}`);
  };

  // Compute session stats
  const totalStudents = students?.length || 0;
  const recordedStudents = students?.filter((s: any) => s.histories?.some((h: any) => h.date.startsWith(dateStr))) || [];
  const recordedCount = recordedStudents.length;
  const attendedCount = students?.filter((s: any) => {
    const th = s.histories?.find((h: any) => h.date.startsWith(dateStr));
    return th && th.status !== 'لم يحضر';
  }).length || 0;
  const absentCount = students?.filter((s: any) => {
    const th = s.histories?.find((h: any) => h.date.startsWith(dateStr));
    return th && th.status === 'لم يحضر';
  }).length || 0;

  // Filter sessions for the 10-days popup
  const filteredSessions = useMemo(() => {
    if (!selectedStudentForHistory) return [];
    const histories = [...(selectedStudentForHistory.histories || [])].sort(
      (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    if (historyFilter === '10') {
      return histories.slice(0, 10);
    } else if (historyFilter === '30') {
      return histories.slice(0, 30);
    } else if (historyFilter === '60') {
      return histories.slice(0, 60);
    }
    return histories;
  }, [selectedStudentForHistory, historyFilter]);

  const historyMetrics = useMemo(() => {
    const total = filteredSessions.length;
    const attended = filteredSessions.filter((s: any) => s.status !== 'لم يحضر').length;
    const absent = filteredSessions.filter((s: any) => s.status === 'لم يحضر').length;
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0;
    const memorized = filteredSessions.filter(
      (s: any) => s.status === 'عرض وحفظ وكتب' || s.status === 'عرض وحفظ ولم يكتب'
    ).length;
    return { total, attended, absent, rate, memorized };
  }, [filteredSessions]);

  // Filter students
  const filtered = students?.filter((s: any) => {
    const term = convertArabicToEnglishNumbers(search);
    const matchesSearch = s.name.includes(term) || s.serialNumber.includes(term);
    const todayH = s.histories?.find((h: any) => h.date.startsWith(dateStr));

    let matchesStatus = true;
    if (statusFilter === 'recorded') matchesStatus = !!todayH;
    else if (statusFilter === 'unrecorded') matchesStatus = !todayH;
    else if (statusFilter === 'attended') matchesStatus = !!todayH && todayH.status !== 'لم يحضر';
    else if (statusFilter === 'absent') matchesStatus = !!todayH && todayH.status === 'لم يحضر';

    return matchesSearch && matchesStatus;
  });

  const getButtonClass = (opt: string, isSelected: boolean) => {
    if (isSelected) {
      switch (opt) {
        case 'عرض وحفظ وكتب':
          return 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20';
        case 'عرض وحفظ ولم يكتب':
          return 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/20';
        case 'كتب فقط':
          return 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20';
        case 'عرض ولم يحفظ':
          return 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20';
        case 'لم يحضر':
          return 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20';
        default:
          return 'bg-slate-800 text-white border-slate-800';
      }
    } else {
      switch (opt) {
        case 'عرض وحفظ وكتب':
          return 'bg-emerald-50/50 text-emerald-800 border-emerald-200/70 hover:bg-emerald-100/70 hover:border-emerald-300';
        case 'عرض وحفظ ولم يكتب':
          return 'bg-teal-50/50 text-teal-800 border-teal-200/70 hover:bg-teal-100/70 hover:border-teal-300';
        case 'كتب فقط':
          return 'bg-purple-50/50 text-purple-800 border-purple-200/70 hover:bg-purple-100/70 hover:border-purple-300';
        case 'عرض ولم يحفظ':
          return 'bg-amber-50/50 text-amber-800 border-amber-200/70 hover:bg-amber-100/70 hover:border-amber-300';
        case 'لم يحضر':
          return 'bg-rose-50/50 text-rose-800 border-rose-200/70 hover:bg-rose-100/70 hover:border-rose-300';
        default:
          return 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50';
      }
    }
  };

  const shareToWhatsapp = (student: any, todayH: any) => {
    if (!student.guardianPhone) {
      toast.error('لم يتم تسجيل رقم هاتف ولي الأمر لهذا الطالب');
      return;
    }
    const cleanPhone = student.guardianPhone.replace(/\D/g, '');
    const dateArabic = new Intl.DateTimeFormat('ar-EG', { dateStyle: 'full' }).format(new Date(date));
    
    let text = `السلام عليكم ورحمة الله وبركاته،\nولي أمر الطالب/ة: *${student.name}*\nتحية طيبة من إدارة حلقات تحفيظ القرآن الكريم.\n\n`;
    text += `📅 *تقرير متابعة اليوم:* ${dateArabic}\n`;
    text += `📌 *الحالة اليوم:* ${todayH.status}\n`;
    
    if (todayH.status === 'كتب فقط') {
      text += `📖 *التسميع:* لم يُسَمِّع اليوم (حضر للكتابة في اللوح فقط).\n`;
    } else if (todayH.status === 'عرض ولم يحفظ') {
      const span = todayH.fromPart === todayH.toPart
        ? formatPart(todayH.fromPart)
        : `من ${formatPart(todayH.fromPart)} إلى ${formatPart(todayH.toPart)}`;
      text += `📖 *المقدار المعروض اليوم:* ${span}\n`;
      text += `⚠️ *النتيجة:* بحاجة لإعادة وتثبيت نفس المقدار بالجلسة القادمة.\n`;
    } else if (todayH.fromPart || todayH.toPart) {
      const span = todayH.fromPart === todayH.toPart
        ? formatPart(todayH.fromPart)
        : `من ${formatPart(todayH.fromPart)} إلى ${formatPart(todayH.toPart)}`;
      text += `📖 *ما تم تسميعه اليوم:* ${span}\n`;
    }

    if (todayH.status === 'عرض وحفظ ولم يكتب') {
      text += `✍️ *الكتابة في اللوح:* لم يكتب أثماناً جديدة اليوم.\n`;
    } else if (todayH.writtenParts) {
      try {
        const wp = JSON.parse(todayH.writtenParts);
        if (wp.length > 0 && wp[0]) {
          text += `✍️ *ما تم كتابته في اللوح (للتسميع القادم):* ${wp.map((p: string) => formatPart(p)).join('، ')}\n`;
        }
      } catch {}
    }

    if (todayH.notes) {
      text += `💬 *ملاحظات المعلم:* ${todayH.notes}\n`;
    }
    text += `\nنسأل الله أن يبارك في حفظه وأن يجعله من أهل القرآن.`;

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto pb-16">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center font-bold shrink-0 shadow-xs">
              <CalendarClock size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 font-heading">السجل اليومي</h2>
              <p className="text-slate-400 text-xs mt-0.5">متابعة الحفظ الجديد والتسميع والكتابة في اللوح يومياً</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          {/* Date Selector & Fast Shortcuts */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 w-full sm:w-auto">
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

            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-slate-200/70">
              <button
                type="button"
                onClick={handlePrevDay}
                title="اليوم السابق"
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} className="rotate-180" />
              </button>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  resetForm();
                  setDate(e.target.value);
                }}
                className="bg-transparent text-xs sm:text-sm font-bold text-slate-800 outline-none px-1 cursor-pointer"
              />
              <button
                type="button"
                onClick={handleNextDay}
                title="اليوم التالي"
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute right-3.5 top-3 text-slate-400" size={18} />
            <Input
              className="pr-10 w-full rounded-2xl h-11 bg-slate-50 border-slate-200 text-sm"
              placeholder="بحث بالاسم أو الرقم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Holiday Alert Banner if Date is Holiday */}
      {(() => {
        const hInfo = getHolidayInfo(date);
        if (!hInfo.isHoliday) return null;
        return (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in duration-300">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-amber-700 shrink-0" />
              <span>
                تنبيه: التاريخ المحدد مصنف كـ «{hInfo.holidayName || 'عطلة رسمية'}» في النظام
                {hInfo.holidayReason ? ` (السبب: ${hInfo.holidayReason})` : ''}، ولن يؤثر غياب الطلاب سلباً على نسبة الحضور العامة.
              </span>
            </div>
            <span className="text-[10px] font-bold bg-amber-200/80 px-2.5 py-0.5 rounded-lg text-amber-950 shrink-0 self-start sm:self-auto">
              {hInfo.holidayName || 'عطلة رسمية'}
            </span>
          </div>
        );
      })()}

      {/* Session Quick Metrics Banner */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">الطلاب المسجلون</span>
            <span className="text-base font-black text-slate-800">{totalStudents}</span>
          </div>
          <div className="w-px h-8 bg-slate-200"></div>
          <div>
            <span className="text-slate-400 block font-medium">تم الرصد اليوم</span>
            <span className="text-base font-black text-emerald-700">
              {recordedCount} <span className="text-xs font-normal text-slate-400">({totalStudents > 0 ? Math.round((recordedCount / totalStudents) * 100) : 0}%)</span>
            </span>
          </div>
          <div className="w-px h-8 bg-slate-200"></div>
          <div>
            <span className="text-slate-400 block font-medium">الحاضرون</span>
            <span className="text-base font-black text-teal-700">{attendedCount}</span>
          </div>
          <div className="w-px h-8 bg-slate-200"></div>
          <div>
            <span className="text-slate-400 block font-medium">الغائبون</span>
            <span className="text-base font-black text-rose-600">{absentCount}</span>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pt-2 md:pt-0">
          {[
            { key: 'all', label: 'الكل' },
            { key: 'unrecorded', label: 'لم يُرصد بعد' },
            { key: 'recorded', label: 'تم الرصد' },
            { key: 'attended', label: 'حاضر' },
            { key: 'absent', label: 'غائب' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === tab.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Student Cards List */}
      <div className="space-y-4">
        {isLoading && (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 text-slate-400">
            جاري تحميل سجلات الطلاب...
          </div>
        )}

        {filtered?.length === 0 && !isLoading && (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 text-slate-400">
            لا يوجد طلاب يطابقون خيارات البحث والتصفية المحددة.
          </div>
        )}

        {filtered?.map((student: any) => {
          const todayHistory = student.histories?.find((h: any) => h.date.startsWith(dateStr));
          
          // All past histories strictly before the selected date, sorted desc
          const sortedPastHistories = (student.histories || [])
            .filter((h: any) => h.date < dateStr)
            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const lastPastRecord = sortedPastHistories[0];
          const pastDateRelative = lastPastRecord ? formatRelativeArabicDate(lastPastRecord.date, dateStr) : null;

          // Find last attended session where writing was recorded
          const lastAttendedWithWriting = sortedPastHistories.find((h: any) => {
            if (h.status === 'لم يحضر') return false;
            if (!h.writtenParts) return false;
            try {
              const p = JSON.parse(h.writtenParts);
              return Array.isArray(p) && p.length > 0 && !!p[0];
            } catch {
              return false;
            }
          });

          let previousWrittenList: string[] = [];
          if (lastAttendedWithWriting?.writtenParts) {
            try {
              const p = JSON.parse(lastAttendedWithWriting.writtenParts);
              if (Array.isArray(p) && p.length > 0 && p[0]) previousWrittenList = p;
            } catch {}
          }
          const expectedToday = previousWrittenList.length > 0
            ? previousWrittenList.map((w: string) => formatPart(w)).join('، ')
            : (lastPastRecord?.nextReviewFrom ? formatPart(lastPastRecord.nextReviewFrom) : '');

          const isExpanded = activeFormId === student.id;

          return (
            <div
              key={student.id}
              className={`bg-white p-6 rounded-3xl border transition-all duration-200 ${
                todayHistory
                  ? 'border-slate-200/90 shadow-sm'
                  : 'border-dashed border-slate-300 hover:border-slate-400 shadow-xs'
              }`}
            >
              {/* Header / Student Info & Action Buttons */}
              <div className="flex flex-col xl:flex-row gap-6 justify-between items-start">
                {/* Left Side: Student Info */}
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      to={`/students/${student.id}`}
                      className="font-black text-xl text-slate-900 hover:text-emerald-700 transition-colors truncate font-heading"
                    >
                      {student.name}
                    </Link>
                    <span className="bg-slate-100 text-slate-600 font-mono px-2.5 py-0.5 rounded-lg text-xs font-bold border border-slate-200/70 shrink-0">
                      {student.serialNumber}
                    </span>
                    {todayHistory && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200/60 shrink-0">
                        <CheckCircle2 size={13} />
                        تم الرصد اليوم
                      </span>
                    )}

                    {/* Attendance & History Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudentForHistory(student);
                        setHistoryFilter('10');
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 px-3 py-1 rounded-xl border border-slate-200 transition-all shadow-2xs cursor-pointer mr-auto sm:mr-0 shrink-0"
                      title="عرض سجل حضور وجلسات الطالب"
                    >
                      <CalendarDays size={13} className="text-emerald-600" />
                      <span>سجل الحضور والجلسات</span>
                    </button>
                  </div>

                  {/* Badges row: Current reach, Last state with relative date, Expected today */}
                  <div className="flex flex-wrap items-center gap-2.5 mt-3">
                    <div className="text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-1.5">
                      <BookOpen size={13} className="text-emerald-600 shrink-0" />
                      <span className="text-slate-400 font-bold">آخر محفوظ:</span>
                      <span className="font-bold text-slate-800">
                        {student.currentReach ? formatPart(student.currentReach) : 'بداية المصحف'}
                      </span>
                    </div>

                    {lastPastRecord && pastDateRelative && (
                      <div className="text-xs bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 flex flex-wrap items-center gap-1.5">
                        <History size={13} className="text-slate-400 shrink-0" />
                        <span className="text-slate-500 font-bold">آخر حالة مسجلة:</span>
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${getStatusBadgeClass(lastPastRecord.status)}`}>
                          {lastPastRecord.status}
                        </span>
                        <span className="text-slate-500 font-medium text-[11px]" title={pastDateRelative.fullDate}>
                          ({pastDateRelative.label})
                        </span>
                      </div>
                    )}

                    {expectedToday && (
                      <div className="text-xs text-amber-950 bg-amber-50/90 px-3 py-1.5 rounded-xl border border-amber-200/80 flex flex-wrap items-center gap-1.5">
                        <span className="text-amber-700 font-bold">المكتوب سابقاً (المقرر تسميعه):</span>
                        <span className="font-bold">{expectedToday}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side: Semantic Status Buttons */}
                <div className="flex flex-wrap xl:justify-end gap-2 w-full xl:w-auto mt-2 xl:mt-0">
                  {STATUS_OPTIONS.map((opt) => {
                    const isSelected = isExpanded
                      ? formData.status === opt.label
                      : todayHistory?.status === opt.label;

                    return (
                      <button
                        key={opt.label}
                        onClick={() => handleStatusClick(student.id, opt.label, todayHistory, student)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all duration-150 active:scale-95 flex items-center gap-1.5 cursor-pointer ${getButtonClass(
                          opt.label,
                          isSelected
                        )}`}
                      >
                        {isSelected && <Check size={14} className="stroke-[3]" />}
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Recorded Status Summary Banner (when collapsed) */}
              {!isExpanded && todayHistory && (
                <div className="mt-5 bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center relative overflow-hidden">
                  <div
                    className={`absolute top-0 right-0 w-1.5 h-full ${
                      todayHistory.status === 'لم يحضر' ? 'bg-rose-500' : 'bg-emerald-600'
                    } rounded-r-2xl`}
                  ></div>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pr-3">
                    {/* Status Badge */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-slate-400 font-bold">حالة اليوم:</span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg w-fit border ${getStatusBadgeClass(todayHistory.status)}`}>
                        {todayHistory.status}
                      </span>
                    </div>

                    {/* If Absent */}
                    {todayHistory.status === 'لم يحضر' && (
                      <div className="flex flex-col gap-1 sm:col-span-2">
                        <span className="text-[11px] text-slate-400 font-bold">بيان الحضور:</span>
                        <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 w-fit">
                          غائب عن جلسة اليوم
                        </span>
                      </div>
                    )}

                    {/* Recitation (if recited) */}
                    {shouldShowRecitation(todayHistory.status) && (todayHistory.fromPart || todayHistory.toPart) && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] text-slate-400 font-bold">
                          {todayHistory.status === 'عرض ولم يحفظ' ? 'الموضع المعروض (يعاد تسميعه):' : 'ما تم تسميعه اليوم:'}
                        </span>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border w-fit ${
                          todayHistory.status === 'عرض ولم يحفظ'
                            ? 'bg-amber-50 text-amber-900 border-amber-200'
                            : 'bg-white text-slate-800 border-slate-200'
                        }`}>
                          {todayHistory.fromPart ? formatPart(todayHistory.fromPart) : ''}
                          {todayHistory.toPart && todayHistory.toPart !== todayHistory.fromPart ? ` إلى ${formatPart(todayHistory.toPart)}` : ''}
                        </span>
                      </div>
                    )}

                    {/* If كتب فقط */}
                    {todayHistory.status === 'كتب فقط' && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] text-slate-400 font-bold">التسميع:</span>
                        <span className="text-xs text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 w-fit font-bold">
                          لم يسَمِّع اليوم (كتابة فقط)
                        </span>
                      </div>
                    )}

                    {/* Written in tablet */}
                    {shouldShowWriting(todayHistory.status) && todayHistory.writtenParts && (() => {
                      try {
                        const wp = JSON.parse(todayHistory.writtenParts);
                        if (Array.isArray(wp) && wp.length > 0 && wp[0]) {
                          return (
                            <div className="flex flex-col gap-1">
                              <span className="text-[11px] text-teal-700 font-bold">المكتوب في اللوح (للتسميع القادم):</span>
                              <span className="text-xs font-bold text-teal-900 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 w-fit">
                                {wp.map((p: string) => formatPart(p)).join('، ')}
                              </span>
                            </div>
                          );
                        }
                      } catch {}
                      return null;
                    })()}

                    {/* If عرض وحفظ ولم يكتب */}
                    {todayHistory.status === 'عرض وحفظ ولم يكتب' && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] text-teal-700 font-bold">اللوح القرآني:</span>
                        <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 w-fit">
                          لم يكتب في اللوح اليوم
                        </span>
                      </div>
                    )}

                    {/* If عرض ولم يحفظ */}
                    {todayHistory.status === 'عرض ولم يحفظ' && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] text-amber-700 font-bold">اللوح القرآني:</span>
                        <span className="text-xs text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 w-fit font-bold">
                          مُعلّق (إتقان الحفظ أولاً)
                        </span>
                      </div>
                    )}

                    {/* Notes */}
                    {todayHistory.notes && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] text-slate-400 font-bold">ملاحظات:</span>
                        <span className="text-xs text-slate-600 italic truncate max-w-xs" title={todayHistory.notes}>
                          {todayHistory.notes}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions: WhatsApp Share + Edit */}
                  <div className="flex items-center gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-slate-200">
                    <button
                      onClick={() => shareToWhatsapp(student, todayHistory)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-100/70 hover:bg-emerald-200 border border-emerald-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="إرسال تقرير بالواتساب لولي الأمر"
                    >
                      <Send size={13} />
                      <span>واتساب</span>
                    </button>
                    <button
                      onClick={() => handleStatusClick(student.id, todayHistory.status, todayHistory, student)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs transition-colors cursor-pointer"
                    >
                      تعديل
                    </button>
                  </div>
                </div>
              )}

              {/* Form Expansion Area */}
              {isExpanded && (
                <div className="mt-6 pt-6 border-t border-slate-200 animate-in fade-in slide-in-from-top-3 duration-200">
                  <div className="space-y-6 max-w-3xl">
                    {/* 1. ما تم تسميعه اليوم */}
                    {shouldShowRecitation(formData.status) ? (
                      <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                              1
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 text-sm">
                                ما تم تسميعه اليوم ({formData.status})
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                {formData.status === 'عرض ولم يحفظ'
                                  ? 'الموضع الذي عُرض ولم يُتقن الحفظ فيه (سيتم تكراره في الجلسة القادمة)'
                                  : 'المقدار الذي سَمَّعه الطالب اليوم (المكتوب سابقاً في لوحه)'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Mode toggle */}
                            <div className="bg-white border border-slate-200 p-0.5 rounded-xl flex text-[11px] font-bold shadow-2xs">
                              <button
                                type="button"
                                onClick={() => setFormData((prev) => ({ ...prev, entryMode: 'athman' }))}
                                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                                  formData.entryMode === 'athman'
                                    ? 'bg-emerald-700 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                بالأثمان
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData((prev) => ({ ...prev, entryMode: 'range' }))}
                                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                                  formData.entryMode === 'range'
                                    ? 'bg-emerald-700 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                نطاق (من - إلى)
                              </button>
                            </div>

                            {/* Next Thumn Quick Action */}
                            <button
                              type="button"
                              onClick={() => handleNextThumnForRecitation(student)}
                              className="text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                              title="الانتقال إلى الثمن التالي في المصحف تلقائياً"
                            >
                              <FastForward size={13} />
                              <span>الثمن التالي</span>
                            </button>

                            {/* Add Thumn slot */}
                            {formData.entryMode === 'athman' && (
                              <button
                                type="button"
                                onClick={() => handleAddThumnForRecitation(student)}
                                className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                                title="إضافة ثمن آخر"
                              >
                                <Plus size={13} />
                                <span>إضافة ثمن</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {formData.status === 'عرض ولم يحفظ' && (
                          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 flex items-center gap-2 text-xs text-amber-900 font-bold">
                            <AlertCircle size={16} className="text-amber-600 shrink-0" />
                            <span>تنبيه: نظراً لعدم إتقان الحفظ اليوم، سيُقرر على الطالب إعادة هذا المقدار نفسه في الجلسة القادمة ولن يتقدم محفوظه.</span>
                          </div>
                        )}

                        {formData.entryMode === 'athman' ? (
                          <div className="space-y-2.5 pt-1">
                            {formData.recitedAthman.map((part, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl shrink-0 border border-emerald-200">
                                  ثمن {index + 1}
                                </span>
                                <div className="flex-1">
                                  <QuranSelector
                                    value={part}
                                    onChange={(val) => handleRecitedThumnChange(index, val)}
                                    placeholder={`اختر الثمن رقم ${index + 1}...`}
                                  />
                                </div>
                                {formData.recitedAthman.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRecitedThumn(index)}
                                    className="text-slate-400 hover:text-rose-600 p-2 transition-colors rounded-lg hover:bg-rose-50 cursor-pointer"
                                    title="حذف هذا الثمن"
                                  >
                                    <X size={16} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 mb-1">من موضع:</label>
                              <QuranSelector
                                value={formData.fromPart}
                                onChange={(val) => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    fromPart: val,
                                    toPart: prev.toPart || val,
                                    recitedAthman: prev.toPart && prev.toPart !== val ? [val, prev.toPart] : [val],
                                  }));
                                }}
                                placeholder="من موضع..."
                                className="z-50"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 mb-1">إلى موضع:</label>
                              <QuranSelector
                                value={formData.toPart}
                                onChange={(val) => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    toPart: val,
                                    recitedAthman: prev.fromPart && prev.fromPart !== val ? [prev.fromPart, val] : [val],
                                  }));
                                }}
                                placeholder="إلى موضع..."
                                className="z-40"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Notice when Recitation is hidden (e.g. كتب فقط) */
                      <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 flex items-center gap-3 text-xs text-purple-950">
                        <Info size={18} className="text-purple-600 shrink-0" />
                        <div>
                          <span className="font-bold">حالة (كتب فقط): </span>
                          <span>الطالب حضر وكتب في لوحه القرآني فقط دون تسميع اليوم. ينتقل مباشرة لتسجيل الأثمان المكتوبة بالأسفل.</span>
                        </div>
                      </div>
                    )}

                    {/* 2. ما تم كتابته في اللوح اليوم (الأثمان) */}
                    {shouldShowWriting(formData.status) ? (
                      <div className="bg-teal-50/40 p-5 rounded-2xl border border-teal-200/80 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-900 flex items-center justify-center font-bold text-sm">
                              2
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-900 text-sm">ما تم كتابته في اللوح القرآني</h4>
                                <div className="inline-flex items-center bg-white rounded-xl border border-teal-200 p-0.5 text-[10px] font-bold">
                                  <button
                                    type="button"
                                    onClick={() => setWritingMode('thumn')}
                                    className={`px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                                      writingMode === 'thumn'
                                        ? 'bg-teal-700 text-white shadow-xs'
                                        : 'text-teal-800 hover:bg-teal-50'
                                    }`}
                                  >
                                    <Scroll size={11} />
                                    <span>بالأثمان</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setWritingMode('ayah')}
                                    className={`px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                                      writingMode === 'ayah'
                                        ? 'bg-teal-700 text-white shadow-xs'
                                        : 'text-teal-800 hover:bg-teal-50'
                                    }`}
                                  >
                                    <BookMarked size={11} />
                                    <span>بالآيات (للصغار)</span>
                                  </button>
                                </div>
                              </div>
                              <p className="text-[11px] text-teal-700">
                                {writingMode === 'ayah' 
                                  ? 'رصد الآيات اليسيرة المكتوبة في لوح الأطفال والبراعم' 
                                  : 'الأثمان الجديدة التي كتبها الطالب في لوحه اليوم ليحفظها ويسَمِّعها في الجلسة القادمة'}
                              </p>
                            </div>
                          </div>

                          {writingMode === 'thumn' && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleNextThumnForWriting(student)}
                                className="text-xs font-bold text-teal-900 bg-teal-100 hover:bg-teal-200 border border-teal-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                                title="إضافة الثمن التالي للكتابة"
                              >
                                <FastForward size={13} />
                                <span>الثمن التالي</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData((prev) => ({ ...prev, writtenParts: [...prev.writtenParts, ''] }))}
                                className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                              >
                                <Plus size={13} />
                                <span>إضافة ثمن</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {writingMode === 'ayah' ? (
                          <div className="bg-white p-4 rounded-2xl border border-teal-200 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">السورة القرآنية:</label>
                                <select
                                  value={ayahInput.surah}
                                  onChange={(e) => {
                                    const newSurah = e.target.value;
                                    setAyahInput(prev => ({ ...prev, surah: newSurah }));
                                    const formatted = `${ayahInput.count} آيات من سورة ${newSurah} (${ayahInput.fromAyah}-${ayahInput.toAyah})`;
                                    setFormData(prev => ({ ...prev, writtenParts: [formatted] }));
                                  }}
                                  className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 outline-none"
                                >
                                  {SURAHS.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">عدد الآيات المكتوبة:</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={ayahInput.count}
                                  onChange={(e) => {
                                    const c = convertArabicToEnglishNumbers(e.target.value).replace(/\D/g, '');
                                    const from = parseInt(ayahInput.fromAyah, 10) || 1;
                                    const countNum = parseInt(c, 10) || 1;
                                    const to = String(from + countNum - 1);
                                    setAyahInput(prev => ({ ...prev, count: c, toAyah: to }));
                                    const formatted = `${c || '1'} آيات من سورة ${ayahInput.surah} (${from}-${to})`;
                                    setFormData(prev => ({ ...prev, writtenParts: [formatted] }));
                                  }}
                                  className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 outline-none font-mono"
                                  placeholder="مثلاً: 5"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">المدى (من آية إلى آية):</label>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={ayahInput.fromAyah}
                                    onChange={(e) => {
                                      const f = convertArabicToEnglishNumbers(e.target.value).replace(/\D/g, '');
                                      const fromNum = parseInt(f, 10) || 1;
                                      const countNum = parseInt(ayahInput.count, 10) || 1;
                                      const to = String(fromNum + countNum - 1);
                                      setAyahInput(prev => ({ ...prev, fromAyah: f, toAyah: to }));
                                      const formatted = `${ayahInput.count || '1'} آيات من سورة ${ayahInput.surah} (${f || '1'}-${to})`;
                                      setFormData(prev => ({ ...prev, writtenParts: [formatted] }));
                                    }}
                                    className="w-1/2 h-10 rounded-xl border border-slate-200 bg-slate-50 px-2 text-center text-xs font-bold text-slate-800 outline-none font-mono"
                                    placeholder="من"
                                  />
                                  <span className="text-slate-400 font-bold text-xs">-</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={ayahInput.toAyah}
                                    onChange={(e) => {
                                      const t = convertArabicToEnglishNumbers(e.target.value).replace(/\D/g, '');
                                      setAyahInput(prev => ({ ...prev, toAyah: t }));
                                      const formatted = `${ayahInput.count || '1'} آيات من سورة ${ayahInput.surah} (${ayahInput.fromAyah}-${t || ayahInput.fromAyah})`;
                                      setFormData(prev => ({ ...prev, writtenParts: [formatted] }));
                                    }}
                                    className="w-1/2 h-10 rounded-xl border border-slate-200 bg-slate-50 px-2 text-center text-xs font-bold text-slate-800 outline-none font-mono"
                                    placeholder="إلى"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-teal-800 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200/60 font-bold">
                              <span>المسجل حالياً في اللوح:</span>
                              <span className="text-teal-950 font-black">
                                {formData.writtenParts[0] || `${ayahInput.count} آيات من سورة ${ayahInput.surah}`}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2.5 pt-1">
                            {formData.writtenParts.map((part, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <span className="text-xs font-bold text-teal-800 bg-teal-50 px-3 py-2 rounded-xl shrink-0 border border-teal-200">
                                  كتابة {index + 1}
                                </span>
                                <div className="flex-1">
                                  <QuranSelector
                                    value={part}
                                    onChange={(val) => {
                                      const newParts = [...formData.writtenParts];
                                      newParts[index] = val;
                                      setFormData((prev) => ({ ...prev, writtenParts: newParts }));
                                    }}
                                    placeholder={`اختر الثمن المكتوب رقم ${index + 1}...`}
                                  />
                                </div>
                                {formData.writtenParts.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newParts = formData.writtenParts.filter((_, i) => i !== index);
                                      setFormData((prev) => ({ ...prev, writtenParts: newParts }));
                                    }}
                                    className="text-slate-400 hover:text-rose-600 p-2 transition-colors rounded-lg hover:bg-rose-50 cursor-pointer"
                                    title="حذف هذا الثمن"
                                  >
                                    <X size={16} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Notice when Writing is hidden (e.g. عرض وحفظ ولم يكتب or عرض ولم يحفظ) */
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-3 text-xs text-slate-700">
                        <Info size={18} className="text-slate-500 shrink-0" />
                        <div>
                          <span className="font-bold">
                            {formData.status === 'عرض وحفظ ولم يكتب' ? 'عرض وحفظ ولم يكتب:' : 'عرض ولم يحفظ:'}{' '}
                          </span>
                          <span>
                            {formData.status === 'عرض وحفظ ولم يكتب'
                              ? 'الطالب سَمَّع محفوظه بنجاح اليوم لكنه لم يكتب لوحاً جديداً.'
                              : 'الطالب لم يتقن الحفظ اليوم، لذلك لا يُكتب له لوح جديد حتى يُتقن لوحه الحالي أولاً.'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 3. ملاحظات المعلم */}
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">
                        ملاحظات المعلم حول أداء الطالب وحفظه اليوم (اختياري)
                      </label>
                      <textarea
                        className="w-full rounded-2xl border-slate-200 bg-slate-50/50 p-3 focus:bg-white focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 outline-none border min-h-[60px] text-xs resize-none"
                        placeholder="أضف أي ملاحظات حول أداء الطالب وحفظه اليوم..."
                        value={formData.notes}
                        onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                      />
                    </div>

                    {/* 4. Actions */}
                    <div className="flex justify-end gap-2.5 pt-2">
                      <Button
                        variant="outline"
                        onClick={resetForm}
                        className="rounded-xl px-5 text-xs font-bold cursor-pointer"
                      >
                        إلغاء
                      </Button>
                      <Button
                        onClick={() => {
                          const isRecitationActive = shouldShowRecitation(formData.status);
                          const isWritingActive = shouldShowWriting(formData.status);

                          const cleanWritten = isWritingActive
                            ? formData.writtenParts.filter((p) => p.trim() !== '')
                            : [];
                          const cleanRecited = isRecitationActive
                            ? formData.recitedAthman.filter((p) => p.trim() !== '')
                            : [];

                          const resolvedFrom = isRecitationActive
                            ? (formData.entryMode === 'athman'
                                ? (cleanRecited[0] || formData.fromPart || '')
                                : (formData.fromPart || ''))
                            : '';

                          const resolvedTo = isRecitationActive
                            ? (formData.entryMode === 'athman'
                                ? (cleanRecited[cleanRecited.length - 1] || formData.toPart || resolvedFrom)
                                : (formData.toPart || resolvedFrom))
                            : '';

                          let nextReviewFrom: string | null = null;
                          let nextReviewTo: string | null = null;

                          if (formData.status === 'عرض ولم يحفظ') {
                            // Repeat the same portion
                            nextReviewFrom = resolvedFrom || null;
                            nextReviewTo = resolvedTo || resolvedFrom || null;
                          } else if (cleanWritten.length > 0) {
                            nextReviewFrom = cleanWritten[0];
                            nextReviewTo = cleanWritten[cleanWritten.length - 1];
                          }

                          const payload = {
                            studentId: student.id,
                            date,
                            status: formData.status,
                            type: 'تسميع',
                            fromPart: resolvedFrom,
                            toPart: resolvedTo,
                            nextReviewFrom,
                            nextReviewTo,
                            writtenParts: JSON.stringify(cleanWritten),
                            notes: formData.notes,
                            sheikhId: activeSheikh?.id || null,
                            sheikhName: activeSheikh?.name || null,
                          };
                          addHistoryMutation.mutate(payload);
                        }}
                        disabled={addHistoryMutation.isPending}
                        className="rounded-xl px-7 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-700/20 cursor-pointer"
                      >
                        <Save size={15} />
                        {addHistoryMutation.isPending ? 'جاري الحفظ...' : 'حفظ السجل'}
                      </Button>
                    </div>

                    {activeSheikh && (
                      <div className="flex items-center justify-end gap-1.5 text-[11px] text-slate-400 pt-1">
                        <span>سيُوثق السجل باسم:</span>
                        <strong className="text-emerald-700 font-bold">{activeSheikh.name}</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Attendance & History Modal */}
      {selectedStudentForHistory && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedStudentForHistory(null)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <CalendarDays size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900 font-heading">
                      سجل الحضور والجلسات: {selectedStudentForHistory.name}
                    </h3>
                    <span className="bg-slate-200/80 text-slate-700 font-mono text-xs px-2 py-0.5 rounded-md font-bold">
                      {selectedStudentForHistory.serialNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    عرض تفاصيل الحضور، التسميع، وألواح الكتابة عبر الجلسات السابقة
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStudentForHistory(null)}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                title="إغلاق النافذة"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="px-5 md:px-6 pt-4 pb-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
              <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-2xl text-xs font-bold">
                {[
                  { id: '10', label: 'آخر 10 جلسات' },
                  { id: '30', label: 'آخر 30 يوماً' },
                  { id: '60', label: 'آخر 60 يوماً' },
                  { id: 'all', label: 'جميع الجلسات' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setHistoryFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      historyFilter === tab.id
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <span className="text-xs font-bold text-slate-500">
                عدد الجلسات المعروضة: <strong className="text-emerald-800 font-black">{filteredSessions.length}</strong>
              </span>
            </div>

            {/* KPI Summary Cards */}
            <div className="px-5 md:px-6 py-4 bg-slate-50/50 border-b border-slate-100">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Rate */}
                <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3 text-center">
                  <span className="text-[11px] font-bold text-emerald-700 block">نسبة الحضور</span>
                  <span className="text-xl font-black text-emerald-950 font-heading">
                    {historyMetrics.rate}%
                  </span>
                </div>

                {/* Total */}
                <div className="bg-slate-100/80 border border-slate-200 rounded-2xl p-3 text-center">
                  <span className="text-[11px] font-bold text-slate-600 block">إجمالي الجلسات</span>
                  <span className="text-xl font-black text-slate-900 font-heading">
                    {historyMetrics.total}
                  </span>
                </div>

                {/* Memorized */}
                <div className="bg-teal-50 border border-teal-200/80 rounded-2xl p-3 text-center">
                  <span className="text-[11px] font-bold text-teal-700 block">جلسات الحفظ</span>
                  <span className="text-xl font-black text-teal-950 font-heading">
                    {historyMetrics.memorized}
                  </span>
                </div>

                {/* Absent */}
                <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-3 text-center">
                  <span className="text-[11px] font-bold text-rose-700 block">أيام الغياب</span>
                  <span className="text-xl font-black text-rose-950 font-heading">
                    {historyMetrics.absent}
                  </span>
                </div>
              </div>
            </div>

            {/* Sessions Timeline List */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-3">
              {filteredSessions.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  لا توجد جلسات مسجلة ضمن هذه الفترة المحددة.
                </div>
              ) : (
                filteredSessions.map((session: any) => {
                  const rel = formatRelativeArabicDate(session.date, dateStr);
                  let writtenList: string[] = [];
                  if (session.writtenParts) {
                    try {
                      const parsed = JSON.parse(session.writtenParts);
                      if (Array.isArray(parsed)) writtenList = parsed;
                    } catch {}
                  }

                  return (
                    <div
                      key={session.id}
                      className="bg-white border border-slate-200 rounded-2xl p-4 transition-all hover:border-slate-300 relative overflow-hidden"
                    >
                      <div
                        className={`absolute top-0 right-0 w-1.5 h-full ${
                          session.status === 'لم يحضر' ? 'bg-rose-500' : 'bg-emerald-600'
                        } rounded-r-2xl`}
                      ></div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5 mb-2.5 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">
                            {rel.fullDate}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {rel.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2.5 py-0.5 rounded-lg border font-bold ${getStatusBadgeClass(session.status)}`}>
                            {session.status}
                          </span>
                          {session.sheikhName && (
                            <span className="text-[10px] text-slate-400">
                              بإشراف: <strong className="text-slate-600 font-bold">{session.sheikhName}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs pr-2">
                        {/* Recitation */}
                        {shouldShowRecitation(session.status) && (session.fromPart || session.toPart) && (
                          <div className="flex items-start gap-2">
                            <span className="text-slate-400 font-bold shrink-0">ما تم تسميعه:</span>
                            <span className="text-slate-800 font-bold">
                              {session.fromPart ? formatPart(session.fromPart) : ''}
                              {session.toPart && session.toPart !== session.fromPart ? ` إلى ${formatPart(session.toPart)}` : ''}
                            </span>
                          </div>
                        )}

                        {/* Written in tablet */}
                        {shouldShowWriting(session.status) && writtenList.length > 0 && (
                          <div className="flex items-start gap-2">
                            <span className="text-teal-700 font-bold shrink-0">المكتوب في اللوح:</span>
                            <span className="text-teal-950 font-bold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
                              {writtenList.map((p) => formatPart(p)).join('، ')}
                            </span>
                          </div>
                        )}

                        {/* Notes */}
                        {session.notes && (
                          <div className="flex items-start gap-2 pt-1 text-slate-500 italic">
                            <span className="text-slate-400 font-bold not-italic shrink-0">ملاحظات:</span>
                            <span>{session.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <Button
                type="button"
                onClick={() => setSelectedStudentForHistory(null)}
                className="rounded-xl px-6 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white cursor-pointer"
              >
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
