import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { PERIODS, localToday, studentsAr, apiError, invalidatePlacement, periodName, useHalaqat, type PeriodId } from '../utils/program';

export interface TransferStudent {
  id: number;
  name: string;
  period?: string | null;
  halaqaId?: number | null;
}

interface Props {
  students: TransferStudent[];
  onClose: () => void;
  onDone?: () => void;
  /** Preselected target, e.g. from the Al-Mujadila suggestion. */
  initialPeriod?: PeriodId;
}

/**
 * Moves one or more students to another period and/or halaqa. Every real move
 * is written to the student's transfer log on the server.
 */
export default function TransferDialog({ students, onClose, onDone, initialPeriod }: Props) {
  const qc = useQueryClient();
  const { data: halaqat = [] } = useHalaqat();
  const single = students.length === 1 ? students[0] : null;

  const [period, setPeriod] = useState<PeriodId>(
    initialPeriod ?? ((single?.period as PeriodId) || 'asr'),
  );
  const [halaqaChoice, setHalaqaId] = useState<string>(
    !initialPeriod && single?.halaqaId ? String(single.halaqaId) : '',
  );
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(localToday);

  const options = useMemo(() => halaqat.filter((h) => h.period === period), [halaqat, period]);

  // A halaqa belongs to one period; a choice from another period does not apply.
  const halaqaId = options.some((h) => String(h.id) === halaqaChoice) ? halaqaChoice : '';

  const mutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/students/transfer', {
          studentIds: students.map((s) => s.id),
          toPeriod: period,
          toHalaqaId: halaqaId ? Number(halaqaId) : null,
          reason: reason.trim() || undefined,
          date,
        })
      ).data as { moved: number; unchanged: number },
    onSuccess: (res) => {
      invalidatePlacement(qc);
      qc.invalidateQueries({ queryKey: ['transfers'] });
      if (res.moved) {
        toast.success(
          res.moved === 1 && single ? `تم نقل ${single.name} وتوثيق النقل في سجله` : `تم نقل ${studentsAr(res.moved)} وتوثيق النقل`,
        );
      }
      if (res.unchanged) toast(`${studentsAr(res.unchanged)} في نفس المكان أصلاً، لم يتغير شيء`, { icon: 'ℹ️' });
      onDone?.();
      onClose();
    },
    onError: (err) => toast.error(apiError(err, 'تعذر نقل الطالب')),
  });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" dir="rtl" onClick={onClose}>
      <div
        className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <ArrowLeftRight size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 font-heading">نقل طالب</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {single ? (
                  <>
                    <strong className="text-slate-800">{single.name}</strong> — حالياً في {periodName(single.period)}
                    {single.halaqaId ? ` / ${halaqat.find((h) => h.id === single.halaqaId)?.name ?? ''}` : ' / بدون حلقة'}
                  </>
                ) : (
                  <>نقل {studentsAr(students.length)} دفعة واحدة</>
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer" aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-600">إلى الفترة</label>
          <div className="grid grid-cols-2 gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                  period === p.id
                    ? 'bg-emerald-700 border-emerald-700 text-white shadow-md'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-emerald-50'
                }`}
              >
                <div className="text-sm font-black">{p.name}</div>
                <div className={`text-[11px] ${period === p.id ? 'text-emerald-100' : 'text-slate-400'}`}>{p.range}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-600">إلى الحلقة</label>
          <select
            value={halaqaId}
            onChange={(e) => setHalaqaId(e.target.value)}
            className="w-full h-11 rounded-2xl bg-slate-50 border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:bg-white"
          >
            <option value="">بدون حلقة (الفترة فقط)</option>
            {options.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
                {h.sheikh ? ` — ${h.sheikh.name}` : ''} ({h.studentsCount} طالب)
              </option>
            ))}
          </select>
          {halaqaId && (
            <p className="text-[11px] text-slate-500">سيصبح شيخ الحلقة هو المحفظ المسؤول عن الطالب.</p>
          )}
          {!options.length && (
            <p className="text-[11px] text-amber-700">لا توجد حلقات في {periodName(period)} بعد؛ يمكن إضافتها من صفحة الفترات والحلقات.</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 space-y-2">
            <label className="text-xs font-bold text-slate-600">سبب النقل (اختياري)</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: وصل إلى سورة المجادلة"
              className="w-full h-11 rounded-2xl bg-slate-50 border border-slate-200 px-3 text-sm outline-none focus:bg-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600">تاريخ النقل</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-11 rounded-2xl bg-slate-50 border border-slate-200 px-3 text-sm outline-none focus:bg-white"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !students.length}
            className="flex-1 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {mutation.isPending ? 'جاري النقل...' : 'تأكيد النقل'}
          </button>
          <button onClick={onClose} className="py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm cursor-pointer">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
