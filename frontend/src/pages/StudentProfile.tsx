import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'

const STATUS_OPTIONS = [
  "عرض ولم يحفظ",
  "عرض وحفظ وكتب",
  "عرض وحفظ ولم يكتب",
  "كتب فقط"
]

export default function StudentProfile() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState(STATUS_OPTIONS[0])
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      const res = await axios.get(`http://localhost:39281/students/${id}`)
      return res.data
    }
  })

  const addHistoryMutation = useMutation({
    mutationFn: async (data: any) => {
      await axios.post(`http://localhost:39281/students/${id}/history`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', id] })
      setNotes('')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addHistoryMutation.mutate({ status, notes, date })
  }

  if (isLoading) return <div>جاري التحميل...</div>
  if (!student) return <div>الطالب غير موجود</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xl font-bold mb-4">
            {student.name.substring(0, 1)}
          </div>
          <h2 className="text-xl font-bold">{student.name}</h2>
          <p className="text-gray-500 mb-4">{student.serialNumber}</p>
          
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-500 block">ولي الأمر:</span>
              <span className="font-medium">{student.guardianName || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">رقم الهاتف:</span>
              <span className="font-medium" dir="ltr">{student.guardianPhone || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">وصل في الحفظ إلى:</span>
              <span className="font-medium">{student.currentReach || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">تاريخ التسجيل:</span>
              <span className="font-medium">{format(new Date(student.createdAt), 'dd MMMM yyyy', { locale: ar })}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="font-bold mb-4">تسجيل حالة التسميع اليومية</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">التاريخ</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm mb-1">حالة التسميع</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">ملاحظات (اختياري)</label>
              <textarea 
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={addHistoryMutation.isPending} className="w-full">
              {addHistoryMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </form>
        </div>
      </div>

      <div className="md:col-span-2">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-xl font-bold mb-6">سجل التسميع والحفظ</h3>
          
          <div className="space-y-6">
            {student.histories?.length === 0 && (
              <p className="text-gray-500 text-center py-8">لا يوجد سجل متابعة بعد.</p>
            )}
            {student.histories?.map((history: any) => (
              <div key={history.id} className="flex gap-4 border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                <div className="w-16 flex-shrink-0 text-center">
                  <div className="text-sm font-bold text-gray-900">{format(new Date(history.date), 'dd')}</div>
                  <div className="text-xs text-gray-500">{format(new Date(history.date), 'MMM', { locale: ar })}</div>
                </div>
                <div>
                  <div className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-2">
                    {history.status}
                  </div>
                  {history.notes && <p className="text-sm text-gray-700">{history.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
