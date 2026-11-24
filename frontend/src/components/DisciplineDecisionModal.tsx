import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, ShieldAlert, ShieldCheck, UserX, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  apiError,
  invalidateDiscipline,
  invalidatePlacement,
  type DisciplineKind,
  type DisciplineState,
} from '../utils/program';

interface Props {
  student: { id: number; name: string; guardianPhone?: string | null };
  state: DisciplineState;
  onClose: () => void;
}

const ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
const ordinal = (n: number) => ORDINALS[n - 1] ?? `رقم ${n}`;

function guardianMessage(name: string, kind: DisciplineKind, warningNumber: number, absences: number): string {
  if (kind === 'dismissal') {
    return `السلام عليكم ورحمة الله وبركاته،\nولي أمر الطالب: *${name}*\n\nنحيطكم علماً بأنه تقرر فصل الطالب من الحلقة لتكرار الغياب بدون إذن بعد استنفاد الإنذارات.\nللمراجعة يرجى التواصل مع إدارة الحلقة.\n\n*إدارة حلقة تحفيظ القرآن الكريم*`;
  }
  return `السلام عليكم ورحمة الله وبركاته،\nولي أمر الطالب: *${name}*\n\nنحيطكم علماً بأن الطالب حصل على *الإنذار ${ordinal(warningNumber)}* بسبب الغياب ${absences} مرات بدون إذن.\nنرجو المتابعة والحرص على الحضور، وفي حال وجود عذر يرجى إبلاغ الشيخ مسبقاً.\n\n*إدارة حلقة تحفيظ القرآن الكريم*`;
}

/**
 * Asks the sheikh what to do when a student reaches the absence or warning
 * limit. The app only proposes; nothing is recorded until a choice is made.
 */
export default function DisciplineDecisionModal({ student, state, onClose }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'مشرف عام' || user?.username === 'admin';
  const [reason, setReason] = useState('');
  const [notifyGuardian, setNotifyGuardian] = useState(!!student.guardianPhone);

  const alert = state.alert;
  const atLimit = alert?.suggestion === 'dismissal';
  const nextWarning = state.warnings + 1;

  const mutation = useMutation({
    mutationFn: async (kind: DisciplineKind) =>
      (await api.post(`/discipline/students/${student.id}/actions`, { kind, reason: reason.trim() || undefined })).data,
    onSuccess: (_data, kind) => {
      invalidateDiscipline(qc, student.id);
      if (kind === 'dismissal') invalidatePlacement(qc);
      const label =
        kind === 'warning'
          ? `تم تسجيل الإنذار ${ordinal(nextWarning)} للطالب ${student.name}`
          : kind === 'pardon'
            ? `تم التجاوز عن غياب ${student.name}، ويبدأ العد من جديد`
            : `تم فصل الطالب ${student.name} ونقله إلى أرشيف المفصولين`;
      toast.success(label, { duration: 3500 });
      if (notifyGuardian && student.guardianPhone && (kind === 'warning' || kind === 'dismissal')) {
        const phone = student.guardianPhone.replace(/\D/g, '');
        const text = guardianMessage(student.name, kind, nextWarning, state.unexcusedAbsences);
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
      }
      onClose();
    },
    onError: (err) => toast.error(apiError(err, 'تعذر حفظ القرار')),
  });

  if (!alert) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className={`p-6 ${atLimit ? 'bg-rose-50 border-b border-rose-200' : 'bg-amber-50 border-b border-amber-200'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  atLimit ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                }`}
              >
                {atLimit ? <ShieldAlert size={26} /> : <AlertTriangle size={26} />}
              </div>
              <div>
                <div className={`text-xs font-bold ${atLimit ? 'text-rose-700' : 'text-amber-800'}`}>{student.name}</div>
                <h3 className="text-lg font-black text-slate-900 font-heading leading-snug mt-0.5">{alert.title}</h3>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-white/70 cursor-pointer" aria-label="إغلاق">
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed mt-3">{alert.message}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700">
              الإنذارات: {state.warnings} من {state.maxWarnings}
            </span>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700">
              غياب بدون إذن: {state.unexcusedAbsences} (الحد {state.absenceThreshold})
            </span>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">ملاحظة على القرار (اختياري)</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: تواصلنا مع ولي الأمر"
              className="w-full h-11 rounded-2xl bg-slate-50 border border-slate-200 px-3 text-sm outline-none focus:bg-white"
            />
          </div>

          {student.guardianPhone && (
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
              <input type="checkbox" checked={notifyGuardian} onChange={(e) => setNotifyGuardian(e.target.checked)} className="w-4 h-4 accent-emerald-700" />
              إبلاغ ولي الأمر عبر واتساب بعد القرار
            </label>
          )}

          <div className="grid gap-2">
            {atLimit && (
              <button
                onClick={() => mutation.mutate('dismissal')}
                disabled={mutation.isPending || !isAdmin}
                title={isAdmin ? '' : 'الفصل قرار المشرف العام'}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-black shadow-md shadow-rose-700/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserX size={18} />
                فصل الطالب
              </button>
            )}
            <button
              onClick={() => mutation.mutate('warning')}
              disabled={mutation.isPending}
              className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-black cursor-pointer disabled:opacity-50 ${
                atLimit
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                  : 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-600/20'
              }`}
            >
              <AlertTriangle size={18} />
              {atLimit ? `إنذار إضافي (الإنذار ${ordinal(nextWarning)})` : `إعطاء الإنذار ${ordinal(nextWarning)}`}
            </button>
            <button
              onClick={() => mutation.mutate('pardon')}
              disabled={mutation.isPending}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-sm font-black cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck size={18} />
              التجاوز هذه المرة (يبدأ عدّ الغياب من جديد)
            </button>
            <button
              onClick={onClose}
              disabled={mutation.isPending}
              className="flex items-center justify-center gap-2 py-2.5 rounded-2xl text-slate-500 hover:bg-slate-100 text-xs font-bold cursor-pointer"
            >
              <Clock size={15} />
              تأجيل القرار (يبقى التنبيه في لوحة التحكم)
            </button>
          </div>

          {atLimit && !isAdmin && (
            <p className="text-[11px] text-slate-500 text-center">قرار الفصل يتخذه المشرف العام؛ سيظهر له هذا التنبيه في لوحة التحكم.</p>
          )}
        </div>
      </div>
    </div>
  );
}
