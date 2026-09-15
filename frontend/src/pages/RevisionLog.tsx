import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Calendar, 
  Save, 
  Repeat, 
  CheckCircle2, 
  XCircle, 
  BookOpen, 
  Send,
  FastForward
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import toast from 'react-hot-toast';
import { QuranSelector } from '../components/ui/quran-selector';
import { formatPart } from '../utils/formatPart';
import { getNextThumn } from '../utils/quranHelpers';
import api from '../utils/api';
import { useThemeAndSettings } from '../context/ThemeAndSettingsContext';

export default function RevisionLog() {
  const { activeSheikh, isHoliday } = useThemeAndSettings();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const queryClient = useQueryClient();

  const [activeFormId, setActiveFormId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    status: '', // 'حفظ' or 'لم يحفظ' or 'تحديد'
    nextReviewFrom: '',
    nextReviewTo: '',
    notes: '',
  });

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
      toast.success('تم حفظ سجل المراجعة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['students', date] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setActiveFormId(null);
    },
    onError: () => {
      toast.error('حدث خطأ أثناء حفظ السجل');
    },
  });

  const updateStudentMutation = useMutation({
    mutationFn: async (data: { id: number; currentRevisionFrom: string; currentRevisionTo: string }) => {
      const { id, ...payload } = data;
      await api.put(`/students/${id}`, payload);
    },
    onSuccess: () => {
      toast.success('تم تحديد ورد المراجعة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['students', date] });
      setActiveFormId(null);
    },
    onError: () => {
      toast.error('حدث خطأ أثناء تحديد الورد');
    },
  });

  const handleStatusClick = (studentId: number, status: string, student: any) => {
    if (activeFormId === studentId && formData.status === status) {
      setActiveFormId(null);
    } else {
      setActiveFormId(studentId);
      
      let initialFrom = student.currentRevisionFrom || '';
      let initialTo = student.currentRevisionTo || '';

      // If student passed review, intelligently suggest the next portion!
      if (status === 'حفظ' && initialTo) {
        const nextFrom = getNextThumn(initialTo, 1);
        const nextTo = getNextThumn(initialTo, 2);
        initialFrom = nextFrom;
        initialTo = nextTo;
      }

      setFormData({
        status,
        nextReviewFrom: initialFrom,
        nextReviewTo: initialTo,
        notes: '',
      });
    }
  };

  const handleAdvanceRevision = (student: any) => {
    const base = formData.nextReviewTo || formData.nextReviewFrom || student.currentRevisionTo || student.currentReach;
    const nextF = getNextThumn(base, 1);
    const nextT = getNextThumn(base, 2);
    setFormData((prev) => ({
      ...prev,
      nextReviewFrom: nextF,
      nextReviewTo: nextT,
    }));
    toast.success(`تم اختيار الورد التالي: من ${formatPart(nextF)} إلى ${formatPart(nextT)}`);
  };

  const filtered = students?.filter((s: any) => {
    const matchesSearch = s.name.includes(search) || s.serialNumber.includes(search);
    const hasRevision = !!(s.currentRevisionFrom || s.currentRevisionTo);
    let matchesFilter = true;
    if (filterType === 'assigned') matchesFilter = hasRevision;
    if (filterType === 'unassigned') matchesFilter = !hasRevision;
    return matchesSearch && matchesFilter;
  });

  const totalCount = students?.length || 0;
  const assignedCount = students?.filter((s: any) => s.currentRevisionFrom || s.currentRevisionTo).length || 0;
  const unassignedCount = totalCount - assignedCount;

  const shareRevisionToWhatsapp = (student: any) => {
    if (!student.guardianPhone) {
      toast.error('لا يوجد رقم هاتف مسجل لولي الأمر');
      return;
    }
    const cleanPhone = student.guardianPhone.replace(/\D/g, '');
    let text = `السلام عليكم ورحمة الله وبركاته،\nولي أمر الطالب/ة: *${student.name}*\nتحية طيبة من إدارة حلقات تحفيظ القرآن الكريم.\n\n`;
    text += `نود إحاطتكم بورد المراجعة والتثبيت المطلوب للتحضير:\n`;
    if (student.currentRevisionFrom || student.currentRevisionTo) {
      const span = student.currentRevisionFrom === student.currentRevisionTo
        ? formatPart(student.currentRevisionFrom)
        : `من ${formatPart(student.currentRevisionFrom)} إلى ${formatPart(student.currentRevisionTo)}`;
      text += `🎯 *مقدار المراجعة:* ${span}\n`;
    }
    text += `\nيرجى المتابعة والحرص على إتقان الطالب للورد، شكر الله حرصكم وتعاونكم.`;

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto pb-16">
      {/* Executive Header Bar */}
      <div className="bg-white p-6 md:p-7 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center font-bold shrink-0 shadow-xs">
            <Repeat size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 font-heading">سجل المراجعة والتثبيت</h2>
            <p className="text-slate-400 text-xs mt-0.5">متابعة أوراد المحفوظات السابقة وتثبيتها للطلاب بانتظام</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-auto">
            <Calendar className="absolute right-3.5 top-3 text-slate-400" size={18} />
            <Input
              type="date"
              className="pr-10 w-full rounded-2xl h-11 bg-slate-50 border-slate-200 text-sm font-semibold"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
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
      {isHoliday(date) && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-bold flex items-center justify-between animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-amber-700" />
            <span>تنبيه: التاريخ المحدد هو يوم عطلة أسبوعية معتمدة في المركز، ولن يؤثر عدم رصد المراجعة سلباً على نسب الحضور.</span>
          </div>
          <span className="text-[10px] font-bold bg-amber-200/80 px-2.5 py-0.5 rounded-lg text-amber-950 shrink-0">
            عطلة رسمية
          </span>
        </div>
      )}

      {/* Metrics & Filter Bar */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">إجمالي الطلاب</span>
            <span className="text-base font-black text-slate-800">{totalCount}</span>
          </div>
          <div className="w-px h-8 bg-slate-200"></div>
          <div>
            <span className="text-slate-400 block font-medium">محدد لهم ورد</span>
            <span className="text-base font-black text-teal-700">{assignedCount}</span>
          </div>
          <div className="w-px h-8 bg-slate-200"></div>
          <div>
            <span className="text-slate-400 block font-medium">بحاجة لتحديد ورد</span>
            <span className="text-base font-black text-amber-700">{unassignedCount}</span>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pt-2 md:pt-0">
          {[
            { key: 'all', label: `الكل (${totalCount})` },
            { key: 'assigned', label: `محدد لهم ورد (${assignedCount})` },
            { key: 'unassigned', label: `بحاجة لتحديد (${unassignedCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterType(tab.key as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                filterType === tab.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Student Revision Cards */}
      <div className="space-y-4">
        {isLoading && (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 text-slate-400">
            جاري تحميل سجلات المراجعة...
          </div>
        )}

        {filtered?.length === 0 && !isLoading && (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 text-slate-400">
            لا يوجد طلاب يطابقون خيارات البحث المحددة.
          </div>
        )}

        {filtered?.map((student: any) => {
          const todayHistory = student.histories?.find((h: any) => h.type === 'مراجعة');
          const isExpanded = activeFormId === student.id;
          const hasRevisionSet = student.currentRevisionFrom || student.currentRevisionTo;

          return (
            <div
              key={student.id}
              className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/90 hover:shadow-md transition-all"
            >
              <div className="flex flex-col xl:flex-row gap-6 justify-between items-start">
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/students/${student.id}`}
                      className="font-black text-xl text-slate-900 hover:text-teal-700 transition-colors truncate font-heading"
                    >
                      {student.name}
                    </Link>
                    <span className="bg-slate-100 text-slate-600 font-mono px-2.5 py-0.5 rounded-lg text-xs font-bold border border-slate-200/70 shrink-0">
                      {student.serialNumber}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2.5 mt-3">
                    <div className="text-xs text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-100 flex items-center gap-2">
                      <BookOpen size={14} className="text-emerald-600" />
                      <span className="text-slate-400 font-bold">مستوى الحفظ:</span>
                      <span className="font-bold text-slate-800">
                        {formatPart(student.currentReach) || 'لم يحدد'}
                      </span>
                    </div>

                    {hasRevisionSet ? (
                      <div className="text-xs text-teal-900 bg-teal-50 px-3.5 py-2 rounded-xl border border-teal-200/70 flex items-center gap-2">
                        <Repeat size={14} className="text-teal-600" />
                        <span className="text-teal-700 font-bold">الورد الحالي للمراجعة:</span>
                        <span className="font-bold">
                          {formatPart(student.currentRevisionFrom)} {student.currentRevisionTo && student.currentRevisionTo !== student.currentRevisionFrom ? ` إلى ${formatPart(student.currentRevisionTo)}` : ''}
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs text-amber-800 bg-amber-50 px-3.5 py-2 rounded-xl border border-amber-200/70 font-bold">
                        لم يتم تحديد ورد مراجعة بعد
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap xl:justify-end items-center gap-2 w-full xl:w-auto mt-2 xl:mt-0">
                  {hasRevisionSet && (
                    <button
                      onClick={() => shareRevisionToWhatsapp(student)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1.5 transition-colors shadow-2xs"
                      title="إرسال الورد لولي الأمر عبر واتساب"
                    >
                      <Send size={13} />
                      <span>تذكير واتساب</span>
                    </button>
                  )}

                  {!hasRevisionSet ? (
                    <button
                      onClick={() => handleStatusClick(student.id, 'تحديد', student)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-2xs ${
                        isExpanded && formData.status === 'تحديد'
                          ? 'bg-teal-700 text-white shadow-md shadow-teal-700/20'
                          : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
                      }`}
                    >
                      <Repeat size={15} />
                      <span>تحديد الورد</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleStatusClick(student.id, 'حفظ', student)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                          (isExpanded ? formData.status === 'حفظ' : todayHistory?.status === 'حفظ')
                            ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/20'
                            : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                      >
                        <CheckCircle2 size={15} />
                        <span>أتم المراجعة</span>
                      </button>
                      <button
                        onClick={() => handleStatusClick(student.id, 'لم يحفظ', student)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                          (isExpanded ? formData.status === 'لم يحفظ' : todayHistory?.status === 'لم يحفظ')
                            ? 'bg-rose-700 text-white shadow-md shadow-rose-700/20'
                            : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                        }`}
                      >
                        <XCircle size={15} />
                        <span>لم يحفظ</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Expansion Form */}
              {isExpanded && (
                <div className="mt-6 pt-6 border-t border-slate-200 animate-in slide-in-from-top-2 duration-200">
                  <div
                    className={`p-6 rounded-2xl border space-y-4 ${
                      formData.status === 'حفظ'
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : formData.status === 'تحديد'
                        ? 'bg-teal-50/40 border-teal-200'
                        : 'bg-rose-50/40 border-rose-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h4
                        className={`font-black text-sm font-heading ${
                          formData.status === 'حفظ'
                            ? 'text-emerald-950'
                            : formData.status === 'تحديد'
                            ? 'text-teal-950'
                            : 'text-rose-950'
                        }`}
                      >
                        {formData.status === 'حفظ'
                          ? 'تحديد ورد المراجعة القادم (تم اجتياز الورد بنجاح)'
                          : formData.status === 'تحديد'
                          ? 'تحديد ورد المراجعة الأولي للطالب'
                          : 'تعديل ورد المراجعة (بحاجة لتثبيت وإعادة)'}
                      </h4>

                      <button
                        type="button"
                        onClick={() => handleAdvanceRevision(student)}
                        className="text-xs font-bold text-teal-800 bg-white hover:bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
                        title="اقتراح الثمنين التاليين للورد القادم"
                      >
                        <FastForward size={13} />
                        <span>اقتراح الورد التالي (ثمنان)</span>
                      </button>
                    </div>

                    {formData.status === 'لم يحفظ' && (
                      <p className="text-xs text-rose-700 bg-white p-3 rounded-xl border border-rose-200">
                        لم يتقن الطالب مراجعة هذا الورد اليوم. يمكنك الإبقاء على نفس الورد للمرة القادمة أو تقسيمه لموضع أقصر.
                      </p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700">من موضع:</label>
                        <QuranSelector
                          value={formData.nextReviewFrom}
                          onChange={(val) => setFormData((prev) => ({ ...prev, nextReviewFrom: val }))}
                          className="z-30"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700">إلى موضع:</label>
                        <QuranSelector
                          value={formData.nextReviewTo}
                          onChange={(val) => setFormData((prev) => ({ ...prev, nextReviewTo: val }))}
                          className="z-20"
                        />
                      </div>
                    </div>

                    {formData.status !== 'تحديد' && (
                      <div className="space-y-1.5 pt-1">
                        <label className="block text-xs font-bold text-slate-700">ملاحظات المعلم حول المراجعة والتثبيت</label>
                        <Input
                          placeholder="مثال: بحاجة لتثبيت أواخر السورة، تمكن جيد وإتقان..."
                          value={formData.notes}
                          onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                          className="bg-white h-11 rounded-xl text-xs border-slate-200"
                        />
                      </div>
                    )}

                    <div className="pt-2 flex justify-end gap-2.5">
                      <Button
                        variant="outline"
                        onClick={() => setActiveFormId(null)}
                        className="rounded-xl px-5 text-xs font-bold"
                      >
                        إلغاء
                      </Button>
                      {formData.status === 'تحديد' ? (
                        <Button
                          onClick={() =>
                            updateStudentMutation.mutate({
                              id: student.id,
                              currentRevisionFrom: formData.nextReviewFrom,
                              currentRevisionTo: formData.nextReviewTo,
                            })
                          }
                          disabled={updateStudentMutation.isPending}
                          className="rounded-xl px-7 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-teal-700/20"
                        >
                          <Save size={15} />
                          <span>حفظ الورد المحدد</span>
                        </Button>
                      ) : (
                        <Button
                          onClick={() =>
                            addHistoryMutation.mutate({
                              studentId: student.id,
                              date,
                              type: 'مراجعة',
                              status: formData.status,
                              fromPart: student.currentRevisionFrom,
                              toPart: student.currentRevisionTo,
                              nextReviewFrom: formData.nextReviewFrom,
                              nextReviewTo: formData.nextReviewTo,
                              notes: formData.notes,
                              sheikhId: activeSheikh?.id || null,
                              sheikhName: activeSheikh?.name || null,
                            })
                          }
                          disabled={addHistoryMutation.isPending}
                          className={`rounded-xl px-7 text-white text-xs font-bold flex items-center gap-2 shadow-md ${
                            formData.status === 'حفظ'
                              ? 'bg-emerald-700 hover:bg-emerald-800 shadow-emerald-700/20'
                              : 'bg-rose-700 hover:bg-rose-800 shadow-rose-700/20'
                          }`}
                        >
                          <Save size={15} />
                          <span>حفظ {formData.status === 'حفظ' ? 'الورد الجديد' : 'النتيجة'}</span>
                        </Button>
                      )}
                    </div>

                    {activeSheikh && (
                      <div className="flex items-center justify-end gap-1.5 text-[11px] text-slate-400 pt-1">
                        <span>المشرف على التثبيت:</span>
                        <strong className="text-teal-700 font-bold">{activeSheikh.name}</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
