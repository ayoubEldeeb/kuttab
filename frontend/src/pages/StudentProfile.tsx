import { formatPart } from '../utils/formatPart';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { format, subDays, isSameDay } from 'date-fns'
import { ar } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { ArrowRight, Book, Phone, User, Calendar, Target, Activity, Edit2, X, Check, Repeat } from 'lucide-react'
import { QuranSelector } from '../components/ui/quran-selector'

const STATUS_OPTIONS = [
  "لم يحضر",
  "عرض ولم يحفظ",
  "عرض وحفظ وكتب",
  "عرض وحفظ ولم يكتب",
  "كتب فقط"
]

const STATUS_COLORS: Record<string, string> = {
  "لم يحضر": "bg-red-100 text-red-700",
  "عرض ولم يحفظ": "bg-orange-100 text-orange-700",
  "عرض وحفظ ولم يكتب": "bg-blue-100 text-blue-700",
  "عرض وحفظ وكتب": "bg-green-100 text-green-700",
  "كتب فقط": "bg-purple-100 text-purple-700",
  "حفظ": "bg-green-100 text-green-700",
  "لم يحفظ": "bg-red-100 text-red-700"
}

export default function StudentProfile() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [formData, setFormData] = useState({
    status: STATUS_OPTIONS[1],
    type: 'تسميع',
    fromPart: '',
    toPart: '',
    nextReviewDate: '',
    nextReviewFrom: '',
    nextReviewTo: '',
    notes: '',
    writtenParts: [] as string[]
  })
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ 
    name: '', guardianName: '', guardianPhone: '', 
    currentReach: '', currentRevisionFrom: '', currentRevisionTo: '' 
  })

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      const res = await axios.get(`http://localhost:39281/students/${id}`)
      return res.data
    }
  })

  // Initialize edit form when student data loads or edit mode triggers
  useEffect(() => {
    if (student && isEditing) {
      setEditForm({
        name: student.name || '',
        guardianName: student.guardianName || '',
        guardianPhone: student.guardianPhone || '',
        currentReach: student.currentReach || '',
        currentRevisionFrom: student.currentRevisionFrom || '',
        currentRevisionTo: student.currentRevisionTo || ''
      })
    }
  }, [student, isEditing])

  const addHistoryMutation = useMutation({
    mutationFn: async (data: any) => {
      await axios.post(`http://localhost:39281/students/${id}/history`, data)
    },
    onSuccess: () => {
      toast.success('تم تسجيل المتابعة بنجاح')
      queryClient.invalidateQueries({ queryKey: ['student', id] })
      setFormData(prev => ({
        ...prev,
        fromPart: '', toPart: '', nextReviewFrom: '', nextReviewTo: '', notes: '', writtenParts: []
      }))
    }
  })

  const updateStudentMutation = useMutation({
    mutationFn: async (data: any) => {
      await axios.put(`http://localhost:39281/students/${id}`, data)
    },
    onSuccess: () => {
      toast.success('تم تحديث بيانات الطالب بنجاح')
      queryClient.invalidateQueries({ queryKey: ['student', id] })
      setIsEditing(false)
    }
  })

  if (isLoading) return <div className="text-center py-20 text-gray-500">جاري تحميل بيانات الطالب...</div>
  if (!student) return <div className="text-center py-20 text-red-500">الطالب غير موجود</div>

  // Generate last 14 days for activity heatmap
  const last14Days = Array.from({ length: 14 }, (_, i) => subDays(new Date(), 13 - i))
  
  const getActivityColor = (day: Date) => {
    const historyForDay = student.histories.find((h: any) => isSameDay(new Date(h.date), day))
    if (!historyForDay) return 'bg-gray-100 text-gray-400'
    return historyForDay.status === 'لم يحضر' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <Link to="/students" className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowRight size={20} />
        </Link>
        <h2 className="text-xl font-bold text-gray-900">ملف الطالب</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Right Column (Info Card) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col relative">
            
            {/* Edit / Save Buttons */}
            <div className="absolute left-6 top-6">
              {!isEditing ? (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="w-8 h-8 rounded-full bg-gray-50 text-gray-500 hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-colors"
                  title="تعديل البيانات"
                >
                  <Edit2 size={16} />
                </button>
              ) : (
                <div className="flex gap-2">
                  <button 
                    onClick={() => updateStudentMutation.mutate(editForm)}
                    disabled={updateStudentMutation.isPending}
                    className="w-8 h-8 rounded-full bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors disabled:opacity-50"
                    title="حفظ"
                  >
                    <Check size={16} />
                  </button>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="w-8 h-8 rounded-full bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors"
                    title="إلغاء"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center text-center pb-6 border-b border-gray-200">
              <div className="w-24 h-24 bg-primary/10 text-primary rounded-3xl flex items-center justify-center text-3xl font-bold mb-4 shadow-sm">
                {student.name.substring(0, 1)}
              </div>
              
              {!isEditing ? (
                <>
                  <div className="font-bold text-gray-900 text-xl">{student.name}</div>
                  <div className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-sm font-medium mt-2">{student.serialNumber}</div>
                </>
              ) : (
                <div className="w-full space-y-2 px-2 mt-2">
                  <label className="text-xs text-gray-500 block text-right">اسم الطالب</label>
                  <Input 
                    value={editForm.name}
                    onChange={e => setEditForm({...editForm, name: e.target.value})}
                    className="h-10 text-center font-bold"
                  />
                  <div className="bg-gray-100 text-gray-500 px-3 py-1 rounded-lg text-sm font-medium mx-auto w-fit mt-1">{student.serialNumber}</div>
                </div>
              )}
            </div>

            <div className="pt-6 space-y-5">
              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                  <User size={18} />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-400 font-medium">ولي الأمر</div>
                  {!isEditing ? (
                    <div className="font-semibold text-gray-900">{student.guardianName || 'غير محدد'}</div>
                  ) : (
                    <Input 
                      value={editForm.guardianName}
                      onChange={e => setEditForm({...editForm, guardianName: e.target.value})}
                      className="h-8 mt-1 text-sm"
                      placeholder="اسم ولي الأمر"
                    />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                  <Phone size={18} />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-400 font-medium">رقم الهاتف</div>
                  {!isEditing ? (
                    <div className="font-semibold text-gray-900" dir="ltr">{student.guardianPhone || 'غير محدد'}</div>
                  ) : (
                    <Input 
                      value={editForm.guardianPhone}
                      onChange={e => setEditForm({...editForm, guardianPhone: e.target.value})}
                      className="h-8 mt-1 text-sm text-right"
                      placeholder="رقم الهاتف"
                      dir="ltr"
                    />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Book size={18} />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-400 font-medium">مستوى الحفظ الحالي</div>
                  {!isEditing ? (
                    <div className="font-bold text-primary text-sm leading-tight mt-1">
                      {student.currentReach 
                        ? (student.currentReach.includes('|') 
                            ? `سورة ${student.currentReach.match(/\| سورة ([^\(]+)/)?.[1]?.trim() || ''} - ${student.currentReach.replace(/ \| سورة [^\(]+/, '').trim()}` 
                            : student.currentReach) 
                        : 'غير محدد'}
                    </div>
                  ) : (
                    <div className="mt-2 -mx-8 w-[calc(100%+4rem)] sm:mx-0 sm:w-full">
                      <QuranSelector 
                        value={editForm.currentReach}
                        onChange={val => setEditForm({...editForm, currentReach: val})}
                        className="text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                  <Repeat size={18} />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-400 font-medium">ورد المراجعة الحالي</div>
                  {!isEditing ? (
                    <div className="font-bold text-blue-600 text-sm leading-tight mt-1">
                      {student.currentRevisionFrom || student.currentRevisionTo ? (
                        <>
                          <div className="truncate">من: {student.currentRevisionFrom ? (student.currentRevisionFrom.includes('|') ? student.currentRevisionFrom.replace(/ \| سورة [^\(]+/, '').trim() : student.currentRevisionFrom) : '-'}</div>
                          <div className="truncate mt-1">إلى: {student.currentRevisionTo ? (student.currentRevisionTo.includes('|') ? student.currentRevisionTo.replace(/ \| سورة [^\(]+/, '').trim() : student.currentRevisionTo) : '-'}</div>
                        </>
                      ) : 'غير محدد'}
                    </div>
                  ) : (
                    <div className="mt-2 -mx-8 w-[calc(100%+4rem)] sm:mx-0 sm:w-full space-y-2">
                      <QuranSelector 
                        value={editForm.currentRevisionFrom}
                        onChange={val => setEditForm({...editForm, currentRevisionFrom: val})}
                        className="text-sm z-20"
                        placeholder="من موضع..."
                      />
                      <QuranSelector 
                        value={editForm.currentRevisionTo}
                        onChange={val => setEditForm({...editForm, currentRevisionTo: val})}
                        className="text-sm z-10"
                        placeholder="إلى موضع..."
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                  <Calendar size={18} />
                </div>
                <div>
                  <div className="text-xs text-gray-400 font-medium">تاريخ التسجيل</div>
                  <div className="font-semibold text-gray-900">{format(new Date(student.createdAt), 'dd MMMM yyyy', { locale: ar })}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Left Column (Forms & Lists) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Heatmap */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="text-primary" size={20} />
              <h3 className="font-bold text-gray-900">مؤشر النشاط (آخر 14 يوم)</h3>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" dir="ltr">
              {last14Days.map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-1 min-w-[36px]">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm ${getActivityColor(day)}`}>
                    {format(day, 'd')}
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">{format(day, 'EEEEEE', { locale: ar })}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Add History Form */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col h-fit">
              <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-4">
                <Target className="text-primary" size={20} />
                <h3 className="font-bold text-gray-900 text-lg">تسجيل متابعة</h3>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">التاريخ</label>
                  <Input 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)} 
                    className="h-12 rounded-xl"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">التقييم</label>
                  <select 
                    className="w-full h-12 rounded-xl border-gray-200 bg-white px-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none border mb-4"
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                  >
                    {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>

                {formData.status !== 'لم يحضر' && (
                  <>
                    <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">نوع التسميع</label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
                              checked={formData.type === 'تسميع'}
                              onChange={() => setFormData({...formData, type: 'تسميع'})}
                              className="text-primary w-4 h-4"
                            />
                            <span className="text-sm font-bold">تسميع (جديد)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
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
                            <label className="block text-sm font-medium text-gray-700">ما تم كتابته</label>
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
                                  placeholder={'الثمن رقم ' + (index + 1)}
                                  className={'z-[' + (30 - index) + ']'}
                                />
                              </div>
                              {formData.writtenParts.length > 1 && (
                                <button 
                                  onClick={() => {
                                    const newParts = formData.writtenParts.filter((_, i) => i !== index);
                                    setFormData({...formData, writtenParts: newParts});
                                  }}
                                  className="text-gray-400 hover:text-red-500 p-2"
                                >
                                  <X size={18} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-100 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-bold text-gray-900 text-sm">الواجب القادم (التحضير)</h4>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">تاريخ المراجعة القادمة</label>
                        <Input 
                          type="date"
                          value={formData.nextReviewDate}
                          onChange={e => setFormData({...formData, nextReviewDate: e.target.value})}
                          className="bg-white h-10 rounded-lg text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-gray-700">مقدار الواجب</label>
                        <QuranSelector 
                          value={formData.nextReviewFrom}
                          onChange={val => setFormData({...formData, nextReviewFrom: val})}
                          placeholder="من موضع..."
                          className="z-20 text-sm"
                        />
                        <QuranSelector 
                          value={formData.nextReviewTo}
                          onChange={val => setFormData({...formData, nextReviewTo: val})}
                          placeholder="إلى موضع..."
                          className="z-10 text-sm"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات (اختياري)</label>
                  <textarea 
                    className="w-full rounded-xl border-gray-200 bg-white p-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none border min-h-[80px] text-sm resize-none"
                    placeholder="أضف أي ملاحظات حول أداء الطالب..."
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                  />
                </div>
                
                <Button 
                  className="w-full h-12 rounded-xl text-base mt-2" 
                  onClick={() => {
                    const payload = {
                      ...formData,
                      date,
                      writtenParts: JSON.stringify(formData.writtenParts.filter(p => p.trim() !== ''))
                    };
                    addHistoryMutation.mutate(payload);
                  }}
                  disabled={addHistoryMutation.isPending}
                >
                  {addHistoryMutation.isPending ? 'جاري التسجيل...' : 'حفظ المتابعة'}
                </Button>
              </div>
            </div>

            {/* History List */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-4">
                <Book className="text-primary" size={20} />
                <h3 className="font-bold text-gray-900 text-lg">سجل التسميع والحفظ التفصيلي</h3>
              </div>
              
              <div className="space-y-4">
                {student.histories.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">لا توجد سجلات سابقة</div>
                ) : (
                  student.histories.map((history: any) => (
                    <div key={history.id} className="p-4 rounded-xl border border-gray-200 hover:border-gray-200 transition-colors bg-gray-50/30">
                      <div className="flex justify-between items-start mb-3 border-b border-gray-200 pb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-3 py-1 rounded-lg text-xs font-bold ${STATUS_COLORS[history.status] || 'bg-gray-100 text-gray-700'}`}>
                            {history.status}
                          </span>
                          {history.type && (
                            <span className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">
                              {history.type}
                            </span>
                          )}
                        </div>
                        <div className="text-center bg-white border border-gray-200 rounded-lg px-3 py-1 shadow-sm">
                          <div className="text-sm font-bold text-primary">{format(new Date(history.date), 'dd')}</div>
                          <div className="text-[10px] text-gray-500 font-medium">{format(new Date(history.date), 'MMMM', { locale: ar })}</div>
                          <div className="text-[10px] text-gray-400">{format(new Date(history.date), 'yyyy')}</div>
                        </div>
                      </div>

                      {/* Display Recitation Range */}
                      {(history.fromPart || history.toPart) && (
                        <div className="mb-3 space-y-1">
                          <div className="text-xs text-gray-500 font-bold">المقدار المُسمّع:</div>
                          <div className="text-sm text-gray-700 bg-white p-2 rounded-lg border border-gray-200">
                            من: <span className="font-semibold text-primary">{history.fromPart ? formatPart(history.fromPart) : '-'}</span>
                            <br/>
                            إلى: <span className="font-semibold text-primary">{history.toPart ? formatPart(history.toPart) : '-'}</span>
                          </div>
                        </div>
                      )}

                      {/* Display Next Assignment */}
                      {(history.nextReviewFrom || history.nextReviewTo || history.nextReviewDate) && (
                        <div className="mb-3 space-y-1">
                          <div className="flex justify-between items-center">
                            <div className="text-xs text-blue-600 font-bold">الواجب القادم:</div>
                            {history.nextReviewDate && (
                              <div className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 font-medium">
                                لتاريخ: {format(new Date(history.nextReviewDate), 'dd MMMM yyyy', { locale: ar })}
                              </div>
                            )}
                          </div>
                          <div className="text-sm text-gray-700 bg-blue-50/30 p-2 rounded-lg border border-blue-100">
                            من: <span className="font-semibold text-blue-700">{history.nextReviewFrom ? formatPart(history.nextReviewFrom) : '-'}</span>
                            <br/>
                            إلى: <span className="font-semibold text-blue-700">{history.nextReviewTo ? formatPart(history.nextReviewTo) : '-'}</span>
                          </div>
                        </div>
                      )}

                      {history.notes && (
                        <p className="text-sm text-gray-600 mt-2 bg-white p-3 rounded-lg border border-gray-200 relative">
                          <span className="absolute top-2 right-2 text-xs font-bold text-gray-400">ملاحظات:</span>
                          <span className="block mt-4">{history.notes}</span>
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
