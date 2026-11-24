import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, BookOpenCheck, GraduationCap, RotateCcw, ShieldAlert, Undo2, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatPart } from '../utils/formatPart';
import DisciplineDecisionModal from './DisciplineDecisionModal';
import {
  DISCIPLINE_KIND_LABELS,
  apiError,
  invalidateDiscipline,
  invalidatePlacement,
  periodName,
  type DisciplineActionRow,
  type DisciplineState,
} from '../utils/program';

const fmtDate = (d: string) => new Date(d).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtNum = (n: number) => (Math.round(n * 100) / 100).toLocaleString('ar-EG');

const KIND_STYLE: Record<string, string> = {
  warning: 'bg-amber-100 text-amber-900',
  pardon: 'bg-emerald-100 text-emerald-900',
  dismissal: 'bg-rose-100 text-rose-900',
  reinstatement: 'bg-sky-100 text-sky-900',
};

function Card({ icon: Icon, title, children, action }: { icon: any; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Icon size={18} />
          </div>
          <h3 className="text-base font-black text-slate-900 font-heading">{title}</h3>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Program records of one student: absences and warnings, weekly portions, revision and exams, transfers. */
export default function StudentProgramPanel({ student }: { student: any }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'مشرف عام' || user?.username === 'admin';
  const id = student.id as number;
  const [deciding, setDeciding] = useState(false);

  const { data: discipline } = useQuery<DisciplineState & { actions: DisciplineActionRow[] }>({
    queryKey: ['discipline', id],
    queryFn: async () => (await api.get(`/discipline/students/${id}`)).data,
  });
  const { data: portions } = useQuery<{ portions: any[]; totals: { ayahCount: number; thumnAmount: number; count: number } }>({
    queryKey: ['portions', 'student', id],
    queryFn: async () => (await api.get(`/students/${id}/portions`)).data,
  });
  const { data: revisions = [] } = useQuery<any[]>({
    queryKey: ['revisions', 'student', id],
    queryFn: async () => (await api.get(`/students/${id}/revisions`)).data,
  });
  const { data: transfers = [] } = useQuery<any[]>({
    queryKey: ['transfers', id],
    queryFn: async () => (await api.get(`/students/${id}/transfers`)).data,
  });

  const refresh = () => {
    invalidateDiscipline(qc, id);
    invalidatePlacement(qc);
  };
  const act = useMutation({
    mutationFn: async (kind: 'reinstatement') => (await api.post(`/discipline/students/${id}/actions`, { kind })).data,
    onSuccess: () => {
      refresh();
      toast.success('أُعيد الطالب إلى الطلاب النشطين');
    },
    onError: (err) => toast.error(apiError(err)),
  });
  const undo = useMutation({
    mutationFn: async (actionId: number) => (await api.delete(`/discipline/actions/${actionId}`)).data,
    onSuccess: () => {
      refresh();
      toast.success('تم التراجع عن القرار');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const dismissed = student.status === 'dismissed';
  const exams = revisions.filter((r) => r.kind === 'exam');
  const daily = revisions.filter((r) => r.kind === 'daily');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Absences & warnings */}
      <Card
        icon={ShieldAlert}
        title="الغياب والإنذارات"
        action={
          dismissed && isAdmin ? (
            <button
              onClick={() => act.mutate('reinstatement')}
              disabled={act.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black cursor-pointer disabled:opacity-50"
            >
              <UserCheck size={14} />
              إعادة الطالب
            </button>
          ) : discipline?.alert ? (
            <button
              onClick={() => setDeciding(true)}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer"
            >
              اتخاذ قرار
            </button>
          ) : null
        }
      >
        {discipline && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className={`p-3 rounded-2xl border ${discipline.atLimit ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[11px] font-bold text-slate-500">الإنذارات</div>
                <div className="text-2xl font-black text-slate-900 font-heading">
                  {discipline.warnings} <span className="text-sm text-slate-400">/ {discipline.maxWarnings}</span>
                </div>
                {discipline.atLimit && !dismissed && <div className="text-[11px] font-black text-rose-700 mt-0.5">الغياب القادم بدون إذن يستوجب قراراً بالفصل</div>}
              </div>
              <div className="p-3 rounded-2xl border bg-slate-50 border-slate-200">
                <div className="text-[11px] font-bold text-slate-500">غياب بدون إذن (من آخر قرار)</div>
                <div className="text-2xl font-black text-slate-900 font-heading">
                  {discipline.unexcusedAbsences} <span className="text-sm text-slate-400">/ {discipline.absenceThreshold}</span>
                </div>
                {discipline.countingFrom && <div className="text-[11px] text-slate-400 mt-0.5">منذ {fmtDate(discipline.countingFrom)}</div>}
              </div>
            </div>
            {discipline.alert && !dismissed && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900">{discipline.alert.title}</div>
            )}
            {discipline.actions.length > 0 ? (
              <ul className="divide-y divide-slate-100 text-xs">
                {discipline.actions.map((a) => (
                  <li key={a.id} className="py-2 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full font-black shrink-0 ${KIND_STYLE[a.kind] ?? 'bg-slate-100'}`}>{DISCIPLINE_KIND_LABELS[a.kind] ?? a.kind}</span>
                    <span className="text-slate-500 shrink-0">{fmtDate(a.date)}</span>
                    <span className="text-slate-600 truncate flex-1">
                      {a.reason || (a.absenceCount ? `بعد ${a.absenceCount} غياب بدون إذن` : '')}
                      {a.byName ? ` — ${a.byName}` : ''}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => undo.mutate(a.id)}
                        disabled={undo.isPending}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer shrink-0"
                        title="التراجع عن هذا القرار"
                      >
                        <Undo2 size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">لا توجد إنذارات أو قرارات مسجلة.</p>
            )}
          </>
        )}
      </Card>

      {/* Weekly memorization */}
      <Card
        icon={BookOpenCheck}
        title="الحفظ الجديد (المقررات)"
        action={
          <Link to="/weekly-log" className="text-xs font-bold text-emerald-700 hover:underline">
            تسجيل مقرر
          </Link>
        }
      >
        {portions && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                <div className="text-[11px] font-bold text-emerald-800">الآيات</div>
                <div className="text-xl font-black text-emerald-900">{fmtNum(portions.totals.ayahCount)}</div>
              </div>
              <div className="p-2.5 rounded-2xl bg-teal-50 border border-teal-200">
                <div className="text-[11px] font-bold text-teal-800">الأثمان</div>
                <div className="text-xl font-black text-teal-900">{fmtNum(portions.totals.thumnAmount)}</div>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-bold text-slate-600">المقررات</div>
                <div className="text-xl font-black text-slate-900">{portions.totals.count}</div>
              </div>
            </div>
            {portions.portions.length ? (
              <ul className="divide-y divide-slate-100 text-xs max-h-56 overflow-y-auto">
                {portions.portions.slice(0, 12).map((p) => (
                  <li key={p.id} className="py-2 flex items-center gap-2">
                    <span className="text-slate-400 shrink-0 w-24">{fmtDate(p.date)}</span>
                    <span className="font-bold text-slate-800 flex-1 truncate">{p.description}</span>
                    <span className="text-slate-500 shrink-0">
                      {p.ayahCount} آية · {fmtNum(p.thumnAmount)} ثمن
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold shrink-0 ${
                        p.status === 'أتقن' ? 'bg-emerald-100 text-emerald-800' : p.status === 'لم يتقن' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {p.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">لم تُسجل مقررات بعد.</p>
            )}
          </>
        )}
      </Card>

      {/* Revision & exams */}
      <Card
        icon={GraduationCap}
        title="المراجعة واختبار السبت"
        action={
          <Link to="/revision-log" className="text-xs font-bold text-emerald-700 hover:underline">
            صفحة المراجعة
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-bold text-slate-500">المراجعة اليومية</div>
            <div className="font-black text-slate-900">{student.dailyRevisionAmount ?? 4} أثمان يومياً</div>
            <div className="text-slate-500 truncate">
              التالي: {student.currentRevisionFrom ? formatPart(student.currentRevisionFrom) : 'لم يحدد'}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-bold text-slate-500">اختبار السبت</div>
            <div className="font-black text-slate-900">{student.examRevisionJuz ?? 3} أجزاء</div>
            <div className="text-slate-500">{student.examNextFromJuz ? `يبدأ القادم من الجزء ${student.examNextFromJuz}` : 'يحدد عند أول اختبار'}</div>
          </div>
        </div>
        {exams.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-500">آخر الاختبارات</div>
            <ul className="divide-y divide-slate-100 text-xs">
              {exams.slice(0, 5).map((e) => (
                <li key={e.id} className="py-1.5 flex items-center gap-2">
                  <span className="text-slate-400 w-24 shrink-0">{fmtDate(e.date)}</span>
                  <span className="flex-1 text-slate-700">
                    الأجزاء {e.fromJuz}–{e.toJuz}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-bold ${e.result === 'لم يجتز' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {e.result}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {daily.length > 0 && (
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <RotateCcw size={12} />
            {daily.length} جلسة مراجعة يومية، أتقن منها {daily.filter((d) => d.result === 'أتقن').length}
          </div>
        )}
      </Card>

      {/* Transfers */}
      <Card icon={ArrowLeftRight} title="سجل النقل بين الفترات والحلقات">
        <div className="text-xs text-slate-600">
          الآن: <strong>{periodName(student.period)}</strong>
          {student.halaqa ? ` · ${student.halaqa.name}` : ' · بدون حلقة'}
        </div>
        {transfers.length ? (
          <ul className="divide-y divide-slate-100 text-xs">
            {transfers.map((t) => (
              <li key={t.id} className="py-2 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 w-24 shrink-0">{fmtDate(t.date)}</span>
                  <span className="text-slate-700">
                    من {periodName(t.fromPeriod)}
                    {t.fromHalaqaName ? ` (${t.fromHalaqaName})` : ''} ← إلى <strong>{periodName(t.toPeriod)}</strong>
                    {t.toHalaqaName ? ` (${t.toHalaqaName})` : ''}
                  </span>
                </div>
                {(t.reason || t.byName) && (
                  <div className="text-slate-400 pr-[6.5rem]">
                    {t.reason}
                    {t.byName ? ` — ${t.byName}` : ''}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-400">لم يُنقل الطالب من قبل.</p>
        )}
      </Card>

      {deciding && discipline?.alert && (
        <DisciplineDecisionModal student={student} state={discipline} onClose={() => setDeciding(false)} />
      )}
    </div>
  );
}
