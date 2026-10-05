import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { QuranSelector } from '../components/ui/quran-selector';
import toast from 'react-hot-toast';
import { 
  User, 
  Phone, 
  BookOpen, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  MessageSquareText,
  Award,
  Sparkles,
  ArrowDownToLine,
  Bookmark,
  UserCheck
} from 'lucide-react';
import api from '../utils/api';
import { KHATMAH_PRESETS, getKhatmahLabel } from '../utils/khatmahUtils';

export default function RegisterStudent() {
  const [formData, setFormData] = useState({
    name: '',
    guardianName: '',
    guardianPhone: '',
    startReach: '',
    currentReach: '',
    isKhatim: false,
    khatmahCount: 1,
    sheikhId: null as number | null,
  });

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: students } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const res = await api.get('/students');
      return res.data;
    },
  });

  const { data: sheikhs } = useQuery({
    queryKey: ['sheikhs'],
    queryFn: async () => {
      const res = await api.get('/sheikhs');
      return res.data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await api.post('/students', data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('تم تسجيل الطالب بنجاح في نظام كُتّاب');
      navigate(`/students/${data.id}`);
    },
    onError: () => {
      toast.error('حدث خطأ أثناء تسجيل الطالب');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('يرجى إدخال اسم الطالب الرباعي');
      return;
    }
    mutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const totalRegistered = students?.length || 0;
  const nextSerial = `STU-${String(totalRegistered + 1).padStart(4, '0')}`;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500 pb-16">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-900 to-teal-950 p-6 md:p-8 text-white shadow-xl shadow-emerald-950/20">
        <div className="absolute -left-12 -bottom-12 w-64 h-64 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none"></div>
        <div className="absolute right-1/3 -top-12 w-48 h-48 rounded-full bg-amber-400/10 blur-xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/60 border border-emerald-500/30 text-amber-300 text-xs font-bold">
              <span>«وَفِي ذَٰلِكَ فَلْيَتَنَافَسِ الْمُتَنَافِسُونَ»</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black font-heading tracking-tight text-white">
              تسجيل طالب جديد في الكُتّاب
            </h2>
            <p className="text-emerald-100/80 text-xs md:text-sm max-w-xl">
              إضافة ملف قيد لطالب جديد وتحديد بيانات التواصل مع ولي الأمر ومستوى البداية في الحفظ.
            </p>
          </div>

          <Link
            to="/students"
            className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold transition-all flex items-center gap-2 shrink-0 backdrop-blur-sm"
          >
            <span>دليل الطلاب</span>
            <ArrowRight size={14} className="rotate-180" />
          </Link>
        </div>
      </div>

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Section 1: Basic Student Info */}
        <div className="bg-white p-6 md:p-7 rounded-3xl shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <User size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-heading">البيانات الأساسية للطالب</h3>
                <p className="text-[11px] text-slate-400">الاسم الكامل والرقم المسلسل</p>
              </div>
            </div>

            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-xl border border-slate-200">
              الرقم المقترح: {nextSerial}
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>اسم الطالب الرباعي</span>
              <span className="text-rose-500">*</span>
            </label>
            <Input
              name="name"
              placeholder="مثال: عبد الرحمن أحمد محمد إبراهيم"
              value={formData.name}
              onChange={handleChange}
              className="h-12 rounded-2xl bg-slate-50 border-slate-200 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
              required
            />
            <p className="text-[11px] text-slate-400">يُفضل كتابة الاسم رباعياً لضمان دقة السجلات وتقارير المتابعة</p>
          </div>
        </div>

        {/* Section 2: Guardian & WhatsApp Communication */}
        <div className="bg-white p-6 md:p-7 rounded-3xl shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <Phone size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-heading">بيانات ولي الأمر والتواصل</h3>
              <p className="text-[11px] text-slate-400">لإرسال تقارير التسميع والمتابعة اليومية عبر الواتساب</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">اسم ولي الأمر</label>
              <Input
                name="guardianName"
                placeholder="مثال: أحمد محمد إبراهيم (الأب)"
                value={formData.guardianName}
                onChange={handleChange}
                className="h-12 rounded-2xl bg-slate-50 border-slate-200 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <MessageSquareText size={14} className="text-emerald-600" />
                <span>رقم هاتف ولي الأمر (واتساب)</span>
              </label>
              <Input
                name="guardianPhone"
                placeholder="09xxxxxxxx"
                value={formData.guardianPhone}
                onChange={handleChange}
                dir="ltr"
                className="h-12 rounded-2xl bg-slate-50 border-slate-200 text-sm focus:bg-white text-right font-mono focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
              />
              <p className="text-[10px] text-emerald-800 font-medium">يُستخدم هذا الرقم لإرسال تقارير الحلقة اليومية بنقرة واحدة</p>
            </div>
          </div>
        </div>

        {/* Section 3: Quran Start Point and Current Position */}
        <div className="bg-white p-6 md:p-7 rounded-3xl shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <BookOpen size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-heading">مستوى الحفظ ومواضع السور</h3>
              <p className="text-[11px] text-slate-400">تحديد موضع بداية الطالب عند الالتحاق والموضع الحالي</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Field 1: Start Reach upon joining */}
            <div className="space-y-1.5 p-4 rounded-2xl bg-amber-50/40 border border-amber-200/60">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Bookmark size={14} className="text-amber-700" />
                  <span>موضع البداية عند الالتحاق بالحلقة</span>
                </label>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                  نقطة الانطلاق الأولى
                </span>
              </div>
              <QuranSelector
                value={formData.startReach}
                onChange={(val) => {
                  setFormData((prev) => ({
                    ...prev,
                    startReach: val,
                    // If current reach is empty, auto-sync it with start reach
                    currentReach: prev.currentReach || val,
                  }));
                }}
                placeholder="حدد موضع الطالب عند دخوله الكُتّاب..."
              />
              <p className="text-[11px] text-slate-500">
                الموضع الذي كان يحفظه الطالب عندما بدأ معنا، لتتبع مقدار إنجازه وتقدمه لاحقاً
              </p>
            </div>

            {/* Field 2: Current Reach */}
            <div className="space-y-1.5 p-4 rounded-2xl bg-emerald-50/40 border border-emerald-200/60">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <ArrowDownToLine size={14} className="text-emerald-700" />
                  <span>الموضع الحالي في السورة / المصحف</span>
                </label>
                {formData.startReach && formData.currentReach !== formData.startReach && (
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, currentReach: prev.startReach }))}
                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-100/80 px-2 py-0.5 rounded-md transition-colors"
                  >
                    مطابق لنقطة البداية
                  </button>
                )}
              </div>
              <QuranSelector
                value={formData.currentReach}
                onChange={(val) => setFormData((prev) => ({ ...prev, currentReach: val }))}
                placeholder="ابحث عن السورة أو موضع الحفظ الحالي..."
              />
              <p className="text-[11px] text-slate-500">
                الموضع الفعلي الذي وصل إليه الطالب حالياً في الحفظ والتسميع
              </p>
            </div>
          </div>
        </div>

        {/* Section 4: Khatmah Tracking (ختم القرآن الكريم) */}
        <div className="bg-white p-6 md:p-7 rounded-3xl shadow-sm border border-slate-200/80 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                <Award size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-heading">حالة إتمام القرآن الكريم (الختمات)</h3>
                <p className="text-[11px] text-slate-400">تحديد ما إذا كان الطالب خاتماً وتحديد رقم الختمة الحالية أو المنجزة</p>
              </div>
            </div>

            {formData.isKhatim && (
              <span className="inline-flex items-center gap-1 text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 text-white px-3 py-1 rounded-xl shadow-xs">
                <Sparkles size={12} />
                <span>طالب خاتم ({getKhatmahLabel(formData.khatmahCount)})</span>
              </span>
            )}
          </div>

          {/* Toggle between Not Khatim vs Khatim */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, isKhatim: false, khatmahCount: 0 }))}
              className={`p-4 rounded-2xl text-right transition-all border-2 flex items-start gap-3 cursor-pointer ${
                !formData.isKhatim
                  ? 'bg-slate-50/90 border-slate-700 shadow-sm'
                  : 'bg-white border-slate-200/80 hover:bg-slate-50/50'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                  !formData.isKhatim ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300'
                }`}
              >
                {!formData.isKhatim && <div className="w-2 h-2 rounded-full bg-white"></div>}
              </div>
              <div>
                <div className="text-xs font-black text-slate-900">طالب قيد الحفظ (لم يختم بعد)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  طالب متدرج في الحفظ الأولي والتسميع اليومي وفق الموضع المسجل
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, isKhatim: true, khatmahCount: prev.khatmahCount || 1 }))}
              className={`p-4 rounded-2xl text-right transition-all border-2 flex items-start gap-3 cursor-pointer ${
                formData.isKhatim
                  ? 'bg-amber-50/60 border-amber-500 shadow-sm shadow-amber-500/10'
                  : 'bg-white border-slate-200/80 hover:bg-amber-50/30'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                  formData.isKhatim ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-300'
                }`}
              >
                {formData.isKhatim && <div className="w-2 h-2 rounded-full bg-white"></div>}
              </div>
              <div>
                <div className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                  <span>طالب خاتم لكتاب الله تعالى</span>
                  <Award size={14} className="text-amber-600" />
                </div>
                <div className="text-[11px] text-amber-800/80 mt-0.5">
                  أتم الطالب حفظ القرآن الكريم كاملاً ويعرض في ختمة حالية أو سابقة
                </div>
              </div>
            </button>
          </div>

          {/* Conditional Khatmah Level Selector */}
          {formData.isKhatim && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-50/70 via-amber-50/40 to-emerald-50/40 border border-amber-200/80 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-600" />
                  <span>تحديد الختمة الحالية / المنجزة للطالب:</span>
                </label>
                <span className="text-xs font-bold text-amber-800">
                  الحالة: {getKhatmahLabel(formData.khatmahCount)}
                </span>
              </div>

              {/* Khatmah Presets */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {KHATMAH_PRESETS.map((preset) => {
                  const isSelected = formData.khatmahCount === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, khatmahCount: preset.value }))}
                      className={`p-3 rounded-xl text-center transition-all border font-bold text-xs cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        isSelected
                          ? 'bg-amber-600 text-white border-amber-700 shadow-md shadow-amber-600/20 scale-[1.02]'
                          : 'bg-white hover:bg-amber-50/80 text-slate-700 border-slate-200/80 hover:border-amber-300'
                      }`}
                    >
                      <span className="text-sm">
                        {preset.value === 1 && '🥇'}
                        {preset.value === 2 && '🥈'}
                        {preset.value === 3 && '🥉'}
                        {preset.value === 4 && '🎖️'}
                        {preset.value >= 5 && '👑'}
                      </span>
                      <span className="font-heading">{preset.shortLabel}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Number if needed */}
              {formData.khatmahCount >= 5 && (
                <div className="flex items-center gap-3 pt-2">
                  <label className="text-xs font-bold text-slate-700 shrink-0">رقم الختمة بدقة:</label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.khatmahCount}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        khatmahCount: Math.max(1, parseInt(e.target.value) || 1),
                      }))
                    }
                    className="w-24 h-10 rounded-xl bg-white border-amber-200 text-center font-bold"
                  />
                  <span className="text-xs text-slate-500">
                    يمكنك تحديد أي رقم ختمة متقدمة للطالب
                  </span>
                </div>
              )}

              <p className="text-[11px] text-amber-900/70 pt-1 border-t border-amber-200/60">
                💡 سيتم إدراج الطالب تلقائياً في قائمة وإحصائيات الطلاب الخاتمين في لوحة التحكم ودليل الطلاب مع تمييز شارة الختمة.
              </p>
            </div>
          )}
        </div>

        {/* Section 4: Supervising Sheikh */}
        <div className="bg-white p-6 md:p-7 rounded-3xl shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <UserCheck size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-heading">الشيخ المشرف على الطالب (المحفظ المسؤول)</h3>
              <p className="text-[11px] text-slate-400">إسناد الطالب لمحفظ أو مقرئ لمتابعة تسميعه وورده القرآني</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">اختر الشيخ المشرف</label>
            <select
              value={formData.sheikhId || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  sheikhId: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="w-full h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 focus:bg-white outline-none cursor-pointer"
            >
              <option value="">بدون تحديد مشرف حالياً (توزيع لاحق من دليل الطلاب والإشراف)</option>
              {sheikhs?.map((sh: any) => (
                <option key={sh.id} value={sh.id}>
                  {sh.name} ({sh.role || 'محفظ'}) {sh.phone ? `- ${sh.phone}` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">
              💡 يمكنك فرز وتتبع إنجاز طلاب كل شيخ بدقة من خلال تبويب «متابعة وإشراف المشايخ»
            </p>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            type="submit"
            className="flex-1 h-12 text-sm font-black rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white shadow-lg shadow-emerald-800/25 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
            disabled={mutation.isPending}
          >
            <CheckCircle2 size={18} />
            {mutation.isPending ? 'جاري تسجيل الطالب...' : 'إتمام قيد الطالب الجديد'}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/students')}
            className="h-12 px-6 rounded-2xl text-xs font-bold border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
          >
            إلغاء
          </Button>
        </div>

        {/* Security / Privacy Trust Badge */}
        <div className="flex items-center justify-center gap-2 text-slate-400 text-xs py-2">
          <ShieldCheck size={15} className="text-emerald-600" />
          <span>البيانات تُحفظ مشفرة محلياً داخل نظام إدارة الكُتّاب</span>
        </div>
      </form>
    </div>
  );
}
