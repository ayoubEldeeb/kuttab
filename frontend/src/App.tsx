import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Users, UserPlus, CalendarClock, BookOpen, Repeat } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import StudentsList from './pages/StudentsList'
import RegisterStudent from './pages/RegisterStudent'
import StudentProfile from './pages/StudentProfile'
import DailyLog from './pages/DailyLog'
import RevisionLog from './pages/RevisionLog'

function Sidebar() {
  const location = useLocation()
  
  const navItems = [
    { path: '/daily-log', icon: CalendarClock, label: 'السجل اليومي' },
    { path: '/revision-log', icon: Repeat, label: 'سجل المراجعة' },
    { path: '/', icon: Users, label: 'دليل الطلاب' },
    { path: '/register', icon: UserPlus, label: 'تسجيل طالب جديد' },
  ]

  return (
    <aside className="w-72 bg-white border-l border-gray-200 flex flex-col shadow-[rgba(0,0,0,0.02)_0px_0px_20px] z-10">
      <div className="h-20 flex items-center px-8 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <BookOpen className="text-primary" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">نظام كُتّاب</h1>
        </div>
      </div>
      <nav className="flex-1 p-6 space-y-2">
        {navItems.map(item => {
          const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '/students')
          return (
            <Link 
              key={item.path}
              to={item.path} 
              className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all font-medium ${
                isActive 
                  ? 'bg-primary text-white shadow-md shadow-primary/20' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon size={22} className={isActive ? 'text-white' : 'text-gray-400'} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-gray-100 text-gray-900 font-sans" dir="rtl">
        <Sidebar />
        
        <main className="flex-1 overflow-auto">
          <div className="p-8 max-w-7xl mx-auto pb-24">
            <Routes>
              <Route path="/" element={<StudentsList />} />
              <Route path="/daily-log" element={<DailyLog />} />
              <Route path="/revision-log" element={<RevisionLog />} />
              <Route path="/register" element={<RegisterStudent />} />
              <Route path="/students/:id" element={<StudentProfile />} />
            </Routes>
          </div>
        </main>
      </div>
      <Toaster position="top-center" toastOptions={{
        className: 'font-sans',
        style: {
          borderRadius: '16px',
          padding: '16px',
        },
      }} />
    </Router>
  )
}
export default App
