import fs from 'fs';
let code = fs.readFileSync('src/pages/RevisionLog.tsx', 'utf8');

const regex = /<div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">[\s\S]*?<div className="flex gap-2">/;
const replacement = `<div className="flex flex-col xl:flex-row gap-6 justify-between items-start">
                
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex items-center gap-3">
                    <Link to={\`/students/\${student.id}\`} className="font-bold text-xl text-gray-900 hover:text-primary transition-colors truncate">
                      {student.name}
                    </Link>
                    <span className="bg-gray-100 px-2.5 py-1 rounded-md text-xs font-bold text-gray-500 border border-gray-200 shrink-0">
                      {student.serialNumber}
                    </span>
                  </div>
                  
                  <div className="flex flex-col lg:flex-row gap-3 mt-4">
                    <div className="text-sm text-gray-600 bg-gray-50 px-3.5 py-2.5 rounded-xl border border-gray-100 w-fit shrink-0 flex flex-col justify-center">
                      <span className="text-gray-400 font-bold mb-1 text-xs">مستوى الحفظ:</span>
                      <span className="font-bold text-gray-800 leading-tight">
                        {formatPart(student.currentReach)}
                      </span>
                    </div>

                    {hasRevisionSet ? (
                      <div className="text-sm text-blue-800 bg-blue-50/80 px-4 py-2.5 rounded-xl border border-blue-100 w-fit max-w-full flex flex-col gap-1 justify-center">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="text-blue-500 font-bold text-xs shrink-0">الورد الحالي للمراجعة:</span>
                          <span className="font-bold leading-tight break-words">
                            {formatPart(student.currentRevisionFrom)} - {formatPart(student.currentRevisionTo)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-orange-700 bg-orange-50/80 px-4 py-2.5 rounded-xl border border-orange-200 w-fit max-w-full flex items-center font-medium">
                        لم يتم تحديد ورد مراجعة لهذا الطالب
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-wrap xl:justify-end gap-2 w-full xl:w-auto shrink-0 mt-2 xl:mt-0">`;

code = code.replace(regex, replacement);

fs.writeFileSync('src/pages/RevisionLog.tsx', code);
