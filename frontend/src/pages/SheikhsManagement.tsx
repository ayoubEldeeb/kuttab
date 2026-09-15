import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  UserPlus, 
  X, 
  Edit2, 
  Trash2,
  Eye,
  EyeOff,
  KeyRound
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useThemeAndSettings, type Sheikh } from '../context/ThemeAndSettingsContext';
import { useAuth } from '../context/AuthContext';

const SHEIKH_ROLES = [
  { id: 'مشرف عام', name: 'مشرف عام', badge: 'bg-amber-100 text-amber-900 border-amber-300' },
  { id: 'شيخ مقرئ', name: 'شيخ مقرئ (إجازات وقراءات)', badge: 'bg-teal-100 text-teal-900 border-teal-300' },
  { id: 'محفظ حلقة', name: 'محفظ حلقة', badge: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  { id: 'مساعد محفظ', name: 'مساعد محفظ', badge: 'bg-slate-100 text-slate-800 border-slate-300' },
];

export default function SheikhsManagement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeSheikh, setActiveSheikh, refetchSheikhs } = useThemeAndSettings();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSheikh, setEditingSheikh] = useState<Sheikh | null>(null);
  const [resetConfirmSheikh, setResetConfirmSheikh] = useState<Sheikh | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    phone: '',
    role: 'محفظ حلقة',
    isActive: true,
  });

  const { data: sheikhs, isLoading } = useQuery<Sheikh[]>({
    queryKey: ['sheikhs'],
    queryFn: async () => {
      const res = await api.get('/sheikhs');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await api.post('/sheikhs', data);
      return res.data;
    },
    onSuccess: (newSheikh) => {
      toast.success('تمت إضافة حساب الشيخ بنجاح');
      queryClient.invalidateQueries({ queryKey: ['sheikhs'] });
      refetchSheikhs();
      setIsModalOpen(false);
      resetForm();
      if (!activeSheikh) {
        setActiveSheikh(newSheikh);
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'حدث خطأ أثناء إضافة حساب الشيخ';
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof formData> }) => {
      const res = await api.put(`/sheikhs/${id}`, data);
      return res.data;
    },
    onSuccess: (updated) => {
      toast.success('تم تحديث بيانات الشيخ بنجاح');
      queryClient.invalidateQueries({ queryKey: ['sheikhs'] });
      refetchSheikhs();
      setIsModalOpen(false);
      setEditingSheikh(null);
      resetForm();
      if (activeSheikh?.id === updated.id) {
        setActiveSheikh(updated);
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'حدث خطأ أثناء تحديث بيانات الشيخ';
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/sheikhs/${id}`);
    },
    onSuccess: () => {
      toast.success('تم حذف / إيقاف حساب الشيخ بنجاح');
      queryClient.invalidateQueries({ queryKey: ['sheikhs'] });
      refetchSheikhs();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'حدث خطأ أثناء حذف الحساب';
      toast.error(msg);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post(`/sheikhs/${id}/reset-password`);
      return res.data;
    },
    onSuccess: () => {
      toast.success(`تمت إعادة تعيين كلمة المرور للشيخ «${resetConfirmSheikh?.name}» إلى: password123`);
      setResetConfirmSheikh(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'حدث خطأ أثناء إعادة تعيين كلمة المرور';
      toast.error(msg);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      username: '',
      password: '',
      phone: '',
      role: 'محفظ حلقة',
      isActive: true,
    });
    setShowPassword(false);
    setEditingSheikh(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: Sheikh) => {
    // Security check: only allow editing own profile
    const currentUserId = user?.id || activeSheikh?.id;
    if (currentUserId && currentUserId !== s.id) {
      toast.error('لا يمكنك تعديل بيانات حساب شيخ آخر. يمكنك فقط إعادة تعيين كلمة المرور.');
      return;
    }

    setEditingSheikh(s);
    setFormData({
      name: s.name,
      username: s.username || '',
      password: '',
      phone: s.phone || '',
      role: s.role,
      isActive: s.isActive,
    });
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('يرجى كتابة اسم الشيخ');
      return;
    }
    if (!formData.username.trim()) {
      toast.error('يرجى إدخال اسم المستخدم لتسجيل الدخول');
      return;
    }
    if (!editingSheikh && !formData.password.trim()) {
      toast.error('يرجى إدخال كلمة المرور لحساب الشيخ الجديد');
      return;
    }

    if (editingSheikh) {
      updateMutation.mutate({ id: editingSheikh.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleSelectActive = (s: Sheikh) => {
    setActiveSheikh(s);
    toast.success(`تم تعيين «${s.name}» كمسؤول حالي عن جلسات الرصد والتسميع`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-24">
      {/* Executive Page Header */}
      <div className="bg-white p-6 md:p-7 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 font-heading">إدارة المشايخ والمعلمين</h2>
          <p className="text-slate-400 text-xs mt-0.5">
            إدارة حسابات المحفظين والمشرفين، ونسبة كافة عمليات الرصد والتسميع للشيخ المسؤول
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
        >
          <UserPlus size={16} />
          <span>إضافة شيخ جديد</span>
        </Button>
      </div>

      {/* Active Sheikh Executive Status Card */}
      <div className="bg-white p-6 md:p-7 rounded-3xl shadow-sm border border-emerald-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>الشيخ المعتمد حالياً لرصد الجلسات</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-2xl font-black font-heading text-slate-900">
              {activeSheikh?.name || 'لم يتم تحديد شيخ مسؤول'}
            </h3>
            {activeSheikh?.role && (
              <span className="px-2.5 py-0.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                {activeSheikh.role}
              </span>
            )}
            {activeSheikh?.username && (
              <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200" dir="ltr">
                @{activeSheikh.username}
              </span>
            )}
            {activeSheikh?.phone && (
              <span className="text-xs font-mono text-slate-500" dir="ltr">
                {activeSheikh.phone}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            تُنسب كافة عمليات التسميع والمراجعة اليومية لحساب هذا الشيخ تلقائياً في السجلات وتقارير أولياء الأمور
          </p>
        </div>

        {activeSheikh && (
          <div className="flex items-center gap-4 bg-slate-50 border border-slate-200/80 px-5 py-3.5 rounded-2xl shrink-0">
            <div className="text-center">
              <div className="text-xl font-black font-mono text-emerald-700">
                {activeSheikh.recordedSessionsCount || 0}
              </div>
              <div className="text-[11px] font-bold text-slate-500">جلسة مرصودة</div>
            </div>
          </div>
        )}
      </div>

      {/* Sheikhs Table / Grid */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-slate-900 text-base font-heading">
            قائمة المشايخ والمعلمين بالمركز ({sheikhs?.length || 0})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 text-xs font-bold">
              <tr>
                <th className="py-4 px-6">الشيخ / المعلم</th>
                <th className="py-4 px-6">الصفة / الرتبة</th>
                <th className="py-4 px-6">رقم الهاتف</th>
                <th className="py-4 px-6 text-center">الجلسات المرصودة</th>
                <th className="py-4 px-6 text-center">الحالة</th>
                <th className="py-4 px-6 text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    جاري تحميل قائمة المشايخ...
                  </td>
                </tr>
              )}

              {sheikhs?.map((s) => {
                const isActiveCurrent = activeSheikh?.id === s.id;
                const roleObj = SHEIKH_ROLES.find((r) => r.id === s.role) || SHEIKH_ROLES[2];
                const isMe = user ? user.id === s.id : activeSheikh?.id === s.id;

                return (
                  <tr
                    key={s.id}
                    className={`transition-colors hover:bg-slate-50/70 ${
                      isActiveCurrent ? 'bg-emerald-50/40' : ''
                    }`}
                  >
                    <td className="py-4 px-6">
                      <div>
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          <span>{s.name}</span>
                          {isActiveCurrent && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 text-white whitespace-nowrap">
                              المسؤول الحالي
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-slate-400">معرّف: SHK-{s.id}</span>
                          {s.username && (
                            <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/60" dir="ltr">
                              @{s.username}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border whitespace-nowrap inline-block ${roleObj.badge}`}>
                        {s.role}
                      </span>
                    </td>

                    <td className="py-4 px-6">
                      {s.phone ? (
                        <a
                          href={`https://wa.me/${s.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-slate-700 hover:text-emerald-700 transition-colors"
                          dir="ltr"
                        >
                          <span>{s.phone}</span>
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 font-mono">-</span>
                      )}
                    </td>

                    <td className="py-4 px-6 text-center">
                      <span className="font-mono font-bold text-xs bg-slate-100 px-3 py-1 rounded-xl text-slate-700">
                        {s.recordedSessionsCount || 0} جلسة
                      </span>
                    </td>

                    <td className="py-4 px-6 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          s.isActive
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {s.isActive ? 'نشط' : 'متوقف'}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-left">
                      <div className="flex items-center justify-end gap-2">
                        {!isActiveCurrent && s.isActive && (
                          <button
                            onClick={() => handleSelectActive(s)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                            title="تعيين كشيخ مسؤول حالياً"
                          >
                            تعيين كمسؤول
                          </button>
                        )}

                        {isMe ? (
                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                            title="تعديل بيانات حسابي الشخصي"
                          >
                            <Edit2 size={13} />
                            <span>تعديل بياناتي</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setResetConfirmSheikh(s)}
                            className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                            title="إعادة تعيين كلمة المرور إلى password123"
                          >
                            <KeyRound size={13} className="text-amber-700" />
                            <span>إعادة تعيين المرور</span>
                          </button>
                        )}

                        {!isMe && (
                          <button
                            onClick={() => {
                              if (window.confirm(`هل أنت متأكد من رغبتك في حذف/إيقاف حساب «${s.name}»؟`)) {
                                deleteMutation.mutate(s.id);
                              }
                            }}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="حذف أو إيقاف الحساب"
                          >
                            <Trash2 size={15} />
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

      {/* Modal for Add / Edit Sheikh */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-black text-slate-900 text-lg font-heading">
                  {editingSheikh ? 'تعديل بيانات حسابي الشخصي' : 'إضافة شيخ جديد للمركز'}
                </h3>
                <p className="text-xs text-slate-400">
                  {editingSheikh ? 'تحديث اسمك ورقم هاتفك أو تعيين كلمة مرور جديدة لحسابك' : 'إدخال الاسم والصفة ورقم التواصل'}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم الشيخ / المعلم <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: الشيخ أحمد بن محمد"
                  className="h-11 rounded-2xl bg-slate-50 text-xs font-bold"
                  autoFocus
                />
              </div>

              {/* Username & Password Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    اسم المستخدم (لتسجيل الدخول) <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="مثال: ahmed_qari"
                    className="h-11 rounded-2xl bg-slate-50 text-xs font-bold focus:bg-white text-right"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">يُستخدم للدخول إلى النظام</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    كلمة المرور {editingSheikh ? <span className="text-slate-400 font-normal text-[11px]">(اختياري)</span> : <span className="text-rose-500">*</span>}
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingSheikh ? 'اتركه فارغاً لعدم التغيير' : '••••••••'}
                      className="h-11 pl-10 rounded-2xl bg-slate-50 text-xs font-bold focus:bg-white"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      title={showPassword ? 'إخفاء' : 'إظهار'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {editingSheikh ? 'اتركها فارغة للاحتفاظ بكلمة المرور الحالية' : 'كلمة المرور الخاصة بحساب الشيخ'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الصفة / الرتبة القرآنية</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:bg-white outline-none cursor-pointer"
                >
                  {SHEIKH_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">رقم الهاتف (واتساب)</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="09xxxxxxxx"
                  className="h-11 rounded-2xl bg-slate-50 text-xs font-bold text-right"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="isActiveToggle" className="text-xs font-bold text-slate-700 cursor-pointer">
                  حساب نشط (يمكنه رصد الجلسات وإسنادها إليه)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-6 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 cursor-pointer"
                >
                  <span>
                    {createMutation.isPending || updateMutation.isPending
                      ? 'جاري الحفظ...'
                      : editingSheikh
                      ? 'حفظ التعديلات'
                      : 'إضافة الشيخ'}
                  </span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Resetting Password to password123 */}
      {resetConfirmSheikh && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200 text-right">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base font-heading">
                    إعادة تعيين كلمة المرور
                  </h3>
                  <p className="text-xs text-slate-400">ضبط كلمة المرور الافتراضية</p>
                </div>
              </div>
              <button
                onClick={() => setResetConfirmSheikh(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                هل أنت متأكد من إعادة تعيين كلمة المرور لحساب الشيخ{' '}
                <strong className="text-slate-900 font-bold">«{resetConfirmSheikh.name}»</strong>؟
              </p>

              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900">كلمة المرور الجديدة:</span>
                <code className="text-xs font-mono font-black bg-white px-3 py-1 rounded-xl border border-amber-300 text-amber-900 shadow-xs" dir="ltr">
                  password123
                </code>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                * لا يمكن لأي مستخدم أو مشرف تعديل بيانات حساب شيخ آخر. يمكن فقط إعادة تعيين كلمة المرور إلى كلمة المرور الافتراضية أعلاه، ليتمكن الشيخ من الدخول وتغييرها من حسابه بنفسه.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResetConfirmSheikh(null)}
                className="px-5 py-2.5 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>
              <Button
                type="button"
                disabled={resetPasswordMutation.isPending}
                onClick={() => resetPasswordMutation.mutate(resetConfirmSheikh.id)}
                className="px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 cursor-pointer flex items-center gap-1.5"
              >
                <KeyRound size={14} />
                <span>{resetPasswordMutation.isPending ? 'جاري إعادة الضبط...' : 'تأكيد إعادة التعيين'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
