import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const { login, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already logged in, redirect
  if (isLoggedIn) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast.error('يرجى إدخال اسم المستخدم');
      return;
    }
    if (!password) {
      toast.error('يرجى إدخال كلمة المرور');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(username.trim(), password);
      if (res.success) {
        navigate(from, { replace: true });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 flex flex-col justify-center items-center p-4 sm:p-6" dir="rtl">
      <div className="w-full max-w-md z-10 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black text-white font-heading tracking-tight">
            نظام كُتّاب
          </h1>
          <p className="text-xs sm:text-sm text-emerald-200/80 font-medium">
            منظومة إدارة حلقات تحفيظ القرآن الكريم والكتاتيب
          </p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-200 space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-black text-slate-900 font-heading">
              تسجيل دخول المشايخ والمعلمين
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              يرجى إدخال اسم المستخدم وكلمة المرور الخاصة بحسابك
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                اسم المستخدم
              </label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="اسم المستخدم"
                className="h-12 rounded-2xl bg-slate-50 border-slate-200 text-xs font-bold focus:bg-white text-right"
                autoFocus
                dir="ltr"
              />
            </div>

            {/* Password field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="كلمة المرور"
                  className="pl-11 h-12 rounded-2xl bg-slate-50 border-slate-200 text-xs font-bold focus:bg-white"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md shadow-emerald-700/20 active:scale-[0.99] transition-all cursor-pointer mt-2"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>جاري التحقق والدخول...</span>
                </div>
              ) : (
                <span>تسجيل الدخول للنظام</span>
              )}
            </Button>
          </form>
        </div>

        {/* Footer Note */}
        <p className="text-center text-[11px] text-emerald-200/60">
          نظام كُتّاب • منظومة آمنة لإدارة وتوثيق حلقات تحفيظ القرآن الكريم
        </p>
      </div>
    </div>
  );
}
