import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { CheckCircle2, ChevronLeft, ChevronRight, GraduationCap, Repeat, Search, Settings2, Undo2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { ATHMAN } from '../components/ui/quran-data';
import { findThumnIndex, getThumnDisplayTitle } from '../utils/quranHelpers';
import {
  PERIODS,
  apiError,
  matchesPlacement,
  periodName,
  useHalaqat,
  useProgramSettings,
  weekdayIndex,
  weekdayName,
} from '../utils/program';

const ATHMAN_PER_JUZ = 16;
const EXAM_RESULTS = ['ممتاز', 'جيد جداً', 'جيد', 'مقبول', 'لم يجتز'] as const;

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
const fromYmd = (s: string) => new Date(`${s}T12:00:00`);
const juzOf = (idx: number) => Math.floor(idx / ATHMAN_PER_JUZ) + 1;
const thumnLabel = (idx: number) => `${getThumnDisplayTitle(ATHMAN[idx])} · ج${juzOf(idx)}`;

interface Range {
  lo: number;
  hi: number;
}

/**
 * Athman the student has memorized. Memorization in the center starts from
 * the end of the Mushaf, so by default everything from the current position
 * to Surat An-Nas is memorized; a student whose position moved forward since
 * enrollment memorizes from Al-Fatiha instead.
 */
function memorizedRange(s: any): Range | null {
  if (s.isKhatim) return { lo: 0, hi: ATHMAN.length - 1 };
  const cur = findThumnIndex(s.currentReach);
  if (cur < 0) return null;
  const start = findThumnIndex(s.startReach);
  if (start >= 0 && start < cur) return { lo: 0, hi: cur };
  return { lo: cur, hi: ATHMAN.length - 1 };
}

/** Today's daily assignment: `amount` athman from `from`, staying inside the memorized range. */
function dailyPlan(fromIdx: number, amount: number, range: Range) {
  const size = range.hi - range.lo + 1;
  const n = Math.max(1, Math.min(amount, size));
  const start = fromIdx >= range.lo && fromIdx <= range.hi ? fromIdx : range.lo;
  const end = Math.min(range.hi, start + n - 1);
  const next = end + 1 > range.hi ? range.lo : end + 1;
  return { start, end, count: end - start + 1, next };
}

/** The Saturday exam: `juzCount` ajza from `fromJuz`, inside the memorized ajza. */
function examPlan(fromJuz: number | null, juzCount: number, range: Range) {
  const loJ = juzOf(range.lo);
  const hiJ = juzOf(range.hi);
  const start = fromJuz && fromJuz >= loJ && fromJuz <= hiJ ? fromJuz : loJ;
  const end = Math.min(hiJ, start + Math.max(1, juzCount) - 1);
  const next = end + 1 > hiJ ? loJ : end + 1;
  return { start, end, next, loJ, hiJ };
}

interface Session {
  id: number;
  studentId: number;
  kind: 'daily' | 'exam';
  fromPart: string | null;
  toPart: string | null;
  amount: number;
  fromJuz: number | null;
  toJuz: number | null;
  result: string;
  notes: string | null;
}

export default function RevisionLog() {
  const qc = useQueryClient();
  const { data: settings } = useProgramSettings();
  const examDay = settings?.revisionExamDay ?? 'saturday';

  const [date, setDate] = useState(() => ymd(new Date()));
  const isExamDay = fromYmd(date).getDay() === weekdayIndex(examDay);
  const [tabChoice, setTabChoice] = useState<'daily' | 'exam' | null>(null);
  const tab = tabChoice ?? (isExamDay ? 'exam' : 'daily');

  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [halaqaFilter, setHalaqaFilter] = useState('all');
  const [onlyPending, setOnlyPending] = useState(false);

  const { data: halaqat = [] } = useHalaqat();
  const { data: students = [], isLoading } = useQuery<any[]>({
    queryKey: ['students'],
    queryFn: async () => (await api.get('/students')).data,
  });
  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ['revision-sessions', date],
    queryFn: async () => (await api.get(`/revision/sessions?date=${date}`)).data,
  });
  const sessionOf = useMemo(() => {
    const m = new Map<string, Session>();
    for (const s of sessions) m.set(`${s.studentId}:${s.kind}`, s);
    return m;
  }, [sessions]);

  const list = useMemo(() => {
    const q = search.trim();
    return students.filter(
      (s) =>
        (!q || s.name.includes(q) || s.serialNumber?.includes(q)) &&
        matchesPlacement(s, periodFilter, halaqaFilter) &&
        (!onlyPending || !sessionOf.has(`${s.id}:${tab}`)),
    );
  }, [students, search, periodFilter, halaqaFilter, onlyPending, sessionOf, tab]);

  const recorded = list.filter((s) => sessionOf.has(`${s.id}:${tab}`)).length;

  const invalidate = (studentId?: number) => {
    qc.invalidateQueries({ queryKey: ['revision-sessions'] });
    qc.invalidateQueries({ queryKey: ['students'] });
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    if (studentId) {
      qc.invalidateQueries({ queryKey: ['student', String(studentId)] });
      qc.invalidateQueries({ queryKey: ['revisions', 'student', studentId] });
    }
  };

  const save = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await api.post('/revision/sessions', { date, ...body })).data,
    onSuccess: (_d, body) => {
      invalidate(body.studentId as number);
      toast.success('تم حفظ النتيجة', { duration: 1500 });
    },
    onError: (err) => toast.error(apiError(err, 'تعذر حفظ النتيجة')),
  });
  const undo = useMutation({
    mutationFn: async (s: Session) => (await api.delete(`/revision/sessions/${s.id}`)).data,
    onSuccess: (_d, s) => {
      invalidate(s.studentId);
      toast.success('تم التراجع، وعاد المقرر كما كان');
    },
    onError: (err) => toast.error(apiError(err)),
  });
  const setAmounts = useMutation({
    mutationFn: async ({ id, ...body }: { id: number; dailyRevisionAmount?: number; examRevisionJuz?: number; currentRevisionFrom?: string; examNextFromJuz?: number }) =>
      (await api.put(`/students/${id}`, body)).data,
    onSuccess: (_d, v) => invalidate(v.id),
    onError: (err) => toast.error(apiError(err)),
  });

  const shiftDay = (n: number) => setDate((d) => ymd(addDays(fromYmd(d), n)));

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-800 text-white flex items-center justify-center shadow-md ring-4 ring-teal-50">
            <Repeat size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 font-heading">المراجعة والاختبار</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              مراجعة يومية بعدد ثابت من الأثمان تتقدم تلقائياً، واختبار مراجعة يوم {weekdayName(examDay)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <button
            onClick={() => setDate(ymd(new Date()))}
            className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${date === ymd(new Date()) ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
          >
            اليوم
          </button>
          <button onClick={() => shiftDay(-1)} className="p-2 rounded-xl bg-white border border-slate-200 cursor-pointer" title="اليوم السابق">
            <ChevronRight size={16} />
          </button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-9 rounded-xl bg-white border border-slate-200 px-2 text-xs font-bold outline-none" />
          <button onClick={() => shiftDay(1)} className="p-2 rounded-xl bg-white border border-slate-200 cursor-pointer" title="اليوم التالي">
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'daily', label: 'المراجعة اليومية', icon: Repeat },
            { id: 'exam', label: `اختبار ${weekdayName(examDay)}`, icon: GraduationCap },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTabChoice(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black cursor-pointer border ${
              tab === t.id ? 'bg-emerald-700 border-emerald-700 text-white shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:bg-emerald-50'
            }`}
          >
            <t.icon size={17} />
            {t.label}
          </button>
        ))}
        {isExamDay && tab === 'daily' && (
          <span className="text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1.5 rounded-xl">اليوم يوم الاختبار</span>
        )}
        <span className="text-xs font-bold text-slate-500 mr-auto">
          سُجّل {recorded} من {list.length}
        </span>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-52">
          <Search size={16} className="absolute right-3 top-3 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث عن طالب..."
            className="w-full h-10 pr-9 pl-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm outline-none focus:bg-white"
          />
        </div>
        <select
          value={periodFilter}
          onChange={(e) => {
            setPeriodFilter(e.target.value);
            setHalaqaFilter('all');
          }}
          className="h-10 rounded-2xl bg-slate-50 border border-slate-200 px-3 text-xs font-bold outline-none cursor-pointer"
        >
          <option value="all">كل الفترات</option>
          {PERIODS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="none">بدون فترة</option>
        </select>
        <select
          value={halaqaFilter}
          onChange={(e) => setHalaqaFilter(e.target.value)}
          className="h-10 rounded-2xl bg-slate-50 border border-slate-200 px-3 text-xs font-bold outline-none cursor-pointer"
        >
          <option value="all">كل الحلقات</option>
          {halaqat
            .filter((h) => periodFilter === 'all' || h.period === periodFilter)
            .map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          <option value="none">بدون حلقة</option>
        </select>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} className="w-4 h-4 accent-emerald-700" />
          غير المسجلين فقط
        </label>
      </div>

      {isLoading ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 text-sm font-bold text-slate-500">جاري التحميل...</div>
      ) : list.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 text-sm text-slate-500">لا يوجد طلاب يطابقون التصفية</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {list.map((s) =>
            tab === 'daily' ? (
              <DailyCard
                key={s.id}
                student={s}
                session={sessionOf.get(`${s.id}:daily`)}
                busy={save.isPending || undo.isPending}
                onSave={(body) => save.mutate({ studentId: s.id, kind: 'daily', ...body })}
                onUndo={(sess) => undo.mutate(sess)}
                onSettings={(body) => setAmounts.mutate({ id: s.id, ...body })}
              />
            ) : (
              <ExamCard
                key={s.id}
                student={s}
                session={sessionOf.get(`${s.id}:exam`)}
                busy={save.isPending || undo.isPending}
                onSave={(body) => save.mutate({ studentId: s.id, kind: 'exam', ...body })}
                onUndo={(sess) => undo.mutate(sess)}
                onSettings={(body) => setAmounts.mutate({ id: s.id, ...body })}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function StudentHead({ s, children }: { s: any; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <Link to={`/students/${s.id}`} className="font-black text-slate-900 hover:text-emerald-700">
          {s.name}
        </Link>
        <div className="text-[11px] text-slate-500 truncate">
          {periodName(s.period)}
          {s.halaqa ? ` · ${s.halaqa.name}` : ''}
        </div>
      </div>
      {children}
    </div>
  );
}

interface CardProps {
  student: any;
  session?: Session;
  busy: boolean;
  onSave: (body: Record<string, unknown>) => void;
  onUndo: (s: Session) => void;
  onSettings: (body: Record<string, any>) => void;
}

function DailyCard({ student: s, session, busy, onSave, onUndo, onSettings }: CardProps) {
  const range = memorizedRange(s);
  const amount = s.dailyRevisionAmount ?? 4;
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState('');

  if (!range) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 space-y-2">
        <StudentHead s={s} />
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
          حدّد موضع الحفظ الحالي للطالب من ملفه أولاً حتى يُحسب ورد المراجعة.
        </p>
      </div>
    );
  }

  // A recorded session keeps the assignment it was given, even though the student's plan has moved on.
  const baseIdx = session?.fromPart ? findThumnIndex(session.fromPart) : findThumnIndex(s.currentRevisionFrom);
  const plan = dailyPlan(baseIdx, amount, range);
  const options = Array.from({ length: range.hi - range.lo + 1 }, (_, i) => range.lo + i);

  const record = (result: 'أتقن' | 'لم يتقن') =>
    onSave({
      fromPart: ATHMAN[plan.start],
      toPart: ATHMAN[plan.end],
      amount: plan.count,
      result,
      notes: notes.trim() || undefined,
      // Mastered: move on. Not mastered: the same athman again next time.
      nextFromPart: ATHMAN[result === 'أتقن' ? plan.next : plan.start],
      nextToPart: ATHMAN[result === 'أتقن' ? plan.next : plan.start],
    });

  return (
    <div className={`bg-white rounded-3xl border p-4 space-y-3 ${session ? (session.result === 'أتقن' ? 'border-emerald-200' : 'border-rose-200') : 'border-slate-200/80'}`}>
      <StudentHead s={s}>
        <button onClick={() => setEditing((v) => !v)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer shrink-0" title="مقدار المراجعة وبدايتها">
          <Settings2 size={16} />
        </button>
      </StudentHead>

      {editing && (
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <label className="space-y-1">
            <span className="font-bold text-slate-600">أثمان يومياً</span>
            <input
              type="number"
              min={1}
              max={40}
              defaultValue={amount}
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (n !== amount) onSettings({ dailyRevisionAmount: n });
              }}
              className="w-full h-9 rounded-xl bg-white border border-slate-200 px-2 font-bold outline-none"
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="font-bold text-slate-600">تبدأ المراجعة القادمة من</span>
            <select
              value={plan.start}
              disabled={!!session}
              onChange={(e) => onSettings({ currentRevisionFrom: ATHMAN[Number(e.target.value)] })}
              className="w-full h-9 rounded-xl bg-white border border-slate-200 px-2 font-bold outline-none cursor-pointer disabled:opacity-60"
            >
              {options.map((i) => (
                <option key={i} value={i}>
                  {thumnLabel(i)}
                </option>
              ))}
            </select>
          </label>
          <p className="sm:col-span-3 text-[11px] text-slate-400">
            المحفوظ: من {thumnLabel(range.lo)} إلى {thumnLabel(range.hi)} ({range.hi - range.lo + 1} ثمناً). المراجعة تدور على المحفوظ بالترتيب.
          </p>
        </div>
      )}

      <div className="p-3 rounded-2xl bg-teal-50/60 border border-teal-200 text-xs space-y-1">
        <div className="font-black text-teal-900">
          ورد اليوم: {plan.count} {plan.count === 1 ? 'ثمن' : 'أثمان'}
        </div>
        <div className="text-slate-700">
          من <strong>{thumnLabel(plan.start)}</strong>
          {plan.count > 1 && (
            <>
              {' '}
              إلى <strong>{thumnLabel(plan.end)}</strong>
            </>
          )}
        </div>
      </div>

      {session ? (
        <div className="flex items-center justify-between gap-2">
          <span className={`flex items-center gap-1.5 text-xs font-black ${session.result === 'أتقن' ? 'text-emerald-700' : 'text-rose-700'}`}>
            {session.result === 'أتقن' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {session.result === 'أتقن' ? 'أتقن — الورد القادم يبدأ مما بعده' : 'لم يتقن — يعيد نفس الورد'}
          </span>
          <button
            onClick={() => onUndo(session)}
            disabled={busy}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold cursor-pointer"
          >
            <Undo2 size={13} />
            تراجع
          </button>
        </div>
      ) : (
        <>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظة (اختياري)"
            className="w-full h-9 rounded-xl bg-slate-50 border border-slate-200 px-3 text-xs outline-none focus:bg-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => record('أتقن')}
              disabled={busy}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              أتقن
            </button>
            <button
              onClick={() => record('لم يتقن')}
              disabled={busy}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-black cursor-pointer disabled:opacity-50"
            >
              <XCircle size={16} />
              لم يتقن
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ExamCard({ student: s, session, busy, onSave, onUndo, onSettings }: CardProps) {
  const range = memorizedRange(s);
  const juzCount = s.examRevisionJuz ?? 3;
  const [result, setResult] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [fromJuz, setFromJuz] = useState<number | null>(null);

  if (!range) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 space-y-2">
        <StudentHead s={s} />
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5">حدّد موضع الحفظ الحالي للطالب من ملفه أولاً.</p>
      </div>
    );
  }

  const plan = examPlan(session?.fromJuz ?? fromJuz ?? s.examNextFromJuz ?? null, juzCount, range);
  const juzOptions = Array.from({ length: plan.hiJ - plan.loJ + 1 }, (_, i) => plan.loJ + i);

  return (
    <div className={`bg-white rounded-3xl border p-4 space-y-3 ${session ? (session.result === 'لم يجتز' ? 'border-rose-200' : 'border-emerald-200') : 'border-slate-200/80'}`}>
      <StudentHead s={s}>
        <select
          value={juzCount}
          onChange={(e) => onSettings({ examRevisionJuz: Number(e.target.value) })}
          className="h-8 rounded-xl bg-slate-50 border border-slate-200 px-2 text-[11px] font-bold outline-none cursor-pointer shrink-0"
          title="عدد أجزاء الاختبار لهذا الطالب"
        >
          {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
            <option key={n} value={n}>
              {n} أجزاء
            </option>
          ))}
        </select>
      </StudentHead>

      <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-200 text-xs flex flex-wrap items-center gap-2">
        <span className="font-black text-indigo-900">أجزاء الاختبار:</span>
        <select
          value={plan.start}
          disabled={!!session}
          onChange={(e) => setFromJuz(Number(e.target.value))}
          className="h-8 rounded-lg bg-white border border-indigo-200 px-2 font-bold outline-none cursor-pointer disabled:opacity-70"
        >
          {juzOptions.map((j) => (
            <option key={j} value={j}>
              الجزء {j}
            </option>
          ))}
        </select>
        <span className="font-bold text-indigo-900">إلى الجزء {plan.end}</span>
        <span className="text-slate-500">({plan.end - plan.start + 1} أجزاء من المحفوظ {plan.loJ}–{plan.hiJ})</span>
      </div>

      {session ? (
        <div className="flex items-center justify-between gap-2">
          <span className={`flex items-center gap-1.5 text-xs font-black ${session.result === 'لم يجتز' ? 'text-rose-700' : 'text-emerald-700'}`}>
            {session.result === 'لم يجتز' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
            النتيجة: {session.result}
            {session.notes ? <span className="font-normal text-slate-500"> — {session.notes}</span> : null}
          </span>
          <button
            onClick={() => onUndo(session)}
            disabled={busy}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold cursor-pointer"
          >
            <Undo2 size={13} />
            تراجع
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {EXAM_RESULTS.map((r) => (
              <button
                key={r}
                onClick={() => setResult(r)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer ${
                  result === r
                    ? r === 'لم يجتز'
                      ? 'bg-rose-600 border-rose-600 text-white'
                      : 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات الاختبار (الأخطاء، التنبيهات...)"
              className="flex-1 h-9 rounded-xl bg-slate-50 border border-slate-200 px-3 text-xs outline-none focus:bg-white"
            />
            <button
              onClick={() =>
                onSave({
                  fromJuz: plan.start,
                  toJuz: plan.end,
                  result,
                  notes: notes.trim() || undefined,
                  // Failed: the same ajza again next week.
                  nextExamFromJuz: result === 'لم يجتز' ? plan.start : plan.next,
                })
              }
              disabled={busy || !result}
              className="px-4 h-9 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black cursor-pointer disabled:opacity-40"
            >
              حفظ النتيجة
            </button>
          </div>
          {s.examNextFromJuz && fromJuz === null && (
            <p className="text-[11px] text-slate-400">يكمل من حيث انتهى الاختبار السابق.</p>
          )}
        </>
      )}
    </div>
  );
}
