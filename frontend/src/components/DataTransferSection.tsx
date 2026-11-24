import { useEffect, useRef, useState } from 'react';
import {
  DatabaseBackup,
  Download,
  Upload,
  FileUp,
  ShieldCheck,
  TriangleAlert,
  CircleCheck,
  LoaderCircle,
  HardDrive,
  X,
  Info,
  LogIn,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';

interface Counts {
  sheikhs: number;
  halaqat?: number;
  students: number;
  histories: number;
  transfers?: number;
  disciplineActions?: number;
  portions?: number;
  revisionSessions?: number;
  settings: number;
}

interface BackupInfo {
  counts: Counts;
  databaseKind: 'sqlite' | 'postgres';
  databasePath: string | null;
  safetyBackupDir: string;
}

interface ImportPreview {
  sourceKind: 'backup-file' | 'legacy-database';
  fileName: string;
  exportedAt: string | null;
  incoming: Counts;
  current: Counts;
  warnings: string[];
}

interface ImportResult {
  imported: Counts;
  safetyBackupPath: string | null;
  warnings: string[];
}

const IMPORT_CONFIRMATION = 'REPLACE_ALL_DATA';
const ACCEPTED = '.json,.db,.sqlite,.sqlite3';

function errorMessage(err: any, fallback: string): string {
  const msg = err?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join('، ');
  if (typeof msg === 'string' && msg) return msg;
  if (err?.response?.status === 413) return 'حجم الملف أكبر من المسموح.';
  if (!err?.response) return 'تعذر الاتصال بالخادم المحلي.';
  return fallback;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('ar-EG', { dateStyle: 'long', timeStyle: 'short' });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} بايت`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} كيلوبايت`;
  return `${(n / 1024 / 1024).toFixed(1)} ميجابايت`;
}

const COUNT_LABELS: Array<{ key: keyof Counts; label: string }> = [
  { key: 'students', label: 'الطلاب' },
  { key: 'histories', label: 'سجلات المتابعة' },
  { key: 'sheikhs', label: 'حسابات المشايخ' },
  { key: 'halaqat', label: 'الحلقات' },
  { key: 'portions', label: 'مقررات الحفظ' },
  { key: 'revisionSessions', label: 'المراجعة والاختبارات' },
  { key: 'disciplineActions', label: 'الإنذارات والقرارات' },
  { key: 'transfers', label: 'سجل النقل' },
  { key: 'settings', label: 'الإعدادات' },
];

