import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { Search, ChevronLeft, Filter, X } from 'lucide-react'
import { Input } from '../components/ui/input'
import { QuranSelector } from '../components/ui/quran-selector'
import { useState } from 'react'

export default function StudentsList() {
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('')

  const { data: students, isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:39281/students')
      return res.data
    }
  })

  const filtered = students?.filter((s: any) => {
    const matchesSearch = s.name.includes(search) || s.serialNumber.includes(search)
    const matchesLevel = levelFilter ? s.currentReach === levelFilter : true
    return matchesSearch && matchesLevel
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-200 gap-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">دليل الطلاب</h2>
          <p className="text-gray-500 text-sm mt-1">إدارة جميع طلاب المركز وملفاتهم الشخصية</p>
        </div>
        
        <div className="flex flex-col xl:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full xl:w-[500px] z-50 flex flex-col sm:flex-row items-center gap-2">
            <div className="flex-1 w-full">
              <QuranSelector 
                value={levelFilter}
                onChange={setLevelFilter}
                placeholder="تصفية حسب السورة..."
              />
            </div>
            {levelFilter && (
              <button 
                onClick={() => setLevelFilter('')}
                className="w-full sm:w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100 transition-colors"
                title="مسح التصفية"
              >
                <X size={18} />
                <span className="ml-2 sm:hidden font-medium">مسح التصفية</span>
              </button>
            )}
          </div>
          <div className="relative w-full xl:w-64">
            <Search className="absolute right-3 top-2.5 text-gray-400" size={20} />
            <Input 
              className="pr-10 w-full rounded-xl h-12" 
              placeholder="بحث بالاسم أو الرقم..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-visible">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-right relative">
            <thead className="bg-gray-50/50 border-b border-gray-200">
              <tr>
                <th className="py-4 px-6 text-sm font-semibold text-gray-600">الطالب</th>
                <th className="py-4 px-6 text-sm font-semibold text-gray-600">الرقم المتسلسل</th>
                <th className="py-4 px-6 text-sm font-semibold text-gray-600">ولي الأمر</th>
                <th className="py-4 px-6 text-sm font-semibold text-gray-600">السورة</th>
                <th className="py-4 px-6 text-sm font-semibold text-gray-600">الموضع / الثمن</th>
                <th className="py-4 px-6 text-sm font-semibold text-gray-600 w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && <tr><td colSpan={6} className="py-12 text-center text-gray-500">جاري التحميل...</td></tr>}
              {filtered?.map((student: any) => {
                const parseReach = (reach: string | null) => {
                  if (!reach) return { surah: '-', part: '-' };
                  if (reach.includes('|')) {
                    const snippet = reach.split('|')[1].trim(); // "سورة النساء (بِسْمِ ٱللَّهِ...)"
                    const surah = snippet.split('(')[0].replace('سورة', '').trim();
                    const part = snippet.includes('(') ? '(' + snippet.split('(')[1] : '-';
                    return { surah, part };
                  }
                  if (reach.includes('سورة') && reach.includes('(') && reach.includes('-')) {
                    const surah = reach.substring(reach.indexOf('سورة'), reach.indexOf('-')).replace('سورة', '').trim();
                    const part = reach.substring(reach.indexOf('(')).trim();
                    return { surah, part };
                  }
                  return { surah: '-', part: reach };
                };
                
                const reachInfo = parseReach(student.currentReach);

                return (
                  <tr key={student.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-900">{student.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600 font-medium">
                      <span className="bg-gray-100 px-2 py-1 rounded-md">{student.serialNumber}</span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">{student.guardianName || '-'}</td>
                    <td className="py-4 px-6 text-sm text-gray-600 font-bold text-primary">
                      {reachInfo.surah !== '-' ? `سورة ${reachInfo.surah}` : '-'}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {reachInfo.part !== '-' ? (
                        <span className="bg-primary/5 text-primary px-3 py-1 rounded-lg font-medium">{reachInfo.part}</span>
                      ) : '-'}
                    </td>
                    <td className="py-4 px-6 text-left">
                      <Link 
                        to={`/students/${student.id}`} 
                        className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-primary hover:border-primary hover:bg-primary/5 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <ChevronLeft size={20} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered?.length === 0 && !isLoading && (
                <tr><td colSpan={6} className="py-12 text-center text-gray-500">لا يوجد طلاب يطابقون بحثك</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
