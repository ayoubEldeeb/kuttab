import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { QuranSelector } from '../components/ui/quran-selector'
import toast from 'react-hot-toast'
import { UserPlus, User, Phone, Book } from 'lucide-react'

export default function RegisterStudent() {
  const [formData, setFormData] = useState({
    name: '',
    guardianName: '',
    guardianPhone: '',
    currentReach: ''
  })
  
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await axios.post('http://localhost:39281/students', data)
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toast.success('تم تسجيل الطالب بنجاح')
      navigate(`/students/${data.id}`)
    },
    onError: () => {
      toast.error('حدث خطأ أثناء التسجيل')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast.error('يرجى إدخال اسم الطالب')
      return
    }
    mutation.mutate(formData)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-4">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary">
          <UserPlus size={32} />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">تسجيل طالب جديد</h2>
        <p className="text-gray-500">أدخل بيانات الطالب الجديد لإنشاء ملفه في النظام</p>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-[rgba(0,0,0,0.02)_0px_0px_20px] border border-gray-200">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <User size={16} className="text-gray-400" />
              اسم الطالب الرباعي <span className="text-red-500">*</span>
            </label>
            <Input 
              name="name"
              placeholder="مثال: أحمد محمد محمود"
              value={formData.name}
              onChange={handleChange}
              className="h-12 rounded-xl"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <User size={16} className="text-gray-400" />
                اسم ولي الأمر
              </label>
              <Input 
                name="guardianName"
                placeholder="اسم ولي الأمر"
                value={formData.guardianName}
                onChange={handleChange}
                className="h-12 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Phone size={16} className="text-gray-400" />
                رقم هاتف ولي الأمر
              </label>
              <Input 
                name="guardianPhone"
                placeholder="رقم الهاتف"
                value={formData.guardianPhone}
                onChange={handleChange}
                dir="ltr"
                className="h-12 rounded-xl text-right"
              />
            </div>
          </div>

          <div className="space-y-2 z-50">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Book size={16} className="text-gray-400" />
              مستوى الحفظ الحالي (السورة، الربع، أو الثمن)
            </label>
            <QuranSelector 
              value={formData.currentReach} 
              onChange={(val) => setFormData(prev => ({ ...prev, currentReach: val }))}
            />
          </div>

          <div className="pt-4">
            <Button 
              type="submit" 
              className="w-full h-12 text-lg rounded-xl shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'جاري التسجيل...' : 'تسجيل الطالب'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
