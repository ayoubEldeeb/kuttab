import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Save, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { WEEK_DAYS } from '../context/ThemeAndSettingsContext';
import { DEFAULT_PROGRAM_SETTINGS, apiError, useProgramSettings, type ProgramSettings } from '../utils/program';

const field = 'w-full h-11 rounded-2xl bg-slate-50 border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:bg-white';

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-700">{label}</label>
      <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className={field} />
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

/** Center rules: warnings thresholds, the week and exam day, revision amounts. */
export default function ProgramSettingsSection({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { data } = useProgramSettings();
  const [edits, setEdits] = useState<Partial<ProgramSettings>>({});
  const base = data ?? DEFAULT_PROGRAM_SETTINGS;
  const form: ProgramSettings = { ...base, ...edits };
  const set = <K extends keyof ProgramSettings>(key: K, value: ProgramSettings[K]) => setEdits((e) => ({ ...e, [key]: value }));
  const changedKeys = (Object.keys(edits) as (keyof ProgramSettings)[]).filter((k) => edits[k] !== base[k]);
  const dirty = !!data && changedKeys.length > 0;

  const save = useMutation({
    mutationFn: async () => {
      const changed = Object.fromEntries(changedKeys.map((k) => [k, form[k]]));
      return (await api.post('/settings', changed)).data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['program-settings'] });
      setEdits({});
      qc.invalidateQueries({ queryKey: ['discipline-alerts'] });
      qc.invalidateQueries({ queryKey: ['discipline'] });
      toast.success('تم حفظ نظام الحلقة');
    },
    onError: (err) => toast.error(apiError(err, 'تعذر حفظ الإعدادات')),
  });

  const t = form.disciplineAbsenceThreshold;
  const w = form.disciplineMaxWarnings;

  return (
    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200/80 space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center">
          <ShieldAlert size={22} />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900 font-heading">نظام الحلقة: الغياب والإنذارات</h2>
          <p className="text-xs text-slate-500">قابل للتعديل حسب لائحة المركز؛ البرنامج ينبّه ويقترح، والقرار دائماً للشيخ</p>
        </div>
      </div>

      <fieldset disabled={!canEdit} className="space-y-5">
        <label className="flex items-center gap-2.5 text-sm font-bold text-slate-800 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.disciplineEnabled}
            onChange={(e) => set('disciplineEnabled', e.target.checked)}
            className="w-5 h-5 accent-emerald-700"
          />
          تفعيل تنبيهات الغياب والإنذارات
        </label>

        <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${form.disciplineEnabled ? '' : 'opacity-50'}`}>
          <NumberField
            label="عدد مرات الغياب بدون إذن لكل إنذار"
            value={t}
            min={1}
            max={30}
            onChange={(n) => set('disciplineAbsenceThreshold', n)}
          />
          <NumberField
            label="عدد الإنذارات قبل الفصل"
            value={w}
            min={1}
            max={10}
            onChange={(n) => set('disciplineMaxWarnings', n)}
          />
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">بداية عدّ الغياب</label>
            <select
              value={form.disciplineCountWindow}
              onChange={(e) => set('disciplineCountWindow', e.target.value as ProgramSettings['disciplineCountWindow'])}
              className={field}
            >
              <option value="since_last_decision">من آخر قرار (إنذار أو تجاوز)</option>
              <option value="month">من بداية الشهر الحالي</option>
            </select>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
          <strong>النتيجة:</strong> كل {t === 1 ? 'غياب' : `${t} مرات غياب`} بدون إذن ← تنبيه بإنذار. بعد {w} {w === 1 ? 'إنذار' : 'إنذارات'} ←
          تنبيه «ماذا تريد أن تفعل؟» (فصل / إنذار إضافي / تجاوز). الغياب بإذن لا يُحتسب.
        </div>
      </fieldset>

      <div className="pt-5 border-t border-slate-100 space-y-4">
        <div className="flex items-center gap-2.5">
          <CalendarCheck size={20} className="text-emerald-700" />
          <h3 className="text-base font-black text-slate-900">الأسبوع والمراجعة</h3>
        </div>
        <fieldset disabled={!canEdit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">أول يوم في الأسبوع (للحفظ الأسبوعي)</label>
            <select value={form.weekStartDay} onChange={(e) => set('weekStartDay', e.target.value)} className={field}>
              {WEEK_DAYS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">يوم اختبار المراجعة</label>
            <select value={form.revisionExamDay} onChange={(e) => set('revisionExamDay', e.target.value)} className={field}>
              {WEEK_DAYS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <NumberField
            label="مراجعة يومية افتراضية (أثمان)"
            hint="للطلاب الجدد؛ ويُعدّل لكل طالب على حدة"
            value={form.defaultDailyRevisionAmount}
            min={1}
            max={40}
            onChange={(n) => set('defaultDailyRevisionAmount', n)}
          />
          <NumberField
            label="اختبار السبت الافتراضي (أجزاء)"
            hint="3 أو 5 حسب مستوى الطالب"
            value={form.defaultExamRevisionJuz}
            min={1}
            max={30}
            onChange={(n) => set('defaultExamRevisionJuz', n)}
          />
        </fieldset>
      </div>

      {canEdit ? (
        <button
          onClick={() => save.mutate()}
          disabled={!dirty || save.isPending}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-black shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save size={17} />
          {save.isPending ? 'جاري الحفظ...' : 'حفظ نظام الحلقة'}
        </button>
      ) : (
        <p className="text-[11px] text-slate-400">تعديل نظام الحلقة متاح للمشرف العام.</p>
      )}
    </div>
  );
}
