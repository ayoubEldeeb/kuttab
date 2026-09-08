import { formatPart } from '../utils/formatPart';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Check, Calendar, ChevronDown, ChevronUp, Save, X } from 'lucide-react'
import { Button } from "../components/ui/button";
import { Input } from '../components/ui/input'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { QuranSelector } from '../components/ui/quran-selector'

const STATUS_OPTIONS = [
  "لم يحضر",
  "عرض ولم يحفظ",
  "عرض وحفظ وكتب",
  "عرض وحفظ ولم يكتب",
  "كتب فقط"
]

export default function DailyLog() {
  const [search, setSearch] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const queryClient = useQueryClient()
  
  const [activeFormId, setActiveFormId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    status: '',
    type: 'تسميع',
    fromPart: '',
    toPart: '',
    nextReviewDate: '',
    nextReviewFrom: '',
    nextReviewTo: '',
    notes: '',
    writtenParts: [] as string[]
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

  const handleStatusClick = (studentId: number, opt: string, todayHistory?: any) => {
    if (opt === 'لم يحضر') {
      addHistoryMutation.mutate({ studentId, status: opt, date })
      setActiveFormId(null)
    } else {
      if (activeFormId === studentId && formData.status === opt) {
        // Toggle off if clicking the same
        setActiveFormId(null)
      } else {
        // Open form
        let parsedWrittenParts = [];
        try {
          if (todayHistory?.writtenParts) parsedWrittenParts = JSON.parse(todayHistory.writtenParts);
        } catch (e) {}

        setActiveFormId(studentId)
        setFormData({
          status: opt,
          type: todayHistory?.type || 'تسميع',
          fromPart: todayHistory?.fromPart || '',
          toPart: todayHistory?.toPart || '',
          nextReviewDate: todayHistory?.nextReviewDate ? new Date(todayHistory.nextReviewDate).toISOString().split('T')[0] : '',
          nextReviewFrom: todayHistory?.nextReviewFrom || '',
          nextReviewTo: todayHistory?.nextReviewTo || '',
          notes: todayHistory?.notes || '',
          writtenParts: parsedWrittenParts.length > 0 ? parsedWrittenParts : ['']
        })
      }
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
          <h2 className="text-2xl font-bold text-gray-900">السجل اليومي</h2>
          <p className="text-gray-500 text-sm mt-1">تسجيل حالة الطلاب ومتابعتهم يومياً</p>
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
          const todayHistory = student.histories[0]
          const isExpanded = activeFormId === student.id

          return (
            <div key={student.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              
              {/* Header / Basic Status */}
              <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div className="flex-1 min-w-0">
                  <Link to={`/students/${student.id}`} className="font-bold text-lg text-gray-900 hover:text-primary transition-colors block truncate">
                    {student.name}
                  </Link>
                  <div className="flex flex-col gap-1.5 mt-2">
                    <div>
                      <span className="bg-gray-100 px-2 py-0.5 rounded-md text-xs font-bold text-gray-500 border border-gray-200">{student.serialNumber}</span>
                    </div>
                    <div className="text-sm text-gray-500 flex items-start gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100 w-fit max-w-full">
                      <span className="text-gray-400 font-bold whitespace-nowrap">مستوى الحفظ:</span>
                      <span className="font-bold text-gray-700 leading-tight break-words">
                        {student.currentReach ? formatPart(student.currentReach) : 'لم يحدد المستوى'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 md:justify-end">
                  {STATUS_OPTIONS.map(opt => {
                    const isSelected = isExpanded ? formData.status === opt : todayHistory?.status === opt
                    
                    return (
                      <button
                        key={opt}
                        onClick={() => handleStatusClick(student.id, opt, todayHistory)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                          isSelected 
                            ? (opt === 'لم يحضر' ? 'bg-red-50 border-2 border-red-500 text-red-600' : 'bg-primary/5 border-2 border-primary text-primary shadow-sm') 
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-2 border-transparent'
                        }`}
                      >
                        {isSelected && <Check size={16} className="inline ml-2" />}
                        {opt}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Today's Progress Summary */}
              {!isExpanded && todayHistory && todayHistory.status !== 'لم يحضر' && (
                <div className="mt-5 bg-blue-50/30 border border-blue-100 rounded-2xl p-5 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center relative overflow-hidden">
                  {/* Decorative background element */}
                  <div className="absolute top-0 right-0 w-2 h-full bg-blue-400 rounded-r-2xl"></div>
                  
                  <div className="flex flex-col md:flex-row gap-8 pr-2 w-full">
                    {/* Status Badge (always visible) */}
                    <div>
                      <span className="text-xs text-gray-400 font-bold block mb-1.5">الحالة المسجلة:</span>
                      <span className={`text-sm font-bold px-3 py-1 rounded-lg ${
                        todayHistory.status.includes('كتب') ? 'bg-purple-100 text-purple-700' :
                        todayHistory.status.includes('حفظ') ? 'bg-green-100 text-green-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {todayHistory.status}
                      </span>
                    </div>

                    {(todayHistory.fromPart || todayHistory.toPart) && (
                      <div className="md:border-r border-gray-200 md:pr-8 flex-1">
                        <span className="text-xs text-gray-500 font-bold block mb-2">
                          {todayHistory.type === 'مراجعة' ? 'تمت مراجعته اليوم:' : 'تم تسميعه اليوم:'}
                        </span>
                        <div className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                          {todayHistory.fromPart && (
                            <div className="flex items-start gap-2">
                              <span className="text-gray-400 text-xs mt-0.5 font-bold w-6">من:</span>
                              <span className="leading-tight">{formatPart(todayHistory.fromPart)}</span>
                            </div>
                          )}
                          {todayHistory.toPart && (
                            <div className="flex items-start gap-2">
                              <span className="text-gray-400 text-xs mt-0.5 font-bold w-6">إلى:</span>
                              <span className="leading-tight">{formatPart(todayHistory.toPart)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {todayHistory.status.includes('كتب') && todayHistory.writtenParts && (
                      (() => {
                        try {
                          const parts = JSON.parse(todayHistory.writtenParts);
                          if (parts.length > 0) {
                            return (
                              <div className="md:border-r border-gray-200 md:pr-8">
                                <span className="text-xs text-purple-500 font-bold block mb-2">تمت كتابته:</span>
                                <div className="text-sm font-bold text-purple-700 bg-purple-100/50 px-3 py-1.5 rounded-lg inline-block border border-purple-200 cursor-help" title={parts.map((p: string) => formatPart(p)).join('\n')}>
                                  {parts.length} أثمان مكتوبة
                                </div>
                              </div>
                            )
                          }
                        } catch (e) {}
                        return null;
                      })()
                    )}

                    {(todayHistory.nextReviewFrom || todayHistory.nextReviewTo) && (
                      <div className="md:border-r border-gray-200 md:pr-8 flex-1">
                        <span className="text-xs text-blue-500 font-bold block mb-2">الواجب القادم:</span>
                        <div className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                          {todayHistory.nextReviewFrom && (
                            <div className="flex items-start gap-2">
                              <span className="text-gray-400 text-xs mt-0.5 font-bold w-6">من:</span>
                              <span className="leading-tight">{formatPart(todayHistory.nextReviewFrom)}</span>
                            </div>
                          )}
                          {todayHistory.nextReviewTo && (
                            <div className="flex items-start gap-2">
                              <span className="text-gray-400 text-xs mt-0.5 font-bold w-6">إلى:</span>
                              <span className="leading-tight">{formatPart(todayHistory.nextReviewTo)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {todayHistory.notes && (
                      <div className="md:border-r border-gray-200 md:pr-8 flex-1">
                        <span className="text-xs text-gray-500 font-bold block mb-2">ملاحظات:</span>
                        <div className="text-sm font-medium text-gray-700 bg-white/50 p-2 rounded-lg border border-gray-100">
                          {todayHistory.notes}
                        </div>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => handleStatusClick(student.id, todayHistory.status, todayHistory)}
                    className="shrink-0 text-sm font-bold text-primary bg-white border border-primary/20 hover:bg-primary hover:text-white px-5 py-2.5 rounded-xl transition-all shadow-sm w-full md:w-auto"
                  >
                    تعديل السجل
                  </button>
                </div>
              )}

              {/* Expanded Detailed Form */}
              {isExpanded && (
                <div className="mt-6 pt-6 border-t border-gray-200 animate-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Right Side: What was recited today */}
                    <div className="space-y-5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">1</div>
                        <h4 className="font-bold text-gray-900">سجل اليوم ({formData.status})</h4>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">نوع التسميع</label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
                              name={`type-${student.id}`} 
                              checked={formData.type === 'تسميع'}
                              onChange={() => setFormData({...formData, type: 'تسميع'})}
                              className="text-primary w-4 h-4"
                            />
                            <span className="text-sm font-bold">تسميع (جديد)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
                              name={`type-${student.id}`} 
                              checked={formData.type === 'مراجعة'}
                              onChange={() => setFormData({...formData, type: 'مراجعة'})}
                              className="text-primary w-4 h-4"
                            />
                            <span className="text-sm font-bold">مراجعة</span>
                          </label>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">المقدار (من - إلى)</label>
                        <QuranSelector 
                          value={formData.fromPart}
                          onChange={val => setFormData({...formData, fromPart: val})}
                          placeholder="من موضع..."
                          className="z-50"
                        />
                        <QuranSelector 
                          value={formData.toPart}
                          onChange={val => setFormData({...formData, toPart: val})}
                          placeholder="إلى موضع..."
                          className="z-40"
                        />
                      </div>

                      {formData.status.includes('كتب') && (
                        <div className="space-y-3 pt-4 border-t border-gray-200">
                          <div className="flex justify-between items-center">
                            <label className="block text-sm font-medium text-gray-700">ما تم كتابته (الأثمان)</label>
                            <button 
                              onClick={() => setFormData({...formData, writtenParts: [...formData.writtenParts, '']})}
                              className="text-xs text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-md transition-colors"
                            >
                              + إضافة ثمن
                            </button>
                          </div>
                          
                          {formData.writtenParts.map((part, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="flex-1">
                                <QuranSelector 
                                  value={part}
                                  onChange={val => {
                                    const newParts = [...formData.writtenParts];
                                    newParts[index] = val;
                                    setFormData({...formData, writtenParts: newParts});
                                  }}
                                  placeholder={`الثمن رقم ${index + 1}...`}
                                  className={`z-[${30 - index}]`} // To handle overlap
                                />
                              </div>
                              {formData.writtenParts.length > 1 && (
                                <button 
                                  onClick={() => {
                                    const newParts = formData.writtenParts.filter((_, i) => i !== index);
                                    setFormData({...formData, writtenParts: newParts});
                                  }}
                                  className="text-gray-400 hover:text-red-500 p-2"
                                  title="حذف هذا الثمن"
                                >
                                  <X size={18} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Left Side: Next Assignment */}
                    <div className="space-y-5 bg-gray-50/50 p-5 rounded-2xl border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">2</div>
                        <h4 className="font-bold text-gray-900">الواجب القادم (التحضير)</h4>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">تاريخ المراجعة القادمة</label>
                        <Input 
                          type="date"
                          value={formData.nextReviewDate}
                          onChange={e => setFormData({...formData, nextReviewDate: e.target.value})}
                          className="bg-white h-12 rounded-xl"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">مقدار الواجب (من - إلى)</label>
                        <QuranSelector 
                          value={formData.nextReviewFrom}
                          onChange={val => setFormData({...formData, nextReviewFrom: val})}
                          placeholder="من موضع..."
                          className="z-30"
                        />
                        <QuranSelector 
                          value={formData.nextReviewTo}
                          onChange={val => setFormData({...formData, nextReviewTo: val})}
                          placeholder="إلى موضع..."
                          className="z-20"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات (اختياري)</label>
                    <textarea 
                      className="w-full rounded-xl border-gray-200 bg-white p-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none border min-h-[80px] text-sm resize-none"
                      placeholder="أضف أي ملاحظات حول أداء الطالب..."
                      value={formData.notes}
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                    />
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <Button 
                       
                      onClick={() => setActiveFormId(null)}
                      className="rounded-xl px-6"
                    >
                      إلغاء
                    </Button>
                    <Button 
                      onClick={() => {
                        const payload = { 
                          ...formData, 
                          studentId: student.id, 
                          date,
                          writtenParts: JSON.stringify(formData.writtenParts.filter(p => p.trim() !== ''))
                        };
                        addHistoryMutation.mutate(payload);
                      }}
                      disabled={addHistoryMutation.isPending}
                      className="rounded-xl px-8 flex items-center gap-2"
                    >
                      <Save size={18} />
                      حفظ السجل
                    </Button>
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
