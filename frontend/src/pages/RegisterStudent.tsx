import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'

export default function RegisterStudent() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    guardianName: '',
    guardianPhone: '',
    currentReach: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await axios.post('http://localhost:39281/students', formData)
      navigate('/')
    } catch (error) {
      console.error(error)
      alert('حدث خطأ أثناء التسجيل')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold mb-2">تسجيل طالب جديد</h2>
        <p className="text-gray-500 text-sm mb-6">أدخل بيانات الطالب الجديد ليتم إنشاء رقم متسلسل تلقائياً.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">اسم الطالب (مطلوب)</label>
            <Input 
              required
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="الاسم الرباعي"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">اسم ولي الأمر (اختياري)</label>
              <Input 
                value={formData.guardianName}
                onChange={e => setFormData({...formData, guardianName: e.target.value})}
                placeholder="اسم الولي"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">رقم الهاتف (اختياري)</label>
              <Input 
                value={formData.guardianPhone}
                onChange={e => setFormData({...formData, guardianPhone: e.target.value})}
                placeholder="05XXXXXXXX"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">مكان الوصول في الحفظ</label>
            <Input 
              value={formData.currentReach}
              onChange={e => setFormData({...formData, currentReach: e.target.value})}
              placeholder="مثال: سورة البقرة، الجزء الثلاثون..."
            />
          </div>

          <div className="pt-4">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'جاري التسجيل...' : 'تسجيل الطالب'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
