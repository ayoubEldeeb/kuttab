import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  Users, 
  UserPlus, 
  CalendarClock, 
  BookOpen, 
  Repeat, 
  LayoutDashboard, 
  Menu, 
  X, 
  CheckCircle2, 
  ChevronLeft,
  Settings as SettingsIcon,
  UserCheck,
  Calendar,
  LogOut,
  LogIn
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import StudentsList from './pages/StudentsList';
import RegisterStudent from './pages/RegisterStudent';
import StudentProfile from './pages/StudentProfile';
import StudentGuardianReport from './pages/StudentGuardianReport';
import DailyLog from './pages/DailyLog';
import RevisionLog from './pages/RevisionLog';
import DailyAttendance from './pages/DailyAttendance';
import Settings from './pages/Settings';
import SheikhsManagement from './pages/SheikhsManagement';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { ThemeAndSettingsProvider, useThemeAndSettings } from './context/ThemeAndSettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';

function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const location = useLocation();
  const { activeSheikh, isHoliday } = useThemeAndSettings();
  const { user, isLoggedIn, logout } = useAuth();
  const isAdmin = user?.role === 'مشرف عام' || user?.username === 'admin';
  const isTodayHoliday = isHoliday(new Date());

  const navGroups = [
    {
      title: 'المتابعة اليومية',
      items: [
        { path: '/', icon: LayoutDashboard, label: 'لوحة التحكم', exact: true, description: 'نظرة عامة وإحصائيات' },
        { path: '/attendance', icon: UserCheck, label: 'تسجيل الحضور', exact: false, description: 'رصد الحضور والغياب السريع' },
        { path: '/daily-log', icon: CalendarClock, label: 'السجل اليومي', exact: false, description: 'الحفظ الجديد والكتابة' },
        { path: '/revision-log', icon: Repeat, label: 'سجل المراجعة', exact: false, description: 'أوراد التثبيت والمراجعة' },
      ]
    },
    {
      title: 'شؤون الطلاب',
      items: [
        { path: '/students', icon: Users, label: 'دليل الطلاب', exact: true, description: 'قوائم الطلاب وتصنيف المراحل' },
        { path: '/students?tab=supervision', icon: UserCheck, label: 'إشراف ومتابعة المشايخ', exact: false, description: 'توزيع الطلاب وتتبع إنجاز المشايخ' },
        { path: '/register', icon: UserPlus, label: 'تسجيل طالب جديد', exact: false, description: 'إضافة ملف طالب للحلقة' },
      ]
    },
    {
      title: 'الإدارة والنظام',
      items: [
        ...(isAdmin ? [
          { path: '/sheikhs', icon: UserCheck, label: 'إدارة المشايخ', exact: false, description: 'حسابات المعلمين والمشرفين' }
        ] : []),
        { path: '/settings', icon: SettingsIcon, label: 'إعدادات المنظومة', exact: false, description: 'الخطوط، المظهر، وأيام العطلة' },
      ]
    }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed lg:static top-0 right-0 h-full w-80 bg-white border-l border-slate-200/90 
        flex flex-col shadow-sm z-50 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3.5 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900 text-white flex items-center justify-center shadow-md shadow-emerald-800/25 group-hover:scale-105 transition-all ring-4 ring-emerald-50">
              <BookOpen size={24} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 font-heading tracking-tight">نظام كُتّاب</h1>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">منظومة إدارة حلقات القرآن الكريم</p>
            </div>
          </Link>

          <button 
            onClick={onClose}
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Active Sheikh / User Quick Pill in Sidebar */}
        <div className="px-5 pt-4">
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                {user?.name ? user.name.substring(0, 1) : (activeSheikh?.name ? activeSheikh.name.substring(0, 1) : 'ش')}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-emerald-700 block">
                  {isLoggedIn ? 'الشيخ المسجل حالياً:' : 'المحفظ المسؤول:'}
                </span>
                <span className="text-xs font-black text-slate-900 truncate block font-heading">
                  {user?.name || activeSheikh?.name || 'لم يحدد'}
                </span>
                {user?.username && (
                  <span className="text-[10px] text-slate-400 font-mono block" dir="ltr">
                    @{user.username}
                  </span>
                )}
              </div>
            </div>

            {isAdmin && (
              <Link
                to="/sheikhs"
                onClick={onClose}
                className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-white px-2 py-1 rounded-lg border border-emerald-200 hover:border-emerald-300 transition-colors shrink-0"
                title="إدارة المشايخ"
              >
                المشايخ
              </Link>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-5 space-y-6 overflow-y-auto">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-2">
              <div className="px-3 text-[11px] font-bold text-slate-400 tracking-wider">
                {group.title}
              </div>

              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const fullPath = location.pathname + location.search;
                  const isActive = item.path.includes('?')
                    ? fullPath === item.path
                    : (item.exact 
                        ? (location.pathname === item.path && !location.search.includes('tab=')) 
                        : location.pathname.startsWith(item.path));

                  return (
                    <Link 
                      key={item.path}
                      to={item.path} 
                      onClick={onClose}
                      className={`group flex items-center justify-between px-3.5 py-3 rounded-2xl transition-all duration-150 ${
                        isActive 
                          ? 'bg-gradient-to-r from-emerald-800 to-teal-900 text-white shadow-lg shadow-emerald-900/15 font-bold' 
                          : 'text-slate-600 hover:bg-emerald-50/60 hover:text-emerald-950 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                          isActive 
                            ? 'bg-white/15 text-white' 
                            : 'bg-slate-100/80 text-slate-500 group-hover:bg-emerald-100/80 group-hover:text-emerald-800'
                        }`}>
                          <item.icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className={`text-sm truncate ${isActive ? 'text-white' : 'text-slate-800 group-hover:text-emerald-900 font-bold'}`}>
                            {item.label}
                          </div>
                          <div className={`text-[11px] truncate ${isActive ? 'text-emerald-200/90' : 'text-slate-400 group-hover:text-slate-500'}`}>
                            {item.description}
                          </div>
                        </div>
                      </div>

                      {isActive ? (
                        <div className="w-1.5 h-6 rounded-full bg-amber-400 mr-2 shrink-0"></div>
                      ) : (
                        <ChevronLeft size={16} className="text-slate-300 group-hover:text-emerald-600 group-hover:-translate-x-0.5 transition-transform shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Auth Actions in Sidebar */}
        <div className="p-4 border-t border-slate-100 bg-white">
          {isLoggedIn ? (
            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition-all active:scale-98 cursor-pointer"
            >
              <LogOut size={16} />
              <span>تسجيل الخروج ({user?.name})</span>
            </button>
          ) : (
            <Link
              to="/login"
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-all active:scale-98 text-center"
            >
              <LogIn size={16} />
              <span>تسجيل الدخول للنظام</span>
            </Link>
          )}
        </div>

        {/* Center Live Status Card */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/50">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-200/70 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
              </span>
              <div className="font-bold text-xs text-emerald-950">
                {isTodayHoliday ? 'اليوم عطلة رسمية بالمركز' : 'حلقات اليوم نشطة'}
              </div>
            </div>
            <div className="text-[11px] text-emerald-800/80 mt-1 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-600" />
              <span>البيانات متزامنة ومحفوظة محلياً</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function MainLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isHoliday } = useThemeAndSettings();
  const { user, isLoggedIn, logout } = useAuth();
  const isTodayHoliday = isHoliday(new Date());
  const isAdmin = user?.role === 'مشرف عام' || user?.username === 'admin';

  return (
    <div className="flex h-screen bg-slate-100/60 text-slate-800 font-sans" dir="rtl">
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar for Desktop and Mobile */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between z-20 shadow-2xs shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="القائمة"
            >
              <Menu size={22} />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-700 to-teal-800 text-white flex items-center justify-center font-bold">
                <BookOpen size={16} />
              </div>
              <span className="font-bold text-slate-900 text-base font-heading">نظام كُتّاب</span>
            </div>

            {isTodayHoliday && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200/80">
                <Calendar size={13} />
                <span>اليوم عطلة أسبوعية</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Link to Settings */}
            <Link
              to="/settings"
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              title="إعدادات المنظومة"
            >
              <SettingsIcon size={18} />
            </Link>

            <Link
              to="/attendance"
              className="hidden sm:inline-flex px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors"
            >
              تسجيل الحضور
            </Link>

            <Link
              to="/daily-log"
              className="hidden sm:inline-flex px-3.5 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-bold shadow-xs hover:bg-emerald-800 transition-colors"
            >
              السجل اليومي
            </Link>

            {/* Sheikh Profile & Auth Action Buttons */}
            {isLoggedIn ? (
              <div className="flex items-center gap-2.5 pr-2 sm:pr-3 border-r border-slate-200">
                {isAdmin ? (
                  <Link
                    to="/sheikhs"
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-300 transition-colors"
                    title="إدارة وتبديل حساب الشيخ"
                  >
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-700 to-teal-800 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                      {user?.name ? user.name.substring(0, 1) : 'ش'}
                    </div>
                    <div className="text-right hidden md:block">
                      <span className="text-xs font-black text-slate-800 block leading-tight font-heading">
                        {user?.name}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold block leading-none mt-0.5">
                        {user?.role}
                      </span>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-700 to-teal-800 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                      {user?.name ? user.name.substring(0, 1) : 'ش'}
                    </div>
                    <div className="text-right hidden md:block">
                      <span className="text-xs font-black text-slate-800 block leading-tight font-heading">
                        {user?.name}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold block leading-none mt-0.5">
                        {user?.role}
                      </span>
                    </div>
                  </div>
                )}

                {/* Logout Button */}
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 text-xs font-bold border border-rose-200 transition-all active:scale-95 cursor-pointer shadow-2xs"
                  title="تسجيل الخروج من الحساب"
                >
                  <LogOut size={15} />
                  <span className="hidden sm:inline">تسجيل الخروج</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition-all active:scale-95"
                title="تسجيل الدخول للنظام"
              >
                <LogIn size={15} />
                <span>تسجيل الدخول</span>
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-24">
            <Routes>
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/attendance" element={<ProtectedRoute><DailyAttendance /></ProtectedRoute>} />
              <Route path="/students" element={<ProtectedRoute><StudentsList /></ProtectedRoute>} />
              <Route path="/daily-log" element={<ProtectedRoute><DailyLog /></ProtectedRoute>} />
              <Route path="/revision-log" element={<ProtectedRoute><RevisionLog /></ProtectedRoute>} />
              <Route path="/register" element={<ProtectedRoute><RegisterStudent /></ProtectedRoute>} />
              <Route path="/students/:id" element={<ProtectedRoute><StudentProfile /></ProtectedRoute>} />
              <Route path="/students/:id/report" element={<ProtectedRoute><StudentGuardianReport /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/sheikhs" element={<ProtectedRoute requireAdmin><SheikhsManagement /></ProtectedRoute>} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeAndSettingsProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<MainLayout />} />
          </Routes>
          <Toaster 
            position="top-center" 
            toastOptions={{
              className: 'font-sans',
              style: {
                borderRadius: '16px',
                padding: '14px 20px',
                fontSize: '14px',
                fontWeight: 600,
                border: '1px solid #e2e8f0',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08)',
              },
            }} 
          />
        </ThemeAndSettingsProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
