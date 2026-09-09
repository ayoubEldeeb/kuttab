import fs from 'fs';
let code = fs.readFileSync('src/pages/DailyLog.tsx', 'utf8');

// Fix DailyLog.tsx layout
const regex = /<div className="flex flex-col lg:flex-row gap-3 mt-4">[\s\S]*?\{STATUS_OPTIONS\.map\(opt => \{/
const replacement = `<div className="flex flex-wrap gap-3 mt-3">
                    <div className="text-sm text-gray-600 bg-gray-50 px-3.5 py-2.5 rounded-xl border border-gray-100 w-fit flex flex-col justify-center">
                      <span className="text-gray-400 font-bold mb-1 text-xs">مستوى الحفظ:</span>
                      <span className="font-bold text-gray-800 leading-snug">
                        {student.currentReach ? formatPart(student.currentReach) : 'لم يحدد المستوى'}
                      </span>
                    </div>

                    {previousAssignment && (
                      <div className="text-sm text-blue-800 bg-blue-50/80 px-4 py-2.5 rounded-xl border border-blue-100 w-fit flex flex-col gap-1 justify-center max-w-xl">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="text-blue-500 font-bold text-xs shrink-0">الواجب المطلوب اليوم:</span>
                          <span className="font-bold leading-snug">
                            {previousAssignment.nextReviewFrom ? formatPart(previousAssignment.nextReviewFrom) : ''} 
                            {previousAssignment.nextReviewTo ? \` - \${formatPart(previousAssignment.nextReviewTo)}\` : ''}
                          </span>
                        </div>
                        {previousAssignment.nextReviewNotes && (
                          <div className="text-xs font-semibold bg-white/60 px-2 py-1.5 rounded-md border border-blue-100/50 w-fit mt-1 text-blue-700">
                            ملاحظة: {previousAssignment.nextReviewNotes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Right Side: Action Buttons */}
                <div className="flex flex-wrap xl:justify-end gap-2 w-full xl:w-[45%] mt-4 xl:mt-0">
                  {STATUS_OPTIONS.map(opt => {`;

code = code.replace(regex, replacement);

// Make sure the main header wrapper is right
code = code.replace(/<div className="flex flex-col xl:flex-row gap-6 justify-between items-start">/, '<div className="flex flex-col xl:flex-row gap-8 justify-between items-start">');

fs.writeFileSync('src/pages/DailyLog.tsx', code);
