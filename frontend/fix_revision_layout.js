import fs from 'fs';
let code = fs.readFileSync('src/pages/RevisionLog.tsx', 'utf8');

const regex = /<div className="flex flex-col lg:flex-row gap-3 mt-4">[\s\S]*?<div className="flex flex-wrap xl:justify-end gap-2 w-full xl:w-auto shrink-0 mt-2 xl:mt-0">/;

const replacement = `<div className="flex flex-wrap gap-3 mt-3">
                    <div className="text-sm text-gray-600 bg-gray-50 px-3.5 py-2.5 rounded-xl border border-gray-100 w-fit flex flex-col justify-center">
                      <span className="text-gray-400 font-bold mb-1 text-xs">مستوى الحفظ:</span>
                      <span className="font-bold text-gray-800 leading-snug">
                        {formatPart(student.currentReach)}
                      </span>
                    </div>

                    {hasRevisionSet ? (
                      <div className="text-sm text-blue-800 bg-blue-50/80 px-4 py-2.5 rounded-xl border border-blue-100 w-fit max-w-xl flex flex-col gap-1 justify-center">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="text-blue-500 font-bold text-xs shrink-0">الورد الحالي للمراجعة:</span>
                          <span className="font-bold leading-snug">
                            {formatPart(student.currentRevisionFrom)} - {formatPart(student.currentRevisionTo)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-orange-700 bg-orange-50/80 px-4 py-2.5 rounded-xl border border-orange-200 w-fit max-w-xl flex items-center font-medium">
                        لم يتم تحديد ورد مراجعة لهذا الطالب
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-wrap xl:justify-end gap-2 w-full xl:w-[40%] mt-4 xl:mt-0">`;

code = code.replace(regex, replacement);
code = code.replace(/<div className="flex flex-col xl:flex-row gap-6 justify-between items-start">/, '<div className="flex flex-col xl:flex-row gap-8 justify-between items-start">');

fs.writeFileSync('src/pages/RevisionLog.tsx', code);
