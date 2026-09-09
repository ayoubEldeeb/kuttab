import fs from 'fs';
let code = fs.readFileSync('src/pages/DailyLog.tsx', 'utf8');

const regex = /\{\/\* Header \/ Basic Status \*\/\}[\s\S]*?\{\/\* Right Side: What was recited today \*\/\}/;
const replacement = `{/* Header / Basic Status */}
              <div className="flex flex-col xl:flex-row gap-6 justify-between items-start">
                
                {/* Left Side: Info */}
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
                        {student.currentReach ? formatPart(student.currentReach) : 'لم يحدد المستوى'}
                      </span>
                    </div>

                    {previousAssignment && (
                      <div className="text-sm text-blue-800 bg-blue-50/80 px-4 py-2.5 rounded-xl border border-blue-100 w-fit max-w-full flex flex-col gap-1 justify-center">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="text-blue-500 font-bold text-xs shrink-0">الواجب المطلوب اليوم:</span>
                          <span className="font-bold leading-tight break-words">
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
                <div className="flex flex-wrap xl:justify-end gap-2 w-full xl:w-auto shrink-0 mt-2 xl:mt-0">
                  {STATUS_OPTIONS.map(opt => {
                    const isSelected = isExpanded ? formData.status === opt : todayHistory?.status === opt;
                    const isAbsent = opt === 'لم يحضر';
                    
                    return (
                      <button
                        key={opt}
                        onClick={() => handleStatusClick(student.id, opt, todayHistory)}
                        className={\`px-4 py-2.5 rounded-xl text-sm font-bold transition-all \${
                          isSelected 
                            ? (isAbsent ? 'bg-red-50 border-2 border-red-500 text-red-600' : 'bg-primary/5 border-2 border-primary text-primary shadow-sm') 
                            : 'bg-white text-gray-600 hover:bg-gray-50 border-2 border-gray-100 hover:border-gray-200'
                        }\`}
                      >
                        {isSelected && <Check size={16} className="inline ml-2" />}
                        {opt}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Today's Progress Summary */}
              {!isExpanded && todayHistory && todayHistory.status !== 'لم يحضر' && (
                <div className="mt-6 bg-blue-50/40 border border-blue-100 rounded-2xl p-5 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-400 rounded-r-2xl"></div>
                  
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 pr-3">
                    {/* Status Badge */}
                    <div className="flex flex-col gap-2 border-l border-transparent lg:border-gray-200 lg:pl-6">
                      <span className="text-xs text-gray-400 font-bold">الحالة المسجلة:</span>
                      <span className={\`text-sm font-bold px-3 py-1.5 rounded-lg w-fit \${
                        todayHistory.status.includes('كتب') ? 'bg-purple-100 text-purple-700' :
                        todayHistory.status.includes('حفظ') ? 'bg-green-100 text-green-700' :
                        'bg-orange-100 text-orange-700'
                      }\`}>
                        {todayHistory.status}
                      </span>
                    </div>

                    {/* Recitation */}
                    {(todayHistory.fromPart || todayHistory.toPart) && (
                      <div className="flex flex-col gap-2 border-l border-transparent lg:border-gray-200 lg:pl-6">
                        <span className="text-xs text-gray-500 font-bold">
                          {todayHistory.type === 'مراجعة' ? 'تمت مراجعته اليوم:' : 'تم تسميعه اليوم:'}
                        </span>
                        <div className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 bg-white/50 p-2 rounded-lg border border-gray-100">
                          {todayHistory.fromPart && (
                            <div className="flex items-start gap-2">
                              <span className="text-gray-400 text-xs mt-0.5 font-bold w-5 shrink-0">من:</span>
                              <span className="leading-tight">{formatPart(todayHistory.fromPart)}</span>
                            </div>
                          )}
                          {todayHistory.toPart && (
                            <div className="flex items-start gap-2">
                              <span className="text-gray-400 text-xs mt-0.5 font-bold w-5 shrink-0">إلى:</span>
                              <span className="leading-tight">{formatPart(todayHistory.toPart)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Written Parts */}
                    {todayHistory.status.includes('كتب') && todayHistory.writtenParts && (
                      (() => {
                        try {
                          const parts = JSON.parse(todayHistory.writtenParts);
                          if (parts.length > 0) {
                            return (
                              <div className="flex flex-col gap-2 border-l border-transparent lg:border-gray-200 lg:pl-6">
                                <span className="text-xs text-purple-500 font-bold">تمت كتابته:</span>
                                <div className="text-sm font-bold text-purple-700 bg-purple-100/50 px-3 py-2 rounded-lg inline-block border border-purple-200 cursor-help w-fit" title={parts.map((p: any) => formatPart(typeof p === 'string' ? p : p.part) + (p.note ? \` - \${p.note}\` : '')).join('\\n')}>
                                  {parts.length} أثمان مكتوبة
                                </div>
                              </div>
                            )
                          }
                        } catch (e) {}
                        return null;
                      })()
                    )}

                    {/* Next Assignment */}
                    {(todayHistory.nextReviewFrom || todayHistory.nextReviewTo) && (
                      <div className="flex flex-col gap-2 border-l border-transparent lg:border-gray-200 lg:pl-6 xl:col-span-2">
                        <span className="text-xs text-blue-500 font-bold">الواجب القادم:</span>
                        <div className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 bg-white/50 p-2 rounded-lg border border-gray-100">
                          {todayHistory.nextReviewFrom && (
                            <div className="flex items-start gap-2">
                              <span className="text-gray-400 text-xs mt-0.5 font-bold w-5 shrink-0">من:</span>
                              <span className="leading-tight">{formatPart(todayHistory.nextReviewFrom)}</span>
                            </div>
                          )}
                          {todayHistory.nextReviewTo && (
                            <div className="flex items-start gap-2">
                              <span className="text-gray-400 text-xs mt-0.5 font-bold w-5 shrink-0">إلى:</span>
                              <span className="leading-tight">{formatPart(todayHistory.nextReviewTo)}</span>
                            </div>
                          )}
                          {todayHistory.nextReviewNotes && (
                            <div className="mt-1 text-xs bg-blue-50 text-blue-700 p-1.5 rounded-md border border-blue-100 font-semibold">
                              ملاحظة: {todayHistory.nextReviewNotes}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {todayHistory.notes && (
                      <div className="flex flex-col gap-2 xl:col-span-1">
                        <span className="text-xs text-gray-500 font-bold">ملاحظات:</span>
                        <div className="text-sm font-medium text-gray-700 bg-white/50 p-2.5 rounded-lg border border-gray-100 italic">
                          {todayHistory.notes}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Edit Button */}
                  <button 
                    onClick={() => handleStatusClick(student.id, todayHistory.status, todayHistory)}
                    className="shrink-0 text-sm font-bold text-primary bg-white border border-primary/20 hover:bg-primary hover:text-white px-5 py-2.5 rounded-xl transition-all shadow-sm w-full md:w-auto mt-4 md:mt-0"
                  >
                    تعديل السجل
                  </button>
                </div>
              )}

              {/* Active Form Area */}
              {isExpanded && (
                <div className="mt-8 pt-6 border-t border-gray-100 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    
                    {/* Right Side: What was recited today */}`;

code = code.replace(regex, replacement);

fs.writeFileSync('src/pages/DailyLog.tsx', code);