export default function DataTransferSection() {
  const { logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [info, setInfo] = useState<BackupInfo | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const loadInfo = async () => {
    try {
      const res = await api.get<BackupInfo>('/backup/info');
      setInfo(res.data);
    } catch {
      setInfo(null);
    }
  };

  useEffect(() => {
    loadInfo();
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await api.get('/backup/export', { responseType: 'blob' });
      const disposition: string = res.headers['content-disposition'] || '';
      const match = /filename="?([^";]+)"?/.exec(disposition);
      const fileName = match?.[1] || `kittab-backup-${new Date().toISOString().slice(0, 10)}.json`;

      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('تم إنشاء ملف النسخة الاحتياطية بنجاح');
    } catch (err: any) {
      let msg = 'حدث خطأ أثناء إنشاء النسخة الاحتياطية';
      // Error bodies arrive as a Blob because of responseType: 'blob'.
      if (err?.response?.data instanceof Blob) {
        try {
          msg = JSON.parse(await err.response.data.text())?.message || msg;
        } catch {}
      }
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setPreview(null);
    setPreviewError(null);
    setConfirmed(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadForm = (f: File, extra?: Record<string, string>) => {
    const form = new FormData();
    form.append('file', f);
    for (const [k, v] of Object.entries(extra || {})) form.append(k, v);
    return form;
  };

  const selectFile = async (f: File | undefined | null) => {
    if (!f) return;
    setResult(null);
    setFile(f);
    setPreview(null);
    setPreviewError(null);
    setConfirmed(false);
    setIsPreviewing(true);
    try {
      const res = await api.post<ImportPreview>('/backup/preview', uploadForm(f), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(res.data);
    } catch (err: any) {
      setPreviewError(errorMessage(err, 'تعذرت قراءة الملف.'));
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!file || !preview || !confirmed) return;
    setIsImporting(true);
    try {
      const res = await api.post<ImportResult>(
        '/backup/import',
        uploadForm(file, { confirm: IMPORT_CONFIRMATION }),
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 10 * 60 * 1000 },
      );
      setResult(res.data);
      resetImport();
      await loadInfo();
      toast.success('تم نقل البيانات بنجاح');
    } catch (err: any) {
      toast.error(errorMessage(err, 'فشل الاستيراد، ولم يتم تغيير أي بيانات على هذا الجهاز.'));
    } finally {
      setIsImporting(false);
    }
  };

  const finishAndRelogin = () => {
    // Accounts were replaced by the ones from the old device, so the current
    // session may no longer match; sign in again with the old device's accounts.
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200/80 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold">
            <DatabaseBackup size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-slate-900 text-base font-heading">
                النسخ الاحتياطي ونقل البيانات إلى جهاز جديد
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-200">
                للمشرف العام فقط
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">
              صدّر كل بيانات المركز (الطلاب، السجلات، المشايخ، الإعدادات) في ملف واحد، ثم استوردها على الجهاز الجديد
            </p>
          </div>
        </div>
      </div>

      {/* Current data on this device */}
      {info && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 mb-3">
            <HardDrive size={14} className="text-slate-500" />
            <span>البيانات الموجودة حالياً على هذا الجهاز</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {COUNT_LABELS.map(({ key, label }) => (
              <div key={key} className="bg-white rounded-xl border border-slate-200/80 px-3 py-2">
                <div className="text-[11px] text-slate-400 font-bold">{label}</div>
                <div className="text-lg font-black text-slate-800 font-mono">{info.counts[key] ?? 0}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Export */}
        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white flex flex-col gap-4 lg:self-start">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white text-xs font-black flex items-center justify-center">1</span>
            <h4 className="font-black text-sm text-slate-900 font-heading">التصدير من هذا الجهاز</h4>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            يُنشئ ملفاً واحداً (‎.json) يحتوي على جميع بيانات المركز. أرسل هذا الملف إلى الجهاز الجديد عبر الواتساب أو البريد
            أو فلاشة، ثم استورده من الخانة المجاورة. احتفظ بنسخة منه في مكان آمن كنسخة احتياطية.
          </p>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 cursor-pointer flex items-center justify-center gap-2"
          >
            {isExporting ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />}
            <span>{isExporting ? 'جاري إنشاء الملف...' : 'تحميل ملف النسخة الاحتياطية'}</span>
          </Button>
        </div>

        {/* Import */}
        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-sky-600 text-white text-xs font-black flex items-center justify-center">2</span>
            <h4 className="font-black text-sm text-slate-900 font-heading">الاستيراد إلى هذا الجهاز</h4>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => selectFile(e.target.files?.[0])}
          />

          {!file && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                selectFile(e.dataTransfer.files?.[0]);
              }}
              className={`w-full p-6 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center gap-2 cursor-pointer ${
                isDragging ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-slate-50/60 hover:bg-sky-50/50 hover:border-sky-400'
              }`}
            >
              <FileUp size={28} className="text-sky-600" />
              <span className="text-sm font-black text-slate-800">اختر الملف القادم من الجهاز القديم</span>
              <span className="text-[11px] text-slate-500">
                ملف النسخة الاحتياطية (‎.json) أو ملف قاعدة البيانات kittab.db — أو اسحبه وأفلته هنا
              </span>
            </button>
          )}

          {file && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-800 truncate" dir="ltr">{file.name}</div>
                <div className="text-[11px] text-slate-400">{formatBytes(file.size)}</div>
              </div>
              <button
                type="button"
                onClick={resetImport}
                disabled={isImporting}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                title="إلغاء اختيار الملف"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {isPreviewing && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <LoaderCircle size={14} className="animate-spin" />
              <span>جاري فحص الملف والتحقق من سلامة البيانات...</span>
            </div>
          )}

          {previewError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <TriangleAlert size={15} className="shrink-0 mt-0.5" />
              <span>{previewError}</span>
            </div>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck size={14} />
                  <span>
                    {preview.sourceKind === 'legacy-database'
                      ? 'ملف قاعدة بيانات صالح من إصدار سابق للبرنامج'
                      : 'ملف نسخة احتياطية صالح'}
                  </span>
                </div>
                {preview.exportedAt && <div>تاريخ إنشاء النسخة: {formatDateTime(preview.exportedAt)}</div>}
              </div>

              <table className="w-full text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-right font-bold px-3 py-2">البيان</th>
                    <th className="text-center font-bold px-3 py-2">في الملف</th>
                    <th className="text-center font-bold px-3 py-2">على هذا الجهاز الآن</th>
                  </tr>
                </thead>
                <tbody>
                  {COUNT_LABELS.map(({ key, label }) => (
                    <tr key={key} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 font-bold text-slate-700">{label}</td>
                      <td className="px-3 py-1.5 text-center font-mono font-black text-emerald-800">{preview.incoming[key] ?? 0}</td>
                      <td className="px-3 py-1.5 text-center font-mono text-slate-500">{preview.current[key] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {preview.warnings.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Info size={13} />
                    <span>ملاحظات على البيانات (سيتم معالجتها تلقائياً):</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {preview.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <label className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 accent-rose-600"
                />
                <span>
                  <strong>أفهم أن جميع البيانات الحالية على هذا الجهاز سيتم استبدالها</strong> ببيانات الملف. (يحفظ البرنامج
                  تلقائياً نسخة من البيانات الحالية قبل الاستبدال.)
                </span>
              </label>

              <Button
                onClick={handleImport}
                disabled={!confirmed || isImporting}
                className="w-full py-2.5 rounded-2xl bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white text-xs font-bold cursor-pointer flex items-center justify-center gap-2"
              >
                {isImporting ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />}
                <span>{isImporting ? 'جاري نقل البيانات... لا تغلق البرنامج' : 'استيراد البيانات واستبدال الحالية'}</span>
              </Button>
            </div>
          )}

          {result && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-3">
              <div className="flex items-center gap-2 font-black text-sm text-emerald-900">
                <CircleCheck size={18} />
                <span>تم نقل البيانات بنجاح</span>
              </div>
              <div className="text-xs text-emerald-900">
                {result.imported.students} طالب، {result.imported.histories} سجل متابعة، {result.imported.sheikhs} حساب شيخ،{' '}
                {result.imported.settings} إعداد.
              </div>
              {result.warnings.length > 0 && (
                <ul className="list-disc list-inside text-[11px] text-amber-900 space-y-0.5">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
              {result.safetyBackupPath && (
                <div className="text-[11px] text-slate-600">
                  نسخة من البيانات السابقة محفوظة في:
                  <div className="font-mono mt-1 p-2 rounded-lg bg-white border border-slate-200 break-all" dir="ltr">
                    {result.safetyBackupPath}
                  </div>
                </div>
              )}
              <div className="text-xs text-emerald-900 font-bold">
                الحسابات الآن هي حسابات الجهاز القديم؛ سجّل الدخول باسم المستخدم وكلمة المرور المستخدمَين عليه.
              </div>
              <Button
                onClick={finishAndRelogin}
                className="w-full py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer flex items-center justify-center gap-2"
              >
                <LogIn size={15} />
                <span>تسجيل الدخول من جديد</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Guide for devices still on the old edition */}
      <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200/70 flex items-start gap-3">
        <Info size={18} className="text-sky-700 shrink-0 mt-0.5" />
        <div className="text-xs text-sky-950 space-y-1.5 leading-relaxed">
          <p className="font-bold">الجهاز القديم يعمل بإصدار سابق لا يحتوي على زر التصدير؟</p>
          <ol className="list-decimal list-inside space-y-0.5 text-sky-900/90 text-[11px]">
            <li>على الجهاز القديم: أغلق برنامج كُتّاب تماماً.</li>
            <li>
              اضغط <span className="font-mono font-bold">Win + R</span> واكتب{' '}
              <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-sky-200" dir="ltr">%APPDATA%\Kittab</span>{' '}
              ثم اضغط Enter.
            </li>
            <li>
              انسخ الملف <span className="font-mono font-bold" dir="ltr">kittab.db</span> وأرسله إلى هذا الجهاز (واتساب، بريد،
              فلاشة...).
            </li>
            <li>هنا: اختر هذا الملف من خانة «الاستيراد إلى هذا الجهاز» أعلاه.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
