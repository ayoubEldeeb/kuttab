import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Input } from '../components/ui/input'
import { useState } from 'react'

export default function StudentsList() {
  const [search, setSearch] = useState('')
  const { data: students, isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:39281/students')
      return res.data
    }
  })

  const filtered = students?.filter((s: any) => s.name.includes(search) || s.serialNumber.includes(search))

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold">قائمة الطلاب</h2>
          <p className="text-gray-500 text-sm mt-1">إدارة جميع طلاب المركز</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute right-3 top-2.5 text-gray-400" size={20} />
          <Input 
            className="pr-10" 
            placeholder="بحث بالاسم أو الرقم..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="py-3 px-6 text-sm font-medium text-gray-500">الرقم المتسلسل</th>
              <th className="py-3 px-6 text-sm font-medium text-gray-500">اسم الطالب</th>
              <th className="py-3 px-6 text-sm font-medium text-gray-500">الولي</th>
              <th className="py-3 px-6 text-sm font-medium text-gray-500">المستوى / الحفظ</th>
              <th className="py-3 px-6 text-sm font-medium text-gray-500">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && <tr><td colSpan={5} className="py-8 text-center text-gray-500">جاري التحميل...</td></tr>}
            {filtered?.map((student: any) => (
              <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-4 px-6 text-sm font-medium">{student.serialNumber}</td>
                <td className="py-4 px-6 text-sm text-gray-900 font-semibold">{student.name}</td>
                <td className="py-4 px-6 text-sm text-gray-500">{student.guardianName || '-'}</td>
                <td className="py-4 px-6 text-sm text-gray-500">{student.currentReach || '-'}</td>
                <td className="py-4 px-6 text-sm">
                  <Link to={`/students/${student.id}`} className="text-primary hover:underline font-medium">عرض التفاصيل</Link>
                </td>
              </tr>
            ))}
            {filtered?.length === 0 && !isLoading && (
              <tr><td colSpan={5} className="py-8 text-center text-gray-500">لا يوجد طلاب</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
