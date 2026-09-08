import fs from 'fs';
let code = fs.readFileSync('src/pages/DailyLog.tsx', 'utf8');

// 1. Add nextReviewNotes to formData
code = code.replace(/nextReviewTo: '',\n\s*notes: '',/, "nextReviewTo: '',\n    nextReviewNotes: '',\n    notes: '',");

// 2. Add nextReviewNotes to initial state in handleStatusClick
code = code.replace(/nextReviewTo: todayHistory\?\.nextReviewTo \|\| '',\n\s*notes: todayHistory\?\.notes \|\| '',/, "nextReviewTo: todayHistory?.nextReviewTo || '',\n          nextReviewNotes: todayHistory?.nextReviewNotes || '',\n          notes: todayHistory?.notes || '',");

// 3. Render nextReviewNotes in Summary View
const summaryRegex = /\{\(todayHistory\.nextReviewFrom \|\| todayHistory\.nextReviewTo\) && \(\s*<div className="md:border-r border-gray-200 md:pr-8 flex-1">\s*<span className="text-xs text-blue-500 font-bold block mb-2">الواجب القادم:<\/span>\s*<div className="flex flex-col gap-1\.5 text-sm font-medium text-gray-700">/;
code = code.replace(summaryRegex, `{(todayHistory.nextReviewFrom || todayHistory.nextReviewTo) && (
                      <div className="md:border-r border-gray-200 md:pr-8 flex-1">
                        <span className="text-xs text-blue-500 font-bold block mb-2">الواجب القادم:</span>
                        <div className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">`);
// Wait, I need to add the nextReviewNotes inside the الواجب القادم summary. Let's do it better.
const summaryReplaceTarget = /\{todayHistory\.nextReviewTo && \([\s\S]*?<\/span>\s*<\/div>\s*\)\}\s*<\/div>\s*<\/div>\s*\)\}/;
const newSummaryTarget = `{todayHistory.nextReviewTo && (
                            <div className="flex items-start gap-2">
                              <span className="text-gray-400 text-xs mt-0.5 font-bold w-6">إلى:</span>
                              <span className="leading-tight">{formatPart(todayHistory.nextReviewTo)}</span>
                            </div>
                          )}
                          {todayHistory.nextReviewNotes && (
                            <div className="mt-1 text-xs bg-blue-50 text-blue-700 p-1.5 rounded-md border border-blue-100">
                              ملاحظة: {todayHistory.nextReviewNotes}
                            </div>
                          )}
                        </div>
                      </div>
                    )}`;
code = code.replace(summaryReplaceTarget, newSummaryTarget);

// 4. Render nextReviewNotes input in the active form "الواجب القادم"
const formRegex = /<QuranSelector \n\s*value=\{formData\.nextReviewTo\}[\s\S]*?placeholder="إلى موضع\.\.\."\n\s*className="z-20"\n\s*\/>\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>/;
const newFormUI = `<QuranSelector 
                          value={formData.nextReviewTo}
                          onChange={val => setFormData({...formData, nextReviewTo: val})}
                          placeholder="إلى موضع..."
                          className="z-20"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات الواجب (اختياري)</label>
                        <input 
                          type="text"
                          value={formData.nextReviewNotes}
                          onChange={e => setFormData({...formData, nextReviewNotes: e.target.value})}
                          placeholder="مثال: نصف ثمن، التركيز على الحفظ..."
                          className="w-full bg-white h-12 rounded-xl border border-gray-200 px-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        />
                      </div>
                    </div>
                  </div>`;
code = code.replace(formRegex, newFormUI);

fs.writeFileSync('src/pages/DailyLog.tsx', code);
