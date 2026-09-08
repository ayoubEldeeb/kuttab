import fs from 'fs';
let code = fs.readFileSync('src/pages/StudentProfile.tsx', 'utf8');

// Replace state
code = code.replace(/const \[status, setStatus\] = useState\(STATUS_OPTIONS\[1\]\)\n\s*const \[notes, setNotes\] = useState\(''\)\n\s*const \[date, setDate\] = useState\(new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]\)/, 
`const [date, setDate] = useState(new Date().toISOString().split('T')[0])
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
  })`);

// Replace addHistoryMutation usages of status/notes
code = code.replace(/queryClient\.invalidateQueries\(\{ queryKey: \['student', id\] \}\)\n\s*setNotes\(''\)/, 
`queryClient.invalidateQueries({ queryKey: ['student', id] })
      setFormData(prev => ({
        ...prev,
        fromPart: '', toPart: '', nextReviewFrom: '', nextReviewTo: '', notes: '', writtenParts: []
      }))`);

// Replace the form UI
const formRegex = /<div className="space-y-4">[\s\S]*?<Button[\s\S]*?<\/Button>\n\s*<\/div>/;
const newFormUI = `<div className="space-y-5">
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
              </div>`;

code = code.replace(formRegex, newFormUI);

// Add missing imports
if (!code.includes('import { QuranSelector }')) {
  code = code.replace(/import \{ formatPart \} from '\.\.\/utils\/formatPart';/, "import { formatPart } from '../utils/formatPart';\nimport { QuranSelector } from '../components/ui/quran-selector';");
}
if (!code.includes('X, ')) {
  code = code.replace(/Activity, /, "Activity, X, ");
}

fs.writeFileSync('src/pages/StudentProfile.tsx', code);
