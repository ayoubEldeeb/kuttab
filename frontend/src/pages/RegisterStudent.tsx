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
  MessageSquareText
} from 'lucide-react';
import api from '../utils/api';

export default function RegisterStudent() {
  const [formData, setFormData] = useState({
    name: '',
    guardianName: '',
    guardianPhone: '',
    currentReach: '',
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

        {/* Section 3: Current Quran Level */}
        <div className="bg-white p-6 md:p-7 rounded-3xl shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <BookOpen size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-heading">مستوى الحفظ الأولي (نقطة البداية)</h3>
              <p className="text-[11px] text-slate-400">الموضع الحالي الذي وصل إليه الطالب في حفظ القرآن الكريم</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">موضع الحفظ الحالي (السورة أو الثمن / الربع)</label>
            <QuranSelector
              value={formData.currentReach}
              onChange={(val) => setFormData((prev) => ({ ...prev, currentReach: val }))}
              placeholder="ابحث عن السورة أو موضع الحفظ..."
            />
            <p className="text-[11px] text-slate-400">إذا كان الطالب مبتدئاً تماماً، يمكنك تركه فارغاً وسيبدأ من بداية المصحف الشريف</p>
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
