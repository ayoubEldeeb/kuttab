import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { SURAH_NAMES } from '../utils/quranMetrics.data';
import { ayahCountOf, describeSegments, measurePortion, surahName, type PortionSegment } from '../utils/quranMetrics';
import { PORTION_STATUSES, suggestNext, type PortionDraft as Draft } from '../utils/portions';
import { apiError } from '../utils/program';

interface Props {
  studentId: number;
  studentName: string;
  date: string;
  currentReach?: string | null;
  onSaved?: () => void;
  onCancel?: () => void;
}

const input = 'h-10 rounded-xl bg-white border border-slate-200 px-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-600/30';

export default function PortionForm({ studentId, studentName, date, currentReach, onSaved, onCancel }: Props) {
  const qc = useQueryClient();
  const suggestion = useMemo(() => suggestNext(currentReach), [currentReach]);
  const [rows, setRows] = useState<Draft[]>([suggestion ?? { surah: 78, fromAyah: '1', toAyah: '5' }]);
  const [status, setStatus] = useState<(typeof PORTION_STATUSES)[number]>('جاري');
  const [notes, setNotes] = useState('');
  const [updateReach, setUpdateReach] = useState(true);

  const segments: PortionSegment[] = rows.map((r) => ({ surah: r.surah, fromAyah: Number(r.fromAyah), toAyah: Number(r.toAyah) }));
  const measured = measurePortion(segments);
  const valid = !measured.errors.length && rows.every((r) => r.fromAyah && r.toAyah);

  const setRow = (i: number, patch: Partial<Draft>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = useMutation({
    mutationFn: async () =>
      (await api.post(`/students/${studentId}/portions`, { date, segments, status, notes: notes.trim() || undefined, updateReach })).data,
    onSuccess: (p) => {
      for (const key of ['portions', 'portions-week', 'portions-summary', 'students', 'student']) qc.invalidateQueries({ queryKey: [key] });
      toast.success(`سُجّل لـ ${studentName}: ${p.description} (${p.ayahCount} آية، ${p.thumnAmount} ثمن)`);
      onSaved?.();
    },
    onError: (err) => toast.error(apiError(err, 'تعذر حفظ المقرر')),
  });

  return (
    <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-3">
      <div className="space-y-2">
        {rows.map((r, i) => {
          const max = ayahCountOf(r.surah);
          return (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select value={r.surah} onChange={(e) => setRow(i, { surah: Number(e.target.value) })} className={`${input} w-40`}>
                {SURAH_NAMES.map((n, idx) => (
                  <option key={idx} value={idx + 1}>
                    {idx + 1}. {n}
                  </option>
                ))}
              </select>
              <span className="text-xs font-bold text-slate-500">من آية</span>
              <input type="number" min={1} value={r.fromAyah} onChange={(e) => setRow(i, { fromAyah: e.target.value })} className={`${input} w-20`} />
              <span className="text-xs font-bold text-slate-500">إلى آية</span>
              <input type="number" min={1} value={r.toAyah} onChange={(e) => setRow(i, { toAyah: e.target.value })} className={`${input} w-20`} />
              <span className="text-[11px] text-slate-400">({max} آية)</span>
              {rows.length > 1 && (
                <button
                  onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                  title="حذف هذا المقدار"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          );
        })}
        <button
          onClick={() => {
            const last = rows[rows.length - 1];
            const next = Math.max(1, last.surah - 1);
            setRows((rs) => [...rs, { surah: next, fromAyah: '1', toAyah: String(Math.min(5, ayahCountOf(next))) }]);
          }}
          className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
        >
          <Plus size={14} />
          إضافة سورة أخرى في نفس المقرر
        </button>
      </div>

      {/* Live measurement */}
      {measured.errors.length ? (
        <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5">{measured.errors.join(' ')}</div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-slate-700">{describeSegments(measured.segments)}</span>
          <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white font-black">{measured.ayahCount} آية</span>
          <span className="px-2.5 py-1 rounded-full bg-teal-600 text-white font-black" title="محسوبة بعدد الحروف: الثمن = 1/480 من المصحف">
            {measured.thumnAmount} ثمن
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500">الحالة:</span>
        {PORTION_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer ${
              status === s
                ? s === 'أتقن'
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : s === 'لم يتقن'
                    ? 'bg-rose-600 border-rose-600 text-white'
                    : 'bg-slate-800 border-slate-800 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {s === 'جاري' ? 'جاري الحفظ' : s}
          </button>
        ))}
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ملاحظة (اختياري)"
          className={`${input} flex-1 min-w-40 font-normal`}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={updateReach} onChange={(e) => setUpdateReach(e.target.checked)} className="w-4 h-4 accent-emerald-700" />
          تحديث موضع الحفظ الحالي إلى نهاية المقرر ({rows.length ? `${surahName(rows[rows.length - 1].surah)} ${rows[rows.length - 1].toAyah}` : ''})
        </label>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold cursor-pointer">
              إلغاء
            </button>
          )}
          <button
            onClick={() => save.mutate()}
            disabled={!valid || save.isPending}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black cursor-pointer disabled:opacity-40"
          >
            <Save size={14} />
            {save.isPending ? 'جاري الحفظ...' : 'حفظ المقرر'}
          </button>
        </div>
      </div>
    </div>
  );
}
