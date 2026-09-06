import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { LayoutDashboard, Users, UserPlus } from 'lucide-react'
import StudentsList from './pages/StudentsList'
import RegisterStudent from './pages/RegisterStudent'
import StudentProfile from './pages/StudentProfile'

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-gray-50 text-gray-900">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-l border-gray-200 flex flex-col">
          <div className="h-16 flex items-center px-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-primary">نظام كُتّاب</h1>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <Link to="/" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors">
              <Users size={20} className="text-gray-500" />
              <span>الطلاب</span>
            </Link>
            <Link to="/register" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors">
              <UserPlus size={20} className="text-gray-500" />
              <span>تسجيل طالب جديد</span>
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-8 max-w-6xl mx-auto">
            <Routes>
              <Route path="/" element={<StudentsList />} />
              <Route path="/register" element={<RegisterStudent />} />
              <Route path="/students/:id" element={<StudentProfile />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  )
}
export default App
