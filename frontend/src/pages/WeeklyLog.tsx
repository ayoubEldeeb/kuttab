import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format, startOfMonth } from 'date-fns';
import { BookOpenCheck, ChevronLeft, ChevronRight, NotebookPen, Plus, Search, Trash2, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { formatPart } from '../utils/formatPart';
import PortionForm from '../components/PortionForm';
import { PORTION_STATUSES } from '../utils/portions';
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

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
const fromYmd = (s: string) => new Date(`${s}T12:00:00`);
const fmtNum = (n: number) => (Math.round(n * 100) / 100).toLocaleString('ar-EG');
const dayLabel = (s: string) => new Date(s).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'short' });

function weekStartOf(date: Date, startDay: number): Date {
  const diff = (date.getDay() - startDay + 7) % 7;
  return addDays(date, -diff);
}

interface Portion {
  id: number;
  studentId: number;
  date: string;
  description: string;
  ayahCount: number;
  thumnAmount: number;
  status: string;
  notes: string | null;
  sheikhName: string | null;
}

interface Totals {
  studentId: number;
  ayahCount: number;
  thumnAmount: number;
  portions: number;
}

export default function WeeklyLog() {
  const qc = useQueryClient();
  const { data: settings } = useProgramSettings();
  const startDay = weekdayIndex(settings?.weekStartDay ?? 'saturday');
  const today = useMemo(() => new Date(), []);

  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(() => addDays(weekStartOf(today, startDay), weekOffset * 7), [today, startDay, weekOffset]);
  const weekEnd = addDays(weekStart, 6);
  const isCurrentWeek = weekOffset === 0;
  const [recordDate, setRecordDate] = useState<string | null>(null);
  const effectiveDate = recordDate && recordDate >= ymd(weekStart) && recordDate <= ymd(weekEnd) ? recordDate : isCurrentWeek ? ymd(today) : ymd(weekStart);

  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [halaqaFilter, setHalaqaFilter] = useState('all');
  const [openFor, setOpenFor] = useState<number | null>(null);
  const [sort, setSort] = useState<'name' | 'month'>('name');

  const { data: halaqat = [] } = useHalaqat();
  const { data: students = [], isLoading } = useQuery<any[]>({
    queryKey: ['students'],
    queryFn: async () => (await api.get('/students')).data,
  });
  const { data: weekPortions = [] } = useQuery<Portion[]>({
    queryKey: ['portions-week', ymd(weekStart)],
    queryFn: async () => (await api.get(`/portions?from=${ymd(weekStart)}&to=${ymd(weekEnd)}`)).data,
  });
  const monthStart = ymd(startOfMonth(weekEnd < today ? weekEnd : today));
  const monthEnd = ymd(weekEnd < today ? weekEnd : today);
  const { data: monthTotals = [] } = useQuery<Totals[]>({
    queryKey: ['portions-summary', monthStart, monthEnd],
    queryFn: async () => (await api.get(`/portions/summary?from=${monthStart}&to=${monthEnd}`)).data,
  });

  const portionsBy = useMemo(() => {
    const m = new Map<number, Portion[]>();
    for (const p of weekPortions) m.set(p.studentId, [...(m.get(p.studentId) ?? []), p]);
    return m;
  }, [weekPortions]);
  const monthBy = useMemo(() => new Map(monthTotals.map((t) => [t.studentId, t])), [monthTotals]);

  const list = useMemo(() => {
    const q = search.trim();
    const rows = students.filter(
      (s) => (!q || s.name.includes(q) || s.serialNumber?.includes(q)) && matchesPlacement(s, periodFilter, halaqaFilter),
    );
    if (sort === 'month') rows.sort((a, b) => (monthBy.get(b.id)?.ayahCount ?? 0) - (monthBy.get(a.id)?.ayahCount ?? 0));
    return rows;
  }, [students, search, periodFilter, halaqaFilter, sort, monthBy]);

  const visibleIds = new Set(list.map((s) => s.id));
  const weekSum = weekPortions
    .filter((p) => visibleIds.has(p.studentId))
    .reduce((t, p) => ({ ayat: t.ayat + p.ayahCount, athman: t.athman + p.thumnAmount }), { ayat: 0, athman: 0 });
  const monthSum = monthTotals
    .filter((t) => visibleIds.has(t.studentId))
    .reduce((t, p) => ({ ayat: t.ayat + p.ayahCount, athman: t.athman + p.thumnAmount }), { ayat: 0, athman: 0 });
  const recordedCount = list.filter((s) => portionsBy.has(s.id)).length;
  const topOfMonth = [...list]
    .filter((s) => monthBy.get(s.id)?.ayahCount)
    .sort((a, b) => monthBy.get(b.id)!.ayahCount - monthBy.get(a.id)!.ayahCount)
    .slice(0, 3);

  const invalidate = () => {
    for (const key of ['portions', 'portions-week', 'portions-summary']) qc.invalidateQueries({ queryKey: [key] });
  };
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => (await api.put(`/portions/${id}`, { status })).data,
    onSuccess: invalidate,
    onError: (err) => toast.error(apiError(err)),
  });
  const remove = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/portions/${id}`)).data,
    onSuccess: () => {
      invalidate();
      toast.success('حُذف المقرر');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      {/* Header & week navigator */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md ring-4 ring-emerald-50">
            <NotebookPen size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 font-heading">الحفظ الأسبوعي</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              تسجيل المقرر الجديد لكل طالب (من آية إلى آية) مع حساب دقيق لعدد الآيات والأثمان
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <button onClick={() => setWeekOffset((w) => w - 1)} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer" title="الأسبوع السابق">
            <ChevronRight size={16} />
          </button>
          <div className="text-center px-2">
            <div className="text-xs font-black text-slate-900">
              {isCurrentWeek ? 'هذا الأسبوع' : weekOffset === -1 ? 'الأسبوع الماضي' : `أسبوع ${format(weekStart, 'dd/MM')}`}
            </div>
            <div className="text-[11px] text-slate-500">
              {weekStart.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })} – {weekEnd.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
            </div>
          </div>
          <button
            onClick={() => setWeekOffset((w) => Math.min(0, w + 1))}
            disabled={isCurrentWeek}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer disabled:opacity-40"
            title="الأسبوع التالي"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200">
            <span className="text-[11px] font-bold text-slate-500">تاريخ التسجيل</span>
            <input
              type="date"
              value={effectiveDate}
              min={ymd(weekStart)}
              max={ymd(weekEnd)}
              onChange={(e) => setRecordDate(e.target.value)}
              className="h-9 rounded-xl bg-white border border-slate-200 px-2 text-xs font-bold outline-none"
            />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80">
          <div className="text-xs font-bold text-slate-400">سُجّل لهم هذا الأسبوع</div>
          <div className="text-2xl font-black text-slate-900 font-heading">
            {recordedCount} <span className="text-sm text-slate-400">/ {list.length}</span>
          </div>
        </div>
        <div className="bg-emerald-50 p-4 rounded-3xl border border-emerald-200">
          <div className="text-xs font-bold text-emerald-800">آيات الأسبوع</div>
          <div className="text-2xl font-black text-emerald-900 font-heading">{fmtNum(weekSum.ayat)}</div>
          <div className="text-[11px] text-emerald-700">{fmtNum(weekSum.athman)} ثمن</div>
        </div>
        <div className="bg-teal-50 p-4 rounded-3xl border border-teal-200">
          <div className="text-xs font-bold text-teal-800">منذ بداية الشهر</div>
          <div className="text-2xl font-black text-teal-900 font-heading">{fmtNum(monthSum.ayat)} آية</div>
          <div className="text-[11px] text-teal-700">{fmtNum(monthSum.athman)} ثمن</div>
        </div>
        <div className="bg-amber-50 p-4 rounded-3xl border border-amber-200">
          <div className="text-xs font-bold text-amber-800 flex items-center gap-1">
            <Trophy size={13} /> الأكثر حفظاً هذا الشهر
          </div>
          {topOfMonth.length ? (
            <ol className="text-[11px] text-amber-950 mt-1 space-y-0.5">
              {topOfMonth.map((s, i) => (
                <li key={s.id} className="truncate">
                  {i + 1}. {s.name} — {monthBy.get(s.id)!.ayahCount} آية
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-[11px] text-amber-700 mt-1">لا يوجد بعد</div>
          )}
        </div>
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
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as 'name' | 'month')}
          className="h-10 rounded-2xl bg-slate-50 border border-slate-200 px-3 text-xs font-bold outline-none cursor-pointer"
        >
          <option value="name">ترتيب أبجدي</option>
          <option value="month">الأكثر حفظاً هذا الشهر</option>
        </select>
        <span className="text-[11px] text-slate-400">يبدأ الأسبوع يوم {weekdayName(settings?.weekStartDay ?? 'saturday')}</span>
      </div>

      {/* Students */}
      {isLoading ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 text-sm font-bold text-slate-500">جاري التحميل...</div>
      ) : list.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 text-sm text-slate-500">لا يوجد طلاب يطابقون التصفية</div>
      ) : (
        <div className="space-y-3">
          {list.map((s) => {
            const mine = portionsBy.get(s.id) ?? [];
            const month = monthBy.get(s.id);
            const open = openFor === s.id;
            return (
              <div key={s.id} className={`bg-white rounded-3xl border shadow-xs p-4 space-y-3 ${mine.length ? 'border-emerald-200' : 'border-slate-200/80'}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black shrink-0 ${mine.length ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {mine.length ? <BookOpenCheck size={18} /> : s.name.substring(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <Link to={`/students/${s.id}`} className="font-black text-slate-900 hover:text-emerald-700">
                        {s.name}
                      </Link>
                      <div className="text-[11px] text-slate-500 truncate">
                        {periodName(s.period)}
                        {s.halaqa ? ` · ${s.halaqa.name}` : ''} · الموضع الحالي: {formatPart(s.currentReach) || 'لم يحدد'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {month && (
                      <span className="text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full">
                        الشهر: {month.ayahCount} آية · {fmtNum(month.thumnAmount)} ثمن
                      </span>
                    )}
                    <button
                      onClick={() => setOpenFor(open ? null : s.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer ${
                        open ? 'bg-slate-800 text-white' : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      }`}
                    >
                      <Plus size={14} />
                      {open ? 'إغلاق' : 'تسجيل مقرر'}
                    </button>
                  </div>
                </div>

                {mine.length > 0 && (
                  <ul className="space-y-1.5">
                    {mine.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-2 text-xs bg-slate-50 rounded-xl px-3 py-2">
                        <span className="text-slate-400 w-28 shrink-0">{dayLabel(p.date)}</span>
                        <span className="font-bold text-slate-800 flex-1 min-w-40">{p.description}</span>
                        <span className="text-slate-600">
                          {p.ayahCount} آية · {fmtNum(p.thumnAmount)} ثمن
                        </span>
                        <select
                          value={p.status}
                          onChange={(e) => setStatus.mutate({ id: p.id, status: e.target.value })}
                          className={`h-7 rounded-lg px-2 text-[11px] font-black border outline-none cursor-pointer ${
                            p.status === 'أتقن'
                              ? 'bg-emerald-100 border-emerald-200 text-emerald-900'
                              : p.status === 'لم يتقن'
                                ? 'bg-rose-100 border-rose-200 text-rose-900'
                                : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          {PORTION_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st === 'جاري' ? 'جاري الحفظ' : st}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            if (window.confirm(`حذف المقرر «${p.description}»؟`)) remove.mutate(p.id);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                          title="حذف المقرر"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {open && (
                  <PortionForm
                    key={`${s.id}-${s.currentReach}`}
                    studentId={s.id}
                    studentName={s.name}
                    date={effectiveDate}
                    currentReach={s.currentReach}
                    onSaved={() => setOpenFor(null)}
                    onCancel={() => setOpenFor(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-slate-400 text-center">
        عدد الآيات دقيق. الأثمان محسوبة بعدد الحروف (الثمن = 1/480 من المصحف)، لأن الآيات تختلف طولاً. يوم التسجيل: {dayLabel(fromYmd(effectiveDate).toISOString())}
      </p>
    </div>
  );
}
