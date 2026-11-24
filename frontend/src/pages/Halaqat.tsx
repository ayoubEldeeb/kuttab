import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  ChevronDown,
  Layers,
  Pencil,
  Plus,
  Search,
  Sparkles,
  StickyNote,
  Sun,
  Sunset,
  Trash2,
  UserCircle2,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useThemeAndSettings } from '../context/ThemeAndSettingsContext';
import { getQuranStage } from '../utils/quranStages';
import { formatPart } from '../utils/formatPart';
import {
  PERIODS,
  apiError,
  invalidatePlacement,
  periodName,
  studentsAr,
  suggestsAsrMove,
  useHalaqat,
  type Halaqa,
  type PeriodId,
} from '../utils/program';
import TransferDialog, { type TransferStudent } from '../components/TransferDialog';

interface StudentRow {
  id: number;
  name: string;
  serialNumber: string;
  currentReach: string | null;
  period: PeriodId | null;
  halaqaId: number | null;
  sheikh?: { name: string } | null;
}

const PERIOD_ICON = { asr: Sun, maghrib: Sunset } as const;

export default function Halaqat() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'مشرف عام' || user?.username === 'admin';
  const { data: halaqat = [], isLoading: loadingHalaqat } = useHalaqat();
  const { data: students = [], isLoading: loadingStudents } = useQuery<StudentRow[]>({
    queryKey: ['students'],
    queryFn: async () => (await api.get('/students')).data,
  });

  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [transfer, setTransfer] = useState<{ students: TransferStudent[]; period?: PeriodId } | null>(null);
  const [editing, setEditing] = useState<Partial<Halaqa> | null>(null);
  const [notesFor, setNotesFor] = useState<Halaqa | null>(null);
  const [deleting, setDeleting] = useState<Halaqa | null>(null);

  const q = search.trim();
  const visible = useMemo(
    () => (q ? students.filter((s) => s.name.includes(q) || s.serialNumber?.includes(q)) : students),
    [students, q],
  );
  const byGroup = useMemo(() => {
    const m = new Map<string, StudentRow[]>();
    for (const s of visible) {
      const key = s.halaqaId ? `h${s.halaqaId}` : s.period ? `p${s.period}` : 'none';
      m.set(key, [...(m.get(key) ?? []), s]);
    }
    return m;
  }, [visible]);

  const mujadila = useMemo(() => students.filter(suggestsAsrMove), [students]);
  const unplaced = byGroup.get('none') ?? [];

  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !o[key] }));
  const toggleSelect = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const selectedStudents = students.filter((s) => selected.has(s.id));

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/halaqat/${id}`)).data,
    onSuccess: (res) => {
      invalidatePlacement(qc);
      toast.success(
        res?.unassignedStudents ? `حُذفت الحلقة، وبقي ${studentsAr(res.unassignedStudents)} في نفس الفترة بدون حلقة` : 'حُذفت الحلقة',
      );
      setDeleting(null);
    },
    onError: (err) => toast.error(apiError(err, 'تعذر حذف الحلقة')),
  });

  const isLoading = loadingHalaqat || loadingStudents;

  const renderStudents = (list: StudentRow[]) =>
    list.length === 0 ? (
      <div className="text-xs text-slate-400 text-center py-4">لا يوجد طلاب</div>
    ) : (
      <ul className="divide-y divide-slate-100">
        {list.map((s) => (
          <li key={s.id} className="flex items-center gap-2.5 py-2.5 px-1">
            <input
              type="checkbox"
              checked={selected.has(s.id)}
              onChange={() => toggleSelect(s.id)}
              className="w-4 h-4 accent-emerald-700 cursor-pointer shrink-0"
              aria-label={`تحديد ${s.name}`}
            />
            <div className="min-w-0 flex-1">
              <Link to={`/students/${s.id}`} className="text-sm font-bold text-slate-800 hover:text-emerald-700 truncate block">
                {s.name}
              </Link>
              <div className="text-[11px] text-slate-400 truncate">
                {getQuranStage(s.currentReach)} · {formatPart(s.currentReach) || 'لم يحدد'}
              </div>
            </div>
            {suggestsAsrMove(s) && (
              <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full shrink-0" title="وصل إلى سورة المجادلة">
                مؤهل للعصر
              </span>
            )}
            <button
              onClick={() => setTransfer({ students: [s] })}
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-700 hover:bg-indigo-50 cursor-pointer shrink-0"
              title="نقل الطالب"
            >
              <ArrowLeftRight size={15} />
            </button>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md ring-4 ring-emerald-50">
            <Layers size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 font-heading">الفترات والحلقات</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              توزيع الطلاب على فترتي العصر والمغرب وحلقات المشايخ، مع توثيق كل نقل في سجل الطالب
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search size={16} className="absolute right-3 top-3 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث عن طالب..."
              className="w-full h-10 pr-9 pl-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm outline-none focus:bg-white"
            />
          </div>
          {isAdmin && (
            <button
              onClick={() => setEditing({ period: 'asr' })}
              className="flex items-center gap-1.5 px-4 h-10 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black shadow-sm cursor-pointer shrink-0"
            >
              <Plus size={16} />
              حلقة جديدة
            </button>
          )}
        </div>
      </div>

      {/* Al-Mujadila suggestion */}
      {mujadila.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Sparkles size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-black text-amber-900">
                {studentsAr(mujadila.length)} في فترة المغرب {mujadila.length === 1 ? 'وصل' : 'وصلوا'} إلى سورة المجادلة
              </div>
              <div className="text-xs text-amber-800/80 mt-0.5">
                حسب نظام المركز ينتقل هؤلاء إلى فترة العصر: {mujadila.slice(0, 4).map((s) => s.name).join('، ')}
                {mujadila.length > 4 ? ' ...' : ''}
              </div>
            </div>
          </div>
          <button
            onClick={() => setTransfer({ students: mujadila, period: 'asr' })}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black cursor-pointer shrink-0"
          >
            مراجعة ونقلهم إلى العصر
          </button>
        </div>
      )}

      {/* Bulk selection bar */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 p-3 rounded-2xl bg-slate-900 text-white flex items-center justify-between gap-3 shadow-xl">
          <span className="text-sm font-bold">تم تحديد {studentsAr(selected.size)}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTransfer({ students: selectedStudents })}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-xs font-black cursor-pointer"
            >
              <ArrowLeftRight size={14} />
              نقل المحددين
            </button>
            <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer">
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 text-sm font-bold text-slate-500">جاري التحميل...</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {PERIODS.map((p) => {
            const Icon = PERIOD_ICON[p.id];
            const periodHalaqat = halaqat.filter((h) => h.period === p.id);
            const loose = byGroup.get(`p${p.id}`) ?? [];
            const total = students.filter((s) => s.period === p.id).length;
            return (
              <section key={p.id} className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                <header className="p-5 bg-gradient-to-l from-emerald-50 to-white border-b border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center">
                      <Icon size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900 font-heading">{p.name}</h2>
                      <p className="text-[11px] text-slate-500">{p.range}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-2xl font-black text-emerald-800 font-heading">{total}</div>
                    <div className="text-[10px] text-slate-400 font-bold">طالب · {periodHalaqat.length} حلقة</div>
                  </div>
                </header>

                <div className="p-4 space-y-3">
                  {periodHalaqat.length === 0 && (
                    <div className="text-xs text-slate-400 text-center py-3">
                      لا توجد حلقات في هذه الفترة{isAdmin ? ' — أضف حلقة من زر «حلقة جديدة»' : ''}
                    </div>
                  )}

                  {periodHalaqat.map((h) => {
                    const key = `h${h.id}`;
                    const list = byGroup.get(key) ?? [];
                    const canEditNotes = isAdmin || h.sheikhId === user?.id;
                    return (
                      <div key={h.id} className="rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="p-3.5 flex items-start gap-3 bg-slate-50/60">
                          <button onClick={() => toggle(key)} className="flex-1 min-w-0 text-right cursor-pointer">
                            <div className="flex items-center gap-2">
                              <ChevronDown size={16} className={`text-slate-400 transition-transform ${open[key] ? '' : '-rotate-90'}`} />
                              <span className="font-black text-slate-900 truncate">{h.name}</span>
                              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                                {h.studentsCount} طالب
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 pr-6">
                              <UserCircle2 size={13} />
                              {h.sheikh?.name ?? 'بدون شيخ'}
                            </div>
                            {h.notes && (
                              <div className="text-xs text-slate-600 mt-2 pr-6 flex items-start gap-1.5 whitespace-pre-line">
                                <StickyNote size={13} className="text-amber-500 shrink-0 mt-0.5" />
                                {h.notes}
                              </div>
                            )}
                          </button>
                          <div className="flex items-center gap-1 shrink-0">
                            {canEditNotes && !isAdmin && (
                              <button
                                onClick={() => setNotesFor(h)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-50 cursor-pointer"
                                title="ملاحظات الحلقة"
                              >
                                <StickyNote size={15} />
                              </button>
                            )}
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => setEditing(h)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                  title="تعديل الحلقة"
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  onClick={() => setDeleting(h)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                                  title="حذف الحلقة"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {(open[key] || q) && <div className="px-3 pb-1">{renderStudents(list)}</div>}
                      </div>
                    );
                  })}

                  {/* Students in this period without a halaqa */}
                  {loose.length > 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 overflow-hidden">
                      <button onClick={() => toggle(`p${p.id}`)} className="w-full p-3.5 flex items-center gap-2 text-right cursor-pointer">
                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${open[`p${p.id}`] ? '' : '-rotate-90'}`} />
                        <span className="font-bold text-slate-700">في الفترة بدون حلقة</span>
                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{loose.length} طالب</span>
                      </button>
                      {(open[`p${p.id}`] || q) && <div className="px-3 pb-1">{renderStudents(loose)}</div>}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Students without any period */}
      {!isLoading && unplaced.length > 0 && (
        <section className="bg-white rounded-3xl border border-amber-200 shadow-sm p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Users size={20} className="text-amber-600" />
              <div>
                <h2 className="font-black text-slate-900">طلاب لم يُحدد لهم فترة ({unplaced.length})</h2>
                <p className="text-xs text-slate-500">حدد الطلاب ثم انقلهم إلى الفترة والحلقة المناسبة.</p>
              </div>
            </div>
            <button
              onClick={() => setSelected(new Set(unplaced.map((s) => s.id)))}
              className="px-3.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-black cursor-pointer self-start"
            >
              تحديد الكل
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">{renderStudents(unplaced)}</div>
        </section>
      )}

      {transfer && (
        <TransferDialog
          students={transfer.students}
          initialPeriod={transfer.period}
          onClose={() => setTransfer(null)}
          onDone={() => setSelected(new Set())}
        />
      )}
      {editing && <HalaqaForm initial={editing} onClose={() => setEditing(null)} />}
      {notesFor && <NotesForm halaqa={notesFor} onClose={() => setNotesFor(null)} />}

      {deleting && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setDeleting(null)}>
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={26} />
            </div>
            <h3 className="text-lg font-black text-slate-900">حذف «{deleting.name}»؟</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              لن يُحذف أي طالب. سيبقى طلاب الحلقة ({deleting.studentsCount}) في {periodName(deleting.period)} بدون حلقة حتى تنقلهم.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => deleteMutation.mutate(deleting.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm cursor-pointer disabled:opacity-50"
              >
                تأكيد الحذف
              </button>
              <button onClick={() => setDeleting(null)} className="py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm cursor-pointer">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 font-heading">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer" aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const fieldClass = 'w-full h-11 rounded-2xl bg-slate-50 border border-slate-200 px-3 text-sm outline-none focus:bg-white';

function HalaqaForm({ initial, onClose }: { initial: Partial<Halaqa>; onClose: () => void }) {
  const qc = useQueryClient();
  const { sheikhs } = useThemeAndSettings();
  const [name, setName] = useState(initial.name ?? '');
  const [period, setPeriod] = useState<PeriodId>(initial.period ?? 'asr');
  const [sheikhId, setSheikhId] = useState(initial.sheikhId ? String(initial.sheikhId) : '');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const isNew = !initial.id;
  const periodChanged = !isNew && initial.period !== period && (initial.studentsCount ?? 0) > 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const body = { name: name.trim(), period, sheikhId: sheikhId ? Number(sheikhId) : null, notes: notes.trim() || null };
      return isNew ? (await api.post('/halaqat', body)).data : (await api.put(`/halaqat/${initial.id}`, body)).data;
    },
    onSuccess: () => {
      invalidatePlacement(qc);
      toast.success(isNew ? 'تمت إضافة الحلقة' : 'تم حفظ التعديلات');
      onClose();
    },
    onError: (err) => toast.error(apiError(err, 'تعذر حفظ الحلقة')),
  });

  return (
    <Modal title={isNew ? 'حلقة جديدة' : `تعديل ${initial.name}`} onClose={onClose}>
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-600">اسم الحلقة</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: حلقة الشيخ أحمد الفرجاني" className={fieldClass} autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600">الفترة</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodId)} className={fieldClass}>
            {PERIODS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600">الشيخ</label>
          <select value={sheikhId} onChange={(e) => setSheikhId(e.target.value)} className={fieldClass}>
            <option value="">بدون شيخ</option>
            {sheikhs
              .filter((s) => s.isActive || String(s.id) === sheikhId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
      </div>
      {periodChanged && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
          تغيير الفترة سينقل طلاب الحلقة ({initial.studentsCount}) إلى {periodName(period)} معها.
        </p>
      )}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-600">ملاحظات</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${fieldClass} h-auto py-2.5 resize-none`} />
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !name.trim()}
          className="flex-1 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm cursor-pointer disabled:opacity-50"
        >
          {mutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
        </button>
        <button onClick={onClose} className="py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm cursor-pointer">
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

function NotesForm({ halaqa, onClose }: { halaqa: Halaqa; onClose: () => void }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(halaqa.notes ?? '');
  const mutation = useMutation({
    mutationFn: async () => (await api.put(`/halaqat/${halaqa.id}`, { notes: notes.trim() || null })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['halaqat'] });
      toast.success('تم حفظ الملاحظات');
      onClose();
    },
    onError: (err) => toast.error(apiError(err, 'تعذر حفظ الملاحظات')),
  });
  return (
    <Modal title={`ملاحظات ${halaqa.name}`} onClose={onClose}>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} className={`${fieldClass} h-auto py-2.5 resize-none`} autoFocus />
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="w-full py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm cursor-pointer disabled:opacity-50"
      >
        حفظ الملاحظات
      </button>
    </Modal>
  );
}
