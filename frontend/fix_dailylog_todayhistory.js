import fs from 'fs';
let code = fs.readFileSync('src/pages/DailyLog.tsx', 'utf8');

const regex = /const todayHistory = student\.histories\[0\]\n\s*const isExpanded = activeFormId === student\.id/;
const newCode = `const todayHistory = student.histories.find((h: any) => h.date.startsWith(dateStr));
          const previousAssignment = student.histories.find((h: any) => h.date < dateStr && (h.nextReviewFrom || h.nextReviewTo));
          const isExpanded = activeFormId === student.id;`;

code = code.replace(regex, newCode);

// Display the previous assignment
const uiRegex = /<span className="font-bold text-gray-700 leading-tight break-words">\n\s*\{student\.currentReach \? formatPart\(student\.currentReach\) : 'لم يحدد المستوى'\}\n\s*<\/span>\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>/;
const newUi = `<span className="font-bold text-gray-700 leading-tight break-words">
                        {student.currentReach ? formatPart(student.currentReach) : 'لم يحدد المستوى'}
                      </span>
                    </div>

                    {previousAssignment && (
                      <div className="text-sm text-blue-700 flex flex-col gap-1.5 bg-blue-50 p-2.5 rounded-lg border border-blue-100 w-fit max-w-full mt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-500 font-bold whitespace-nowrap text-xs">الواجب المطلوب اليوم:</span>
                          <span className="font-bold leading-tight break-words text-sm">
                            {previousAssignment.nextReviewFrom ? formatPart(previousAssignment.nextReviewFrom) : ''} 
                            {previousAssignment.nextReviewTo ? \` - \${formatPart(previousAssignment.nextReviewTo)}\` : ''}
                          </span>
                        </div>
                        {previousAssignment.nextReviewNotes && (
                          <div className="text-xs font-semibold bg-white/60 px-2 py-1 rounded border border-blue-100/50 inline-block">
                            ملاحظة: {previousAssignment.nextReviewNotes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>`;
code = code.replace(uiRegex, newUi);

fs.writeFileSync('src/pages/DailyLog.tsx', code);
