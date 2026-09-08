import fs from 'fs';
let code = fs.readFileSync('src/pages/StudentProfile.tsx', 'utf8');

// 1. Add nextReviewNotes to formData
code = code.replace(/nextReviewTo: '',\n\s*notes: '',/, "nextReviewTo: '',\n    nextReviewNotes: '',\n    notes: '',");

// 2. Add nextReviewNotes input in active form
const formRegex = /<QuranSelector \n\s*value=\{formData\.nextReviewTo\}[\s\S]*?placeholder="إلى موضع\.\.\."\n\s*className="z-10 text-sm"\n\s*\/>\n\s*<\/div>\n\s*<\/div>\n\s*<\/>/;
const newFormUI = `<QuranSelector 
                          value={formData.nextReviewTo}
                          onChange={val => setFormData({...formData, nextReviewTo: val})}
                          placeholder="إلى موضع..."
                          className="z-10 text-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">ملاحظات الواجب (اختياري)</label>
                        <input 
                          type="text"
                          value={formData.nextReviewNotes}
                          onChange={e => setFormData({...formData, nextReviewNotes: e.target.value})}
                          placeholder="مثال: نصف ثمن..."
                          className="w-full bg-white h-10 rounded-lg border border-gray-200 px-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        />
                      </div>
                    </div>
                  </>`;
code = code.replace(formRegex, newFormUI);

// 3. Render nextReviewNotes in Profile History Timeline
const historyTimelineRegex = /\{history\.nextReviewTo \? formatPart\(history\.nextReviewTo\) : '-'\\}<\/span>\n\s*<\/div>\n\s*<\/div>\n\s*\)\}/;
const newHistoryTimeline = `{history.nextReviewTo ? formatPart(history.nextReviewTo) : '-'}</span>
                            {history.nextReviewNotes && (
                              <div className="mt-2 text-xs bg-blue-100/50 text-blue-700 p-2 rounded border border-blue-100">
                                ملاحظة: {history.nextReviewNotes}
                              </div>
                            )}
                          </div>
                        </div>
                      )}`;
code = code.replace(historyTimelineRegex, newHistoryTimeline);

fs.writeFileSync('src/pages/StudentProfile.tsx', code);
