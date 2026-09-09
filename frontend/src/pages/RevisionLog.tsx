import { formatPart } from '../utils/formatPart';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Calendar, Check, Save, X, Repeat, CheckCircle, XCircle } from 'lucide-react'
import { Input } from '../components/ui/input'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { QuranSelector } from '../components/ui/quran-selector'

export default function RevisionLog() {
  const [search, setSearch] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const queryClient = useQueryClient()
  
  const [activeFormId, setActiveFormId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    status: '', // 'حفظ' or 'لم يحفظ'
    nextReviewFrom: '',
    nextReviewTo: '',
    notes: ''
  })

  const { data: students, isLoading } = useQuery({
    queryKey: ['students', date],
    queryFn: async () => {
      const res = await axios.get(`http://localhost:39281/students?date=${date}`)
      return res.data
    }
  })

  const addHistoryMutation = useMutation({
    mutationFn: async (data: any) => {
      await axios.post(`http://localhost:39281/students/${data.studentId}/history`, data)
    },
    onSuccess: () => {
      toast.success('تم الحفظ بنجاح')
      queryClient.invalidateQueries({ queryKey: ['students', date] })
      setActiveFormId(null)
    }
  })

  const updateStudentMutation = useMutation({
    mutationFn: async (data: { id: number, currentRevisionFrom: string, currentRevisionTo: string }) => {
      const { id, ...payload } = data;
      await axios.put(`http://localhost:39281/students/${id}`, payload)
    },
    onSuccess: () => {
      toast.success('تم تحديد الورد بنجاح')
      queryClient.invalidateQueries({ queryKey: ['students', date] })
      setActiveFormId(null)
    }
  })

  const handleStatusClick = (studentId: number, status: string, student: any) => {
    if (activeFormId === studentId && formData.status === status) {
      setActiveFormId(null)
    } else {
      setActiveFormId(studentId)
      setFormData({
        status,
        nextReviewFrom: student.currentRevisionFrom || '',
        nextReviewTo: student.currentRevisionTo || '',
        notes: ''
      })
    }
  }

  const filtered = students?.filter((s: any) => 
    s.name.includes(search) || s.serialNumber.includes(search)
  )

  const dateStr = format(new Date(date), 'yyyy-MM-dd')


  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Repeat className="text-primary" /> سجل المراجعة
          </h2>
          <p className="text-gray-500 text-sm mt-1">إدارة ورد المراجعة وتقييم الطلاب</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-auto">
            <Calendar className="absolute right-3 top-2.5 text-gray-400" size={20} />
            <Input 
              type="date"
              className="pr-10 w-full rounded-xl h-12" 
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
          <div className="relative w-full sm:w-64">
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

      <div className="space-y-4">
        {isLoading && <div className="text-center py-20 text-gray-500">جاري التحميل...</div>}
        {filtered?.length === 0 && !isLoading && (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 text-gray-500">لا يوجد طلاب يطابقون بحثك</div>
        )}
        
        {filtered?.map((student: any) => {
          const todayHistory = student.histories.find((h: any) => h.type === 'مراجعة')
          const isExpanded = activeFormId === student.id
          
          const hasRevisionSet = student.currentRevisionFrom || student.currentRevisionTo

          return (
            <div key={student.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              
              <div className="flex flex-col xl:flex-row gap-6 justify-between items-start">
                
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex items-center gap-3">
                    <Link to={`/students/${student.id}`} className="font-bold text-xl text-gray-900 hover:text-primary transition-colors truncate">
                      {student.name}
                    </Link>
                    <span className="bg-gray-100 px-2.5 py-1 rounded-md text-xs font-bold text-gray-500 border border-gray-200 shrink-0">
                      {student.serialNumber}
                    </span>
                  </div>
                  
                  <div className="flex flex-col lg:flex-row gap-3 mt-4">
                    <div className="text-sm text-gray-600 bg-gray-50 px-3.5 py-2.5 rounded-xl border border-gray-100 w-fit shrink-0 flex flex-col justify-center">
                      <span className="text-gray-400 font-bold mb-1 text-xs">مستوى الحفظ:</span>
                      <span className="font-bold text-gray-800 leading-tight">
                        {formatPart(student.currentReach)}
                      </span>
                    </div>

                    {hasRevisionSet ? (
                      <div className="text-sm text-blue-800 bg-blue-50/80 px-4 py-2.5 rounded-xl border border-blue-100 w-fit max-w-full flex flex-col gap-1 justify-center">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="text-blue-500 font-bold text-xs shrink-0">الورد الحالي للمراجعة:</span>
                          <span className="font-bold leading-tight break-words">
                            {formatPart(student.currentRevisionFrom)} - {formatPart(student.currentRevisionTo)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-orange-700 bg-orange-50/80 px-4 py-2.5 rounded-xl border border-orange-200 w-fit max-w-full flex items-center font-medium">
                        لم يتم تحديد ورد مراجعة لهذا الطالب
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-wrap xl:justify-end gap-2 w-full xl:w-auto shrink-0 mt-2 xl:mt-0">
                  {!hasRevisionSet ? (
                    <button
                      onClick={() => handleStatusClick(student.id, 'تحديد', student)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                        (isExpanded && formData.status === 'تحديد')
                          ? 'bg-blue-50 border-2 border-blue-500 text-blue-700 shadow-sm' 
                          : 'bg-gray-50 border-2 border-transparent text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                      }`}
                    >
                      <Repeat size={18} /> تحديد الورد
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleStatusClick(student.id, 'حفظ', student)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                          (isExpanded ? formData.status === 'حفظ' : todayHistory?.status === 'حفظ')
                            ? 'bg-green-50 border-2 border-green-500 text-green-700 shadow-sm' 
                            : 'bg-gray-50 border-2 border-transparent text-gray-600 hover:bg-green-50 hover:text-green-600'
                        }`}
                      >
                        <CheckCircle size={18} /> حفظ
                      </button>
                      <button
                        onClick={() => handleStatusClick(student.id, 'لم يحفظ', student)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                          (isExpanded ? formData.status === 'لم يحفظ' : todayHistory?.status === 'لم يحفظ')
                            ? 'bg-red-50 border-2 border-red-500 text-red-700 shadow-sm' 
                            : 'bg-gray-50 border-2 border-transparent text-gray-600 hover:bg-red-50 hover:text-red-600'
                        }`}
                      >
                        <XCircle size={18} /> لم يحفظ
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="mt-6 pt-6 border-t border-gray-200 animate-in slide-in-from-top-2 duration-300">
                  <div className={`p-5 rounded-2xl border ${formData.status === 'حفظ' ? 'bg-green-50/30 border-green-100' : formData.status === 'تحديد' ? 'bg-blue-50/30 border-blue-100' : 'bg-red-50/30 border-red-100'}`}>
                    
                    <h4 className={`font-bold mb-4 text-lg ${formData.status === 'حفظ' ? 'text-green-800' : formData.status === 'تحديد' ? 'text-blue-800' : 'text-red-800'}`}>
                      {formData.status === 'حفظ' ? 'تحديد ورد المراجعة القادم' : formData.status === 'تحديد' ? 'تحديد الورد الحالي' : 'تعديل الورد (لم يحفظ)'}
                    </h4>

                    {formData.status === 'لم يحفظ' && (
                      <p className="text-sm text-red-600 mb-4">
                        الطالب لم يكمل المراجعة بنجاح. يمكنك الإبقاء على نفس الورد للمرة القادمة، أو تقليله إذا لزم الأمر.
                      </p>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">من موضع</label>
                        <QuranSelector 
                          value={formData.nextReviewFrom}
                          onChange={val => setFormData({...formData, nextReviewFrom: val})}
                          className="z-30"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">إلى موضع</label>
                        <QuranSelector 
                          value={formData.nextReviewTo}
                          onChange={val => setFormData({...formData, nextReviewTo: val})}
                          className="z-20"
                        />
                      </div>

                      {formData.status !== 'تحديد' && (
                        <div className="space-y-2 pt-2">
                          <label className="block text-sm font-medium text-gray-700">ملاحظات إضافية</label>
                          <Input 
                            placeholder="مثال: يرجى التركيز أكثر على الحفظ..."
                            value={formData.notes}
                            onChange={e => setFormData({...formData, notes: e.target.value})}
                            className="bg-white"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-6 flex justify-end gap-3">
                      <button 
                        onClick={() => setActiveFormId(null)}
                        className="rounded-xl px-6 py-2.5 font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        إلغاء
                      </button>
                      {formData.status === 'تحديد' ? (
                        <button 
                          onClick={() => updateStudentMutation.mutate({ 
                            id: student.id, 
                            currentRevisionFrom: formData.nextReviewFrom, 
                            currentRevisionTo: formData.nextReviewTo 
                          })}
                          disabled={updateStudentMutation.isPending}
                          className="rounded-xl px-8 py-2.5 font-bold flex items-center gap-2 transition-colors text-white bg-blue-600 hover:bg-blue-700"
                        >
                          <Save size={18} />
                          حفظ الورد
                        </button>
                      ) : (
                        <button 
                          onClick={() => addHistoryMutation.mutate({ 
                            studentId: student.id, 
                            date, 
                            type: 'مراجعة',
                            status: formData.status,
                            fromPart: student.currentRevisionFrom, // the revision they tested on today
                            toPart: student.currentRevisionTo,
                            nextReviewFrom: formData.nextReviewFrom, // their assignment for next time
                            nextReviewTo: formData.nextReviewTo,
                            notes: formData.notes
                          })}
                          disabled={addHistoryMutation.isPending}
                          className={`rounded-xl px-8 py-2.5 font-bold flex items-center gap-2 transition-colors text-white ${
                            formData.status === 'حفظ' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                          }`}
                        >
                          <Save size={18} />
                          حفظ {formData.status === 'حفظ' ? 'الورد الجديد' : 'النتيجة'}
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
