import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import DisciplineDecisionModal from './DisciplineDecisionModal';
import { periodName, studentsAr, useDisciplineAlerts, type DisciplineAlertRow } from '../utils/program';

/** Students whose absences need a decision (warning, pardon or dismissal). */
export default function DisciplineAlertsPanel() {
  const { data: alerts = [] } = useDisciplineAlerts();
  const [active, setActive] = useState<DisciplineAlertRow | null>(null);

  if (!alerts.length) return null;
  const dismissals = alerts.filter((a) => a.state.alert?.suggestion === 'dismissal').length;

  return (
    <section className="bg-white rounded-3xl border border-rose-200 shadow-sm overflow-hidden" dir="rtl">
      <header className="p-5 bg-gradient-to-l from-rose-50 to-amber-50/40 border-b border-rose-100 flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0">
          <ShieldAlert size={22} />
        </div>
        <div>
          <h2 className="text-base font-black text-slate-900 font-heading">قرارات الغياب بانتظارك ({alerts.length})</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {dismissals ? `${studentsAr(dismissals)} ${dismissals === 1 ? 'وصل' : 'وصلوا'} إلى حد الإنذارات · ` : ''}
            البرنامج يقترح فقط، والقرار لك: إنذار أو تجاوز أو فصل
          </p>
        </div>
      </header>
      <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
        {alerts.map((row) => {
          const atLimit = row.state.alert?.suggestion === 'dismissal';
          return (
            <li key={row.student.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${atLimit ? 'bg-rose-600' : 'bg-amber-500'}`} />
                <div className="min-w-0">
                  <Link to={`/students/${row.student.id}`} className="font-bold text-slate-900 hover:text-emerald-700 text-sm">
                    {row.student.name}
                  </Link>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {periodName(row.student.period)}
                    {row.student.halaqa ? ` · ${row.student.halaqa.name}` : ''} · غياب بدون إذن: {row.state.unexcusedAbsences} · إنذارات: {row.state.warnings}/{row.state.maxWarnings}
                  </div>
                  <div className={`text-xs font-bold mt-1 ${atLimit ? 'text-rose-700' : 'text-amber-800'}`}>{row.state.alert?.title}</div>
                </div>
              </div>
              <button
                onClick={() => setActive(row)}
                className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer shrink-0 self-start sm:self-auto ${
                  atLimit ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'
                }`}
              >
                اتخاذ قرار
              </button>
            </li>
          );
        })}
      </ul>
      {active && <DisciplineDecisionModal student={active.student} state={active.state} onClose={() => setActive(null)} />}
    </section>
  );
}
