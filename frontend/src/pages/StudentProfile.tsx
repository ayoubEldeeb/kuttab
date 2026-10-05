import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowRight, 
  BookOpen, 
  Phone, 
  User, 
  Activity, 
  Edit2, 
  X, 
  Check, 
  Repeat, 
  Send,
  CalendarCheck,
  FastForward,
  Plus,
  Trash2,
  Layers,
  CheckCircle2,
  MessageSquare,
  FileText,
  Printer,
  Scroll,
  BookMarked,
  Info,
  AlertCircle,
  Award,
  Bookmark,
  UserCheck
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { format, subDays, isSameDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { QuranSelector, SURAHS } from '../components/ui/quran-selector';
import { formatPart } from '../utils/formatPart';
import { getNextThumn, convertArabicToEnglishNumbers } from '../utils/quranHelpers';
import { getQuranStage } from '../utils/quranStages';
import { shouldShowRecitation, shouldShowWriting } from './DailyLog';
import api from '../utils/api';
import { useThemeAndSettings } from '../context/ThemeAndSettingsContext';
import { KHATMAH_PRESETS, getKhatmahLabel } from '../utils/khatmahUtils';

const STATUS_OPTIONS = [
  "عرض وحفظ وكتب",
  "عرض وحفظ ولم يكتب",
  "كتب فقط",
  "عرض ولم يحفظ",
  "لم يحضر"
];

const STATUS_COLORS: Record<string, string> = {
  "لم يحضر": "bg-rose-50 text-rose-700 border-rose-200",
  "عرض ولم يحفظ": "bg-amber-50 text-amber-700 border-amber-200",
  "عرض وحفظ ولم يكتب": "bg-teal-50 text-teal-700 border-teal-200",
  "عرض وحفظ وكتب": "bg-emerald-50 text-emerald-800 border-emerald-200 font-bold",
  "كتب فقط": "bg-purple-50 text-purple-700 border-purple-200",
  "حفظ": "bg-emerald-50 text-emerald-800 border-emerald-200 font-bold",
  "لم يحفظ": "bg-rose-50 text-rose-700 border-rose-200"
};

export default function StudentProfile() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { activeSheikh, isHoliday, getHolidayInfo } = useThemeAndSettings();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [formData, setFormData] = useState({
    status: STATUS_OPTIONS[0], // "عرض وحفظ وكتب"
    fromPart: '',
    toPart: '',
    recitedAthman: [] as string[],
    notes: '',
    writtenParts: [] as string[]
  });
  const [writingMode, setWritingMode] = useState<'thumn' | 'ayah'>('thumn');
  const [ayahInput, setAyahInput] = useState({ surah: 'النبأ', count: '5', fromAyah: '1', toAyah: '5' });
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ 
    name: '', 
    guardianName: '', 
    guardianPhone: '', 
    startReach: '',
    currentReach: '', 
    isKhatim: false,
    khatmahCount: 1,
    sheikhId: null as number | null,
    currentRevisionFrom: '', 
    currentRevisionTo: '' 
  });

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      const res = await api.get(`/students/${id}`);
      return res.data;
    }
  });

  const { data: sheikhs } = useQuery({
    queryKey: ['sheikhs'],
    queryFn: async () => {
      const res = await api.get('/sheikhs');
      return res.data;
    }
  });

  useEffect(() => {
    if (student && isEditing) {
      setEditForm({
        name: student.name || '',
        guardianName: student.guardianName || '',
        guardianPhone: student.guardianPhone || '',
        startReach: student.startReach || '',
        currentReach: student.currentReach || '',
        isKhatim: Boolean(student.isKhatim),
        khatmahCount: student.khatmahCount || 1,
        sheikhId: student.sheikhId ?? null,
        currentRevisionFrom: student.currentRevisionFrom || '',
        currentRevisionTo: student.currentRevisionTo || ''
      });
    }
  }, [student, isEditing]);

  // When student loads, initialize inline form
  useEffect(() => {
    if (student) {
      // Find previous written parts
      let previousWritten: string[] = [];
      const pastWritten = student.histories?.find((h: any) => h.writtenParts);
      if (pastWritten?.writtenParts) {
        try {
          const parsed = JSON.parse(pastWritten.writtenParts);
          if (Array.isArray(parsed) && parsed.length > 0) previousWritten = parsed;
        } catch {}
      }

      const initialFrom = previousWritten[0] || (student.currentReach ? getNextThumn(student.currentReach) : '');
      const initialTo = previousWritten.length > 0 ? previousWritten[previousWritten.length - 1] : initialFrom;
      const initialAthman = previousWritten.length > 0 ? previousWritten : (initialFrom ? [initialFrom] : ['']);
      const nextToWrite = initialTo ? getNextThumn(initialTo) : '';

      setFormData({
        status: STATUS_OPTIONS[0],
        fromPart: initialFrom,
        toPart: initialTo,
        recitedAthman: initialAthman,
        writtenParts: nextToWrite ? [nextToWrite] : [''],
        notes: ''
      });
    }
  }, [student]);

  const addHistoryMutation = useMutation({
    mutationFn: async (data: any) => {
      await api.post(`/students/${id}/history`, data);
    },
    onSuccess: () => {
      toast.success('تم تسجيل المتابعة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setFormData(prev => ({
        ...prev,
        notes: '',
      }));
    },
    onError: () => {
      toast.error('حدث خطأ أثناء تسجيل المتابعة');
    }
  });

  const updateStudentMutation = useMutation({
    mutationFn: async (data: any) => {
      await api.put(`/students/${id}`, data);
    },
    onSuccess: () => {
      toast.success('تم تحديث بيانات الطالب بنجاح');
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setIsEditing(false);
    },
    onError: () => {
      toast.error('حدث خطأ أثناء تحديث بيانات الطالب');
    }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-3">
        <div className="w-10 h-10 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-bold">جاري تحميل ملف الطالب...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-24 space-y-4">
        <div className="text-rose-500 font-black text-lg">لم يتم العثور على ملف الطالب</div>
        <Link to="/students" className="inline-flex items-center gap-2 text-emerald-700 font-bold text-sm hover:underline">
          <ArrowRight size={16} />
          <span>الرجوع لدليل الطلاب</span>
        </Link>
      </div>
    );
  }

  // Activity Heatmap
  const last14Days = Array.from({ length: 14 }, (_, i) => subDays(new Date(), 13 - i));
  
  const getActivityColor = (day: Date) => {
    const historyForDay = student.histories.find((h: any) => isSameDay(new Date(h.date), day));
    if (historyForDay) {
      return historyForDay.status === 'لم يحضر' 
        ? 'bg-rose-100 text-rose-700 border border-rose-200' 
        : 'bg-emerald-600 text-white font-bold shadow-xs';
    }
    if (isHoliday(day)) {
      return 'bg-amber-100/90 text-amber-900 border border-amber-300 font-bold';
    }
    return 'bg-slate-100 text-slate-400 border border-slate-200/60';
  };

  // Student Attendance stats
  const totalSessions = student.histories.length;
  const attendedSessions = student.histories.filter((h: any) => h.status !== 'لم يحضر').length;
  const attendanceRate = totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 100;
  const stage = getQuranStage(student.currentReach);

  const shareReportViaWhatsapp = () => {
    if (!student.guardianPhone) {
      toast.error('لا يوجد رقم هاتف مسجل لولي الأمر');
      return;
    }
    const cleanPhone = student.guardianPhone.replace(/\D/g, '');
    const latestHistory = student.histories[0];

    let text = `السلام عليكم ورحمة الله وبركاته،\nولي أمر الطالب/ة: *${student.name}*\nتحية طيبة من إدارة حلقات تحفيظ القرآن الكريم.\n\n`;
    if (activeSheikh?.name) {
      text += `👤 *المشرف على الحلقة:* ${activeSheikh.name}\n`;
    }
    text += `📊 *تقرير المتابعة والتقدم الحالي:*\n`;
    if (student.isKhatim) {
      text += `👑 *صفة الطالب:* خاتم لكتاب الله تعالى (${getKhatmahLabel(student.khatmahCount)})\n`;
    }
    text += `📖 *المرحلة القرآنية:* ${stage}\n`;
    if (student.startReach) {
      text += `🌱 *نقطة البداية عند الالتحاق:* ${formatPart(student.startReach)}\n`;
    }
    text += `📌 *آخر موضع محفوظ:* ${formatPart(student.currentReach) || 'بداية المصحف'}\n`;
    if (student.currentRevisionFrom || student.currentRevisionTo) {
      text += `🔁 *ورد المراجعة:* من ${formatPart(student.currentRevisionFrom)} إلى ${formatPart(student.currentRevisionTo)}\n`;
    }
    text += `📈 *نسبة الحضور والالتزام:* ${attendanceRate}% (${attendedSessions} من ${totalSessions} جلسة)\n`;

    if (latestHistory) {
      text += `\n📝 *آخر جلسة مسجلة (${format(new Date(latestHistory.date), 'dd/MM/yyyy')}):* ${latestHistory.status}\n`;
      if (latestHistory.fromPart || latestHistory.toPart) {
        text += `• ما تم تسميعه: من ${formatPart(latestHistory.fromPart)} إلى ${formatPart(latestHistory.toPart)}\n`;
      }
      if (latestHistory.writtenParts) {
        try {
          const wp = JSON.parse(latestHistory.writtenParts);
          if (wp.length > 0 && wp[0]) {
            text += `• المكتوب في اللوح: ${wp.map((p: string) => formatPart(p)).join('، ')}\n`;
          }
        } catch {}
      }
      if (latestHistory.notes) {
        text += `• ملاحظات المعلم: ${latestHistory.notes}\n`;
      }
    }
    text += `\nنسأل الله له التوفيق والثبات والبركة في حفظ كتابه الكريم.`;

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const openDirectWhatsapp = () => {
    if (!student.guardianPhone) {
      toast.error('لا يوجد رقم هاتف مسجل لولي الأمر');
      return;
    }
    const cleanPhone = student.guardianPhone.replace(/\D/g, '');
    const text = `السلام عليكم ورحمة الله وبركاته،\nتحية طيبة من إدارة حلقات تحفيظ القرآن الكريم بخصوص الطالب/ة: *${student.name}*.`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleNextRecitation = () => {
    const last = formData.recitedAthman[formData.recitedAthman.length - 1] || formData.toPart || formData.fromPart || student.currentReach;
    const next = getNextThumn(last);
    const updated = [...formData.recitedAthman, next];
    setFormData(prev => ({
      ...prev,
      recitedAthman: updated,
      fromPart: updated[0],
      toPart: next,
      writtenParts: [getNextThumn(next)]
    }));
    toast.success(`تم اختيار: ${formatPart(next)}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-20">
      {/* Top Header Card with Profile and Actions */}
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link 
            to="/students" 
            className="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-slate-100 text-slate-500 transition-colors border border-slate-200 shrink-0"
            title="الرجوع لدليل الطلاب"
          >
            <ArrowRight size={20} />
          </Link>

          <div className="w-16 h-16 bg-gradient-to-br from-emerald-700 to-teal-900 text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-md shadow-emerald-800/20 ring-4 ring-emerald-50 shrink-0">
            {student.name.substring(0, 1)}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-black text-slate-900 font-heading">{student.name}</h2>
              <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-xl text-xs font-mono font-bold border border-slate-200">
                {student.serialNumber}
              </span>
              {student.isKhatim && (
                <span className="bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-black px-3.5 py-1 rounded-full shadow-sm inline-flex items-center gap-1.5 border border-amber-400">
                  <Award size={14} className="text-amber-100" />
                  <span>خاتم لكتاب الله ({getKhatmahLabel(student.khatmahCount)})</span>
                </span>
              )}
              <span className="bg-emerald-100/90 text-emerald-900 text-xs font-black px-3 py-1 rounded-full border border-emerald-200 inline-flex items-center gap-1.5">
                <Layers size={13} className="text-emerald-700" />
                <span>{stage}</span>
              </span>

              {student.sheikh ? (
                <span className="bg-indigo-50 text-indigo-900 text-xs font-bold px-3 py-1 rounded-full border border-indigo-200/80 inline-flex items-center gap-1.5 shadow-2xs">
                  <UserCheck size={13} className="text-indigo-700" />
                  <span>المحفظ المشرف: <strong>{student.sheikh.name}</strong></span>
                  {student.sheikh.role && (
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">
                      {student.sheikh.role}
                    </span>
                  )}
                </span>
              ) : (
                <span className="bg-slate-100 text-slate-500 text-xs font-bold px-3 py-1 rounded-full border border-slate-200 inline-flex items-center gap-1.5">
                  <UserCheck size={13} className="text-slate-400" />
                  <span>بدون شيخ مشرف</span>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-[11px] text-emerald-700 hover:underline mr-0.5 cursor-pointer"
                  >
                    (إسناد مشرف)
                  </button>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-slate-400 text-xs mt-1">
              <span>تاريخ التسجيل: {format(new Date(student.createdAt), 'dd MMMM yyyy', { locale: ar })}</span>
              {student.startReach && (
                <>
                  <span>•</span>
                  <span className="text-amber-700 font-medium">
                    نقطة البداية عند الالتحاق: {formatPart(student.startReach)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {student.guardianPhone && (
            <>
              <button
                onClick={openDirectWhatsapp}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs font-bold border border-slate-200 hover:border-emerald-300 transition-all active:scale-95 cursor-pointer"
                title="محادثة واتساب سريعة"
              >
                <MessageSquare size={15} className="text-emerald-600" />
                <span>محادثة ولي الأمر</span>
              </button>

              <button
                onClick={shareReportViaWhatsapp}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition-all active:scale-95 cursor-pointer"
                title="إرسال تقرير المتابعة والتقدم عبر واتساب"
              >
                <Send size={14} />
                <span>إرسال تقرير المتابعة</span>
              </button>
            </>
          )}

          <Link
            to={`/students/${id}/report`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold shadow-md shadow-teal-800/20 transition-all active:scale-95"
            title="فتح وطباعة تقرير المتابعة الشامل لولي الأمر"
          >
            <Printer size={15} />
            <span>تقرير ولي الأمر (طباعة)</span>
          </Link>

          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
              isEditing 
                ? 'bg-slate-900 text-white border-slate-900' 
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Edit2 size={14} />
            <span>{isEditing ? 'إغلاق التعديل' : 'تعديل البيانات'}</span>
          </button>
        </div>
      </div>

      {/* Edit Student Info Card (Active when isEditing) */}
      {isEditing && (
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border-2 border-emerald-600/30 space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <Edit2 size={16} />
              </div>
              <h3 className="text-base font-black text-slate-900 font-heading">تعديل بيانات الطالب والمقررات</h3>
            </div>
            <button 
              onClick={() => setIsEditing(false)}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم الطالب الرباعي</label>
              <Input 
                value={editForm.name}
                onChange={e => setEditForm({...editForm, name: e.target.value})}
                className="h-11 rounded-2xl bg-slate-50 text-xs font-bold"
                placeholder="اسم الطالب"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم ولي الأمر</label>
              <Input 
                value={editForm.guardianName}
                onChange={e => setEditForm({...editForm, guardianName: e.target.value})}
                className="h-11 rounded-2xl bg-slate-50 text-xs font-bold"
                placeholder="اسم ولي الأمر"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">رقم هاتف ولي الأمر (واتساب)</label>
              <Input 
                value={editForm.guardianPhone}
                onChange={e => setEditForm({...editForm, guardianPhone: e.target.value})}
                className="h-11 rounded-2xl bg-slate-50 text-xs font-bold text-right"
                placeholder="09xxxxxxxx"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Bookmark size={13} className="text-amber-600" />
                <span>موضع البداية عند الالتحاق بالحلقة (نقطة الانطلاق)</span>
              </label>
              <QuranSelector 
                value={editForm.startReach}
                onChange={val => setEditForm({...editForm, startReach: val})}
                placeholder="حدد موضع البداية عند الالتحاق..."
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <BookOpen size={13} className="text-emerald-600" />
                <span>آخر موضع محفوظ (المستوى الحالي الفعلي)</span>
              </label>
              <QuranSelector 
                value={editForm.currentReach}
                onChange={val => setEditForm({...editForm, currentReach: val})}
                placeholder="حدد آخر موضع محفوظ..."
                className="text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">ورد المراجعة: من موضع</label>
              <QuranSelector 
                value={editForm.currentRevisionFrom}
                onChange={val => setEditForm({...editForm, currentRevisionFrom: val})}
                placeholder="من موضع..."
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">ورد المراجعة: إلى موضع</label>
              <QuranSelector 
                value={editForm.currentRevisionTo}
                onChange={val => setEditForm({...editForm, currentRevisionTo: val})}
                placeholder="إلى موضع..."
                className="text-xs"
              />
            </div>
          </div>

          {/* Khatmah Status in Edit Form */}
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <Award size={15} className="text-amber-600" />
                <span>حالة إتمام القرآن الكريم (الختمات):</span>
              </label>
              {editForm.isKhatim && (
                <span className="text-xs font-bold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-lg border border-amber-300/60">
                  {getKhatmahLabel(editForm.khatmahCount)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setEditForm(prev => ({ ...prev, isKhatim: false, khatmahCount: 0 }))}
                className={`p-3 rounded-xl text-right transition-all border text-xs font-bold cursor-pointer flex items-center gap-2.5 ${
                  !editForm.isKhatim
                    ? 'bg-slate-800 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>📖</span>
                <span>طالب قيد الحفظ (لم يختم بعد)</span>
              </button>

              <button
                type="button"
                onClick={() => setEditForm(prev => ({ ...prev, isKhatim: true, khatmahCount: prev.khatmahCount || 1 }))}
                className={`p-3 rounded-xl text-right transition-all border text-xs font-bold cursor-pointer flex items-center gap-2.5 ${
                  editForm.isKhatim
                    ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                    : 'bg-white text-amber-900 border-amber-200 hover:bg-amber-50/50'
                }`}
              >
                <span>👑</span>
                <span>طالب خاتم لكتاب الله تعالى</span>
              </button>
            </div>

            {editForm.isKhatim && (
              <div className="space-y-2 pt-2 border-t border-amber-200/60">
                <div className="text-[11px] font-bold text-amber-900">اختر الختمة الحالية / المنجزة:</div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {KHATMAH_PRESETS.map((preset) => {
                    const isSelected = editForm.khatmahCount === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setEditForm(prev => ({ ...prev, khatmahCount: preset.value }))}
                        className={`p-2 rounded-xl text-center text-xs font-bold transition-all border cursor-pointer ${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50'
                        }`}
                      >
                        {preset.shortLabel}
                      </button>
                    );
                  })}
                </div>

                {editForm.khatmahCount >= 5 && (
                  <div className="flex items-center gap-2 pt-1.5">
                    <span className="text-xs font-bold text-slate-700">رقم الختمة بدقة:</span>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={editForm.khatmahCount}
                      onChange={(e) => setEditForm(prev => ({ ...prev, khatmahCount: Math.max(1, parseInt(e.target.value) || 1) }))}
                      className="w-20 h-9 rounded-xl text-center font-bold text-xs"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Supervising Sheikh in Edit Form */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200/80 space-y-2">
            <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
              <UserCheck size={15} className="text-indigo-700" />
              <span>الشيخ المشرف على الطالب (المحفظ المسؤول):</span>
            </label>
            <select
              value={editForm.sheikhId || ''}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  sheikhId: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="w-full h-11 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-600 outline-none cursor-pointer"
            >
              <option value="">بدون مشرف محدد (غير مسند حالياً)</option>
              {sheikhs?.map((sh: any) => (
                <option key={sh.id} value={sh.id}>
                  {sh.name} ({sh.role || 'محفظ'}) {sh.phone ? `- ${sh.phone}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setIsEditing(false)}
              className="px-5 py-2.5 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              إلغاء
            </button>
            <Button
              onClick={() => updateStudentMutation.mutate(editForm)}
              disabled={updateStudentMutation.isPending}
              className="px-6 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 cursor-pointer"
            >
              <Check size={15} className="mr-1" />
              <span>{updateStudentMutation.isPending ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
            </Button>
          </div>
        </div>
      )}

      {/* 4 Executive KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Current Quranic Level */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400">آخر موضع محفوظ</span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <BookOpen size={18} />
            </div>
          </div>
          <div>
            {student.isKhatim && (
              <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-300 text-[11px] font-black">
                <Award size={12} className="text-amber-600" />
                <span>خاتم لكتاب الله ({getKhatmahLabel(student.khatmahCount)})</span>
              </div>
            )}
            <div className="text-base font-black text-slate-900 leading-snug line-clamp-2">
              {student.currentReach ? formatPart(student.currentReach) : 'بداية المصحف'}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200/60">
                <Layers size={11} />
                <span>المرحلة: {stage}</span>
              </div>
              {student.startReach && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold" title="نقطة البداية عند الالتحاق">
                  <Bookmark size={10} className="text-amber-600" />
                  <span>البداية: {formatPart(student.startReach)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Revision Range */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400">ورد المراجعة الحالي</span>
            <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <Repeat size={18} />
            </div>
          </div>
          <div>
            {student.currentRevisionFrom || student.currentRevisionTo ? (
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-800 truncate">
                  <span className="text-slate-400 text-[11px] font-medium ml-1">من:</span>
                  {student.currentRevisionFrom ? formatPart(student.currentRevisionFrom) : '-'}
                </div>
                <div className="text-xs font-bold text-teal-800 truncate">
                  <span className="text-slate-400 text-[11px] font-medium ml-1">إلى:</span>
                  {student.currentRevisionTo ? formatPart(student.currentRevisionTo) : '-'}
                </div>
              </div>
            ) : (
              <div className="text-xs font-bold text-slate-400 italic">غير محدد بعد</div>
            )}
            <div className="text-[11px] text-slate-400 font-medium mt-2">
              متابعة التثبيت من قسم سجل المراجعة
            </div>
          </div>
        </div>

        {/* Card 3: Attendance Rate */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400">نسبة الحضور والالتزام</span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CalendarCheck size={18} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 font-heading">{attendanceRate}%</span>
              <span className="text-[11px] text-slate-500 font-bold">
                ({attendedSessions} من أصل {totalSessions} جلسة)
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2 mt-2.5 overflow-hidden">
              <div 
                className="bg-emerald-600 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${attendanceRate}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Card 4: Guardian Contact */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400">بيانات ولي الأمر</span>
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <User size={18} />
            </div>
          </div>
          <div>
            <div className="text-sm font-black text-slate-900 truncate">
              {student.guardianName || 'غير مسجل'}
            </div>
            {student.guardianPhone ? (
              <a
                href={`https://wa.me/${student.guardianPhone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-700 hover:text-emerald-800 hover:underline mt-1.5"
                dir="ltr"
              >
                <Phone size={12} />
                <span>{student.guardianPhone}</span>
              </a>
            ) : (
              <div className="text-xs text-slate-400 mt-1">لا يوجد رقم هاتف</div>
            )}
          </div>
        </div>
      </div>

      {/* Attendance & Activity Heatmap (Last 14 Days) */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="text-emerald-700" size={18} />
            <h3 className="font-bold text-slate-900 text-sm">مؤشر الحضور والنشاط (آخر 14 يوماً)</h3>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-md bg-emerald-600"></div>
              <span>حضر وسمّع</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-md bg-rose-100 border border-rose-300"></div>
              <span>غائب (لم يحضر)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-md bg-amber-100 border border-amber-300"></div>
              <span>عطلة أسبوعية</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-md bg-slate-100 border border-slate-200"></div>
              <span>لا توجد جلسة</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1 pt-1" dir="ltr">
          {last14Days.map((day, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 flex-1 min-w-[42px]">
              <div className={`w-full h-11 rounded-2xl flex items-center justify-center text-xs font-bold transition-all ${getActivityColor(day)}`}>
                {format(day, 'd')}
              </div>
              <span className="text-[10px] text-slate-400 font-bold">
                {format(day, 'EEE', { locale: ar })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Spacious 2-Column Work Area: Today's Session & History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Column 1: Record Today's Session (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 md:p-7 rounded-3xl shadow-sm border border-slate-200/80 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base font-heading">تسجيل حلقة اليوم</h3>
                <p className="text-xs text-slate-400">توثيق ما تم تسميعه وما تم كتابته في اللوح</p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200/60">
              {format(new Date(date), 'yyyy-MM-dd')}
            </span>
          </div>

          <div className="space-y-4">
            {(() => {
              const hInfo = getHolidayInfo(new Date(date));
              if (!hInfo.isHoliday) return null;
              return (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📅</span>
                    <span>
                      تنبيه: هذا اليوم مصنف كـ «{hInfo.holidayName || 'عطلة رسمية'}» في النظام
                      {hInfo.holidayReason ? ` (السبب: ${hInfo.holidayReason})` : ''}. لن يؤثر الغياب سلباً على نسبة حضور الطالب.
                    </span>
                  </div>
                  <span className="text-[10px] font-bold bg-amber-200/90 text-amber-950 px-2.5 py-0.5 rounded-md shrink-0">
                    {hInfo.holidayName || 'عطلة رسمية'}
                  </span>
                </div>
              );
            })()}

            {/* Date & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">تاريخ الجلسة</label>
                <Input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  className="h-11 rounded-2xl bg-slate-50 text-xs font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1.5">حالة التسميع اليوم</label>
                <select 
                  className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:bg-white outline-none cursor-pointer"
                  value={formData.status}
                  onChange={e => {
                    const newStatus = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      status: newStatus,
                      recitedAthman: shouldShowRecitation(newStatus) ? (prev.recitedAthman.length > 0 ? prev.recitedAthman : ['']) : [],
                      writtenParts: shouldShowWriting(newStatus) ? (prev.writtenParts.length > 0 ? prev.writtenParts : ['']) : []
                    }));
                  }}
                >
                  {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>

            {/* If Student Attended */}
            {formData.status !== 'لم يحضر' ? (
              <div className="space-y-4 pt-1">
                {/* 1. ما تم تسميعه اليوم */}
                {shouldShowRecitation(formData.status) ? (
                  <div className="bg-slate-50/80 p-5 rounded-3xl border border-slate-200/80 space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-800 font-heading">ما تم تسميعه اليوم</span>
                          <span className="text-[10px] text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md font-bold">
                            المقدار المسجّل
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {formData.status === 'عرض ولم يحفظ'
                            ? 'الموضع الذي عُرض ولم يُتقن الحفظ فيه (سيعاد تسميعه)'
                            : 'مملوء تلقائياً بما كتبه الطالب في اللوح بالجلسة السابقة'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleNextRecitation}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-all self-start sm:self-auto cursor-pointer"
                        title="إضافة الثمن التالي تسلسلياً في المصحف"
                      >
                        <FastForward size={13} />
                        <span>⏩ الثمن التالي</span>
                      </button>
                    </div>

                    {formData.status === 'عرض ولم يحفظ' && (
                      <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2 font-bold">
                        <AlertCircle size={15} className="text-amber-600 shrink-0" />
                        <span>تنبيه: الطالب لم يتقن الحفظ اليوم، سيكرر نفس المقدار في الجلسة القادمة.</span>
                      </div>
                    )}

                    <div className="space-y-2.5">
                      {formData.recitedAthman.map((part, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="flex-1">
                            <QuranSelector 
                              value={part}
                              onChange={val => {
                                const updated = [...formData.recitedAthman];
                                updated[idx] = val;
                                setFormData(prev => ({
                                  ...prev,
                                  recitedAthman: updated,
                                  fromPart: updated[0] || '',
                                  toPart: updated[updated.length - 1] || ''
                                }));
                              }}
                              placeholder="اختر الثمن المسَمّع..."
                              className="text-xs"
                            />
                          </div>
                          {formData.recitedAthman.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = formData.recitedAthman.filter((_, i) => i !== idx);
                                setFormData(prev => ({
                                  ...prev,
                                  recitedAthman: updated,
                                  fromPart: updated[0] || '',
                                  toPart: updated[updated.length - 1] || ''
                                }));
                              }}
                              className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="حذف هذا الثمن"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-center gap-2 font-bold">
                    <Info size={16} className="text-purple-600 shrink-0" />
                    <span>حالة (كتب فقط): الطالب حضر وكتب في لوحه القرآني دون تسميع اليوم.</span>
                  </div>
                )}

                {/* 2. ما تم كتابته في اللوح */}
                {shouldShowWriting(formData.status) ? (
                  <div className="bg-teal-50/50 p-5 rounded-3xl border border-teal-200/80 space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-teal-950 font-heading">ما تم كتابته في اللوح القرآني</span>
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
                        <p className="text-[11px] text-teal-700/80 mt-0.5">
                          {writingMode === 'ayah' 
                            ? 'رصد الآيات اليسيرة المكتوبة في لوح الأطفال والبراعم' 
                            : 'المقدار القرآني بالأثمان المعتمدة'}
                        </p>
                      </div>

                      {writingMode === 'thumn' && (
                        <button
                          type="button"
                          onClick={() => {
                            const last = formData.writtenParts[formData.writtenParts.length - 1] || formData.toPart;
                            setFormData(prev => ({
                              ...prev,
                              writtenParts: [...prev.writtenParts, getNextThumn(last)]
                            }));
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-teal-300 text-teal-800 hover:bg-teal-100/50 text-xs font-bold transition-all self-start sm:self-auto cursor-pointer"
                        >
                          <Plus size={13} />
                          <span>إضافة ثمن</span>
                        </button>
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
                                const to = String(from + (parseInt(c, 10) || 1) - 1);
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
                                  const c = parseInt(ayahInput.count, 10) || 1;
                                  const to = String((parseInt(f, 10) || 1) + c - 1);
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

                    <div className="space-y-2.5">
                      {formData.writtenParts.map((wp, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="flex-1">
                            <QuranSelector
                              value={wp}
                              onChange={val => {
                                const newW = [...formData.writtenParts];
                                newW[idx] = val;
                                setFormData(prev => ({ ...prev, writtenParts: newW }));
                              }}
                              placeholder="حدد الثمن المكتوب في اللوح..."
                              className="text-xs"
                            />
                          </div>
                          {formData.writtenParts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newW = formData.writtenParts.filter((_, i) => i !== idx);
                                setFormData(prev => ({ ...prev, writtenParts: newW }));
                              }}
                              className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="حذف هذا الثمن"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 text-xs flex items-center gap-2">
                    <Info size={16} className="text-slate-500 shrink-0" />
                    <span>
                      {formData.status === 'عرض وحفظ ولم يكتب'
                        ? 'حالة (عرض وحفظ ولم يكتب): أتم الطالب التسميع بنجاح، ولم يكتب لوحاً جديداً اليوم.'
                        : 'حالة (عرض ولم يحفظ): الطالب لم يتقن الحفظ، لذا لا يكتب لوحاً جديداً حتى يتقن لوحه الحالي أولاً.'}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold text-center">
                تم تحديد حالة الطالب كـ «لم يحضر» لهذه الجلسة.
              </div>
            )}

            {/* Teacher Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">ملاحظات المعلم والتوجيهات</label>
              <textarea 
                className="w-full rounded-2xl border border-slate-200 bg-white p-3 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none min-h-[60px] text-xs resize-none"
                placeholder="أضف ملاحظات حول جودة الحفظ، التجويد، أو تنبيهات لولي الأمر..."
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
              />
            </div>
            
            {/* Submit Button */}
            <Button 
              className="w-full h-12 rounded-2xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-md shadow-emerald-700/20 active:scale-[0.99] transition-all cursor-pointer" 
              onClick={() => {
                const isRecitationActive = shouldShowRecitation(formData.status);
                const isWritingActive = shouldShowWriting(formData.status);

                const cleanWritten = isWritingActive
                  ? formData.writtenParts.filter(p => p.trim() !== '')
                  : [];
                const cleanRecited = isRecitationActive
                  ? formData.recitedAthman.filter(p => p.trim() !== '')
                  : [];
                const resolvedFrom = isRecitationActive ? (cleanRecited[0] || formData.fromPart || '') : '';
                const resolvedTo = isRecitationActive ? (cleanRecited[cleanRecited.length - 1] || formData.toPart || resolvedFrom) : '';

                let nextReviewFrom: string | null = null;
                let nextReviewTo: string | null = null;

                if (formData.status === 'عرض ولم يحفظ') {
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
                  sheikhName: activeSheikh?.name || null
                };
                addHistoryMutation.mutate(payload);
              }}
              disabled={addHistoryMutation.isPending}
            >
              <CheckCircle2 size={16} className="mr-1.5" />
              <span>{addHistoryMutation.isPending ? 'جاري تسجيل الجلسة...' : 'حفظ تقدم اليوم في الكُتّاب'}</span>
            </Button>

            {activeSheikh && (
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-500 pt-1">
                <span>سيتم توثيق الجلسة بإشراف:</span>
                <span className="text-emerald-800 font-black">{activeSheikh.name}</span>
                <span className="text-[10px] text-slate-400">({activeSheikh.role})</span>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Chronological History Timeline (5 cols) */}
        <div className="lg:col-span-5 bg-white p-6 md:p-7 rounded-3xl shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <FileText size={18} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base font-heading">سجل الجلسات السابقة</h3>
                <p className="text-xs text-slate-400">المسار الزمني لمتابعة الحفظ والكتابة</p>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl">
              {student.histories.length} جلسة
            </span>
          </div>

          <div className="space-y-3.5 max-h-[640px] overflow-y-auto pr-1">
            {student.histories.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs space-y-2">
                <BookOpen size={32} className="mx-auto text-slate-300" />
                <p>لا توجد جلسات مسجلة بعد لهذا الطالب</p>
              </div>
            ) : (
              student.histories.map((history: any) => (
                <div 
                  key={history.id} 
                  className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-all space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${STATUS_COLORS[history.status] || 'bg-slate-100 text-slate-700'}`}>
                      {history.status}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">
                      {format(new Date(history.date), 'dd MMMM yyyy', { locale: ar })}
                    </span>
                  </div>

                  {(history.sheikhName || history.sheikh?.name) && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200/60 w-fit">
                      <span className="text-slate-400">بإشراف:</span>
                      <span className="text-emerald-800">{history.sheikhName || history.sheikh?.name}</span>
                    </div>
                  )}

                  {(history.fromPart || history.toPart) && (
                    <div className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200/70">
                      <span className="text-slate-400 font-bold block mb-1 text-[10px]">ما تم تسميعه:</span>
                      <span className="font-bold text-emerald-800 leading-snug">
                        {history.fromPart ? formatPart(history.fromPart) : '-'}
                        {history.toPart && history.toPart !== history.fromPart ? ` إلى ${formatPart(history.toPart)}` : ''}
                      </span>
                    </div>
                  )}

                  {history.writtenParts && (() => {
                    try {
                      const wp = JSON.parse(history.writtenParts);
                      if (wp.length > 0 && wp[0]) {
                        return (
                          <div className="text-xs text-teal-900 bg-teal-50/80 p-3 rounded-xl border border-teal-200/60">
                            <span className="text-teal-700 font-bold block mb-1 text-[10px]">المكتوب في اللوح (الأثمان):</span>
                            <span className="font-bold leading-snug">
                              {wp.map((p: string) => formatPart(p)).join('، ')}
                            </span>
                          </div>
                        );
                      }
                    } catch {}
                    return null;
                  })()}

                  {history.notes && (
                    <div className="text-xs text-slate-600 italic bg-white/80 p-2.5 rounded-xl border border-slate-100">
                      {history.notes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
