import { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Type, 
  Palette, 
  CalendarDays, 
  Check, 
  CheckCircle2, 
  RotateCcw,
  Info,
  ArrowRight,
  Moon,
  Sun,
  Calendar,
  CalendarPlus,
  Trash2,
  Plus,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import toast from 'react-hot-toast';
import { useThemeAndSettings, type AppTheme, type FontSize, WEEK_DAYS } from '../context/ThemeAndSettingsContext';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'مشرف عام' || user?.username === 'admin';
  const { 
    theme, 
    setTheme, 
    fontSize, 
    setFontSize, 
    holidayDays, 
    saveHolidays,
    customHolidays,
    addCustomHoliday,
    deleteCustomHoliday
  } = useThemeAndSettings();

  const [selectedHolidays, setSelectedHolidays] = useState<string[]>(holidayDays);
  const [isSavingHolidays, setIsSavingHolidays] = useState(false);

  // Custom Specific Holiday Form State
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayReason, setNewHolidayReason] = useState('');
  const [isSubmittingHoliday, setIsSubmittingHoliday] = useState(false);

  const THEMES: Array<{
    id: AppTheme;
    name: string;
    description: string;
    primaryBg: string;
    accentBg: string;
    badge: string;
  }> = [
    {
      id: 'emerald',
      name: 'الزمردي الإسلامي (الافتراضي)',
      description: 'ألوان الطبيعة والمصاحف الشريفة بدرجات الزمرد الهادئ',
      primaryBg: 'bg-emerald-700',
      accentBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      badge: 'الرسمي'
    },
    {
      id: 'navy',
      name: 'الكحلي الملكي',
      description: 'طابع مؤسسي وقور ورسمي بدرجات الأزرق والكحلي الداكن',
      primaryBg: 'bg-indigo-700',
      accentBg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      badge: 'مؤسسي'
    },
    {
      id: 'amber',
      name: 'العنبري التراثي',
      description: 'مستوحى من ألوان المخطوطات والذهب التراثي العريق',
      primaryBg: 'bg-amber-700',
      accentBg: 'bg-amber-50 text-amber-800 border-amber-200',
      badge: 'تراثي'
    },
    {
      id: 'dark',
      name: 'الداكن الفاخر (ليلي)',
      description: 'وضع ليلي مريح للعين في الحلقات المسائية وبعد العشاء',
      primaryBg: 'bg-slate-900',
      accentBg: 'bg-slate-800 text-slate-200 border-slate-700',
      badge: 'ليلي'
    }
  ];

  const FONT_SIZES: Array<{
    id: FontSize;
    name: string;
    scale: string;
    description: string;
  }> = [
    { id: 'normal', name: 'عادي (الافتراضي)', scale: '100%', description: 'مناسب للشاشات الكبيرة والمكتبية' },
    { id: 'large', name: 'كبير', scale: '110%', description: 'وضوح أعلى وراحة في القراءة للمحفظين' },
    { id: 'xlarge', name: 'كبير جداً', scale: '120%', description: 'أقصى وضوح للقراءة من مسافة عن الشاشات واللوحيات' },
  ];

  const toggleHoliday = (dayId: string) => {
    setSelectedHolidays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  };

  const handleSaveHolidays = async () => {
    setIsSavingHolidays(true);
    try {
      await saveHolidays(selectedHolidays);
      toast.success('تم حفظ أيام العطلة الأسبوعية بنجاح');
    } catch {
      toast.error('حدث خطأ أثناء حفظ أيام العطلة');
    } finally {
      setIsSavingHolidays(false);
    }
  };

  const resetDefaultHolidays = async () => {
    const defaults = ['thursday', 'friday'];
    setSelectedHolidays(defaults);
    await saveHolidays(defaults);
    toast.success('تم استعادة الإجازة الافتراضية (الخميس والجمعة)');
  };

  const handleAddCustomHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate) {
      toast.error('يرجى اختيار تاريخ الإجازة');
      return;
    }
    if (!newHolidayName.trim()) {
      toast.error('يرجى كتابة اسم أو نوع الإجازة (مثل: إجازة الشيخ)');
      return;
    }
    setIsSubmittingHoliday(true);
    try {
      await addCustomHoliday({
        date: newHolidayDate,
        name: newHolidayName.trim(),
        reason: newHolidayReason.trim() || undefined,
      });
      toast.success('تم تسجيل الإجازة المحددة بنجاح');
      setNewHolidayDate('');
      setNewHolidayName('');
      setNewHolidayReason('');
    } catch {
      toast.error('حدث خطأ أثناء حفظ الإجازة');
    } finally {
      setIsSubmittingHoliday(false);
    }
  };

  const handleDeleteCustomHoliday = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف «${name}»؟`)) return;
    try {
      await deleteCustomHoliday(id);
      toast.success(`تم حذف «${name}»`);
    } catch {
      toast.error('حدث خطأ أثناء حذف الإجازة');
    }
  };

  const formatArabicDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-24">
      {/* Executive Page Header */}
      <div className="bg-white p-6 md:p-7 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center font-bold shrink-0 shadow-xs">
            <SettingsIcon size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 font-heading">إعدادات المنظومة</h2>
            <p className="text-slate-400 text-xs mt-0.5">تخصيص حجم الخط، المظهر العام، وضبط أيام العطلات الأسبوعية بالمركز</p>
          </div>
        </div>

        {isAdmin && (
          <Link
            to="/sheikhs"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 text-xs font-bold transition-all"
          >
            <span>إدارة حسابات المشايخ</span>
            <ArrowRight size={14} className="rotate-180" />
          </Link>
        )}
      </div>

      {/* 1. Font Size Section */}
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200/80 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Type size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base font-heading">حجم خط ونصوص المنظومة</h3>
              <p className="text-slate-400 text-xs mt-0.5">تحكم بمدى تكبير النصوص في كافة الشاشات والقوائم لتسهيل القراءة</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FONT_SIZES.map((fs) => {
            const isSelected = fontSize === fs.id;
            return (
              <div
                key={fs.id}
                onClick={() => {
                  setFontSize(fs.id);
                  toast.success(`تم تغيير حجم الخط إلى: ${fs.name}`);
                }}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-sm'
                    : 'border-slate-200/80 bg-slate-50/40 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-sm text-slate-900 font-heading">{fs.name}</span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold ${isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      {fs.scale}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{fs.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-xs text-emerald-800 font-bold">عينة: ن والقلم</span>
                  {isSelected && <Check size={16} className="text-emerald-700" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Font Preview Box */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400">معاينة حية للنص الحالي:</span>
            <p className="text-base font-black text-slate-800 font-heading leading-relaxed">
              «اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ • خَلَقَ الْإِنسَانَ مِنْ عَلَقٍ»
            </p>
          </div>
          <div className="text-xs text-emerald-700 font-bold bg-white px-3 py-1.5 rounded-xl border border-slate-200 shrink-0">
            الحجم المطبق: {FONT_SIZES.find((f) => f.id === fontSize)?.name}
          </div>
        </div>
      </div>

      {/* 2. Theme Selection Section */}
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200/80 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Palette size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base font-heading">المظهر العام للمنظومة (Themes)</h3>
              <p className="text-slate-400 text-xs mt-0.5">اختر المظهر البصري المتوافق مع ذوقك وطبيعة العمل في المركز</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {THEMES.map((th) => {
            const isSelected = theme === th.id;
            return (
              <div
                key={th.id}
                onClick={() => {
                  setTheme(th.id);
                  toast.success(`تم تفعيل مظهر: ${th.name}`);
                }}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-sm ring-2 ring-emerald-500/20'
                    : 'border-slate-200/80 bg-slate-50/40 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-8 h-8 rounded-xl ${th.primaryBg} shadow-sm border border-white/20 flex items-center justify-center text-white`}>
                      {th.id === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                      {th.badge}
                    </span>
                  </div>

                  <h4 className="font-black text-sm text-slate-900 font-heading mb-1">{th.name}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{th.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400">
                    {isSelected ? 'المظهر النشط' : 'انقر للاختيار'}
                  </span>
                  {isSelected && <CheckCircle2 size={18} className="text-emerald-700" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Holiday Days Section */}
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200/80 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <CalendarDays size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-base font-heading">أيام الإجازة والعطلة الأسبوعية</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                  الافتراضي: الخميس والجمعة
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                الأيام المحددة كعطلة لن يتم احتسابها كغياب ولن تؤثر على نسب الحضور، وتظهر كـ «عطلة» في التقارير
              </p>
            </div>
          </div>

          <button
            onClick={resetDefaultHolidays}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors shrink-0"
            title="إعادة التعيين إلى الخميس والجمعة"
          >
            <RotateCcw size={13} />
            <span>إعادة تعيين (الخميس والجمعة)</span>
          </button>
        </div>

        {/* Info Box */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 flex items-start gap-3">
          <Info size={18} className="text-emerald-700 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-950 space-y-1 leading-relaxed">
            <p className="font-bold">كيف يتعامل النظام مع أيام العطلة الأسبوعية؟</p>
            <ul className="list-disc list-inside space-y-0.5 text-emerald-900/90 text-[11px]">
              <li><strong>في لوحة التحكم:</strong> لا يتم احتساب غياب الطلاب في أيام العطلة ولا تنخفض نسبة الحضور إلى صفر.</li>
              <li><strong>في المسار الأسبوعي:</strong> يظهر اليوم مع شارة «عطلة رسمية».</li>
              <li><strong>في خريطة نشاط الطالب (14 يوماً):</strong> يُلون يوم العطلة بلون مميز لتمييزه عن الغياب والتسميع.</li>
              <li><strong>في تقارير الواتساب:</strong> يُذكر تلقائياً أن هذا اليوم عطلة رسمية بالمركز.</li>
            </ul>
          </div>
        </div>

        {/* 7 Days Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2">
          {WEEK_DAYS.map((day) => {
            const isHolidayDay = selectedHolidays.includes(day.id);
            return (
              <button
                key={day.id}
                type="button"
                onClick={() => toggleHoliday(day.id)}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                  isHolidayDay
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-xs ring-2 ring-emerald-500/20'
                    : 'border-slate-200/80 bg-slate-50/50 hover:bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-mono font-bold text-slate-400 uppercase">يوم</span>
                <span className="text-sm font-black font-heading">{day.name}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isHolidayDay ? 'bg-emerald-600 text-white' : 'bg-slate-200/70 text-slate-500'
                  }`}
                >
                  {isHolidayDay ? 'عطلة رسمية' : 'يوم حلقة'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Save Holiday Button */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="text-xs text-slate-500">
            عدد أيام العطلة المحددة: <span className="font-bold text-emerald-800">{selectedHolidays.length} أيام</span> (
            {WEEK_DAYS.filter((w) => selectedHolidays.includes(w.id))
              .map((w) => w.name)
              .join('، ') || 'لا توجد عطلات'}
            )
          </div>

          <Button
            onClick={handleSaveHolidays}
            disabled={isSavingHolidays}
            className="px-6 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 cursor-pointer"
          >
            <Check size={14} className="mr-1.5" />
            <span>{isSavingHolidays ? 'جاري الحفظ...' : 'حفظ أيام الإجازة'}</span>
          </Button>
        </div>
      </div>

      {/* 4. Custom Specific Holidays Section */}
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200/80 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <CalendarPlus size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-base font-heading">
                  الإجازات والعطلات المحددة بتاريخ (الطارئة والرسمية)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                  تظهر في تقرير الطالب والواتساب مع السبب
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                تحديد تاريخ محدد كإجازة (مثل: إجازة خاصة بالشيخ، سفر، أو عطلة عيد) مع كتابة سبب وملاحظة الإجازة لتُطبع صراحة في تقرير ولي الأمر
              </p>
            </div>
          </div>
        </div>

        {/* Add Holiday Form */}
        <form onSubmit={handleAddCustomHoliday} className="p-5 rounded-2xl bg-slate-50/60 border border-slate-200/80 space-y-4">
          <div className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
            <Plus size={14} className="text-emerald-700" />
            <span>تسجيل إجازة خاصة جديدة بتأريخ محدد:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                تاريخ الإجازة <span className="text-rose-500">*</span>
              </label>
              <Input
                type="date"
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                className="bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                اسم أو مناسبة الإجازة <span className="text-rose-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="مثال: إجازة الشيخ / عطلة عيد"
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                className="bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                السبب والملاحظة (للطباعة في التقرير)
              </label>
              <Input
                type="text"
                placeholder="مثال: ظرف خاص بالشيخ / أمر عائلي"
                value={newHolidayReason}
                onChange={(e) => setNewHolidayReason(e.target.value)}
                className="bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              disabled={isSubmittingHoliday}
              className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Plus size={15} />
              <span>{isSubmittingHoliday ? 'جاري الإضافة...' : 'إضافة الإجازة للنظام'}</span>
            </Button>
          </div>
        </form>

        {/* Existing Custom Holidays List */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
            <span>قائمة الإجازات الخاصة المسجلة ({customHolidays.length}):</span>
            <span className="text-[11px] text-slate-400">مرتبة حسب التاريخ</span>
          </div>

          {customHolidays.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-50/40 border border-dashed border-slate-200 text-center space-y-2">
              <Calendar className="mx-auto text-slate-300" size={32} />
              <p className="text-xs text-slate-500 font-bold">لا توجد إجازات خاصة مضافة حالياً</p>
              <p className="text-[11px] text-slate-400">
                يمكنك إضافة إجازات الأيام المحددة (مثل إجازات الشيخ أو العطل الطارئة) من النموذج أعلاه لتظهر تلقائياً في تقارير الطلاب
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {customHolidays.map((h) => (
                <div
                  key={h.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-amber-300 hover:shadow-xs transition-all flex items-start justify-between gap-3 group"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                        {h.name}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-slate-400" dir="ltr">
                        {h.date}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-slate-800">
                      {formatArabicDate(h.date)}
                    </div>

                    {h.reason ? (
                      <div className="text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 flex items-center gap-1.5">
                        <AlertCircle size={12} className="text-amber-600 shrink-0" />
                        <span className="truncate"><strong>السبب:</strong> {h.reason}</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic">بدون ملاحظة إضافية</div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteCustomHoliday(h.id, h.name)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                    title="حذف هذه الإجازة"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
