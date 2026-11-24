/**
 * Kittab backup format and the normalization that turns any supported source
 * (a backup file exported by this version, or the raw SQLite database of an
 * older desktop edition) into one validated, self-consistent data set.
 *
 * Everything here is pure (no database access) so it can be unit tested.
 */

export const BACKUP_FORMAT = 'kittab-backup';
export const BACKUP_VERSION = 1;

export interface SheikhRow {
  id: number;
  name: string;
  username: string | null;
  password: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentRow {
  id: number;
  serialNumber: string;
  name: string;
  guardianName: string | null;
  guardianPhone: string | null;
  currentReach: string | null;
  currentRevisionFrom: string | null;
  currentRevisionTo: string | null;
  startReach: string | null;
  isKhatim: boolean;
  khatmahCount: number;
  sheikhId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HistoryRow {
  id: number;
  studentId: number;
  sheikhId: number | null;
  sheikhName: string | null;
  date: Date;
  type: string | null;
  fromPart: string | null;
  toPart: string | null;
  nextReviewDate: Date | null;
  nextReviewFrom: string | null;
  nextReviewTo: string | null;
  nextReviewNotes: string | null;
  status: string;
  notes: string | null;
  writtenParts: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettingRow {
  key: string;
  value: string;
  updatedAt: Date;
}

export interface BackupData {
  sheikhs: SheikhRow[];
  students: StudentRow[];
  histories: HistoryRow[];
  settings: SettingRow[];
}

export interface BackupCounts {
  sheikhs: number;
  students: number;
  histories: number;
  settings: number;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  app: string;
  counts: BackupCounts;
  data: BackupData;
}

/** Raw rows as read from a source: any column may be missing or loosely typed. */
export interface RawTables {
  sheikhs: Record<string, unknown>[];
  students: Record<string, unknown>[];
  histories: Record<string, unknown>[];
  settings: Record<string, unknown>[];
}

export interface NormalizeResult {
  data: BackupData;
  warnings: string[];
}

/** Thrown for problems the user must fix (wrong/corrupt file); message is Arabic, user-facing. */
export class BackupValidationError extends Error {}

// ---------------------------------------------------------------- primitives

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

function toNullableString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  return JSON.stringify(v);
}

function toNullableInt(v: unknown): number | null {
  if (isBlank(v)) return null;
  const n = typeof v === 'bigint' ? Number(v) : Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

function toBool(v: unknown, fallback: boolean): boolean {
  if (isBlank(v)) return fallback;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number' || typeof v === 'bigint') return Number(v) !== 0;
  const s = String(v).trim().toLowerCase();
  if (s === '1' || s === 'true') return true;
  if (s === '0' || s === 'false') return false;
  return fallback;
}

/**
 * Accepts every shape a date may take across editions:
 * a Date, epoch milliseconds (number or numeric string — how Prisma stores
 * DateTime in SQLite), an ISO string, or SQLite's CURRENT_TIMESTAMP text
 * ("YYYY-MM-DD HH:MM:SS", which is UTC).
 */
export function parseDate(v: unknown): Date | null {
  if (isBlank(v)) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number' || typeof v === 'bigint') {
    const d = new Date(Number(v));
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    // Seconds-precision epochs (10 digits) are promoted to milliseconds.
    const d = new Date(Math.abs(n) < 1e11 ? n * 1000 : n);
    return isNaN(d.getTime()) ? null : d;
  }
  const sqliteText = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(:\d{2}(\.\d+)?)?)$/.exec(s);
  const d = new Date(sqliteText ? `${sqliteText[1]}T${sqliteText[2]}Z` : s);
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------- normalize

/**
 * Validates and repairs a raw data set so that it can be inserted as-is:
 * unique keys, valid foreign keys, required fields present.
 * Repairs are reported as warnings; unrecoverable problems throw.
 */
export function normalizeTables(raw: RawTables, now: Date = new Date()): NormalizeResult {
  const warnings: string[] = [];
  const date = (v: unknown, fallback: Date) => parseDate(v) ?? fallback;

  // --- Sheikhs
  const sheikhs: SheikhRow[] = [];
  const sheikhIds = new Set<number>();
  const usernames = new Set<string>();
  let sheikhsFixedUsername = 0;
  let sheikhsSkipped = 0;
  for (const r of raw.sheikhs) {
    const id = toNullableInt(r.id);
    if (id === null || id <= 0 || sheikhIds.has(id)) {
      sheikhsSkipped++;
      continue;
    }
    let username = toNullableString(r.username)?.trim().toLowerCase() || null;
    if (!username || usernames.has(username)) {
      let candidate = id === 1 && !usernames.has('admin') ? 'admin' : `sheikh_${id}`;
      let suffix = 2;
      while (usernames.has(candidate)) candidate = `sheikh_${id}_${suffix++}`;
      username = candidate;
      sheikhsFixedUsername++;
    }
    usernames.add(username);
    sheikhIds.add(id);
    const createdAt = date(r.createdAt, now);
    sheikhs.push({
      id,
      name: toNullableString(r.name)?.trim() || `شيخ رقم ${id}`,
      username,
      password: toNullableString(r.password),
      phone: toNullableString(r.phone),
      role: toNullableString(r.role)?.trim() || 'محفظ',
      isActive: toBool(r.isActive, true),
      createdAt,
      updatedAt: date(r.updatedAt, createdAt),
    });
  }
  if (sheikhsSkipped) warnings.push(`تم تجاهل ${sheikhsSkipped} حساب شيخ بمعرّف غير صالح أو مكرر.`);
  if (sheikhsFixedUsername) {
    warnings.push(`${sheikhsFixedUsername} حساب شيخ بدون اسم مستخدم أو باسم مكرر، أُعطي اسم مستخدم تلقائي (مثل sheikh_5).`);
  }

  // --- Students
  const students: StudentRow[] = [];
  const studentIds = new Set<number>();
  const serials = new Set<string>();
  let studentsSkipped = 0;
  let studentsUnlinked = 0;
  let studentsSerialFixed = 0;
  for (const r of raw.students) {
    const id = toNullableInt(r.id);
    if (id === null || id <= 0 || studentIds.has(id)) {
      studentsSkipped++;
      continue;
    }
    let serialNumber = toNullableString(r.serialNumber)?.trim() || '';
    if (!serialNumber || serials.has(serialNumber)) {
      let candidate = `ST-${id}`;
      let suffix = 2;
      while (serials.has(candidate)) candidate = `ST-${id}-${suffix++}`;
      serialNumber = candidate;
      studentsSerialFixed++;
    }
    let sheikhId = toNullableInt(r.sheikhId);
    if (sheikhId !== null && !sheikhIds.has(sheikhId)) {
      sheikhId = null;
      studentsUnlinked++;
    }
    serials.add(serialNumber);
    studentIds.add(id);
    const createdAt = date(r.createdAt, now);
    const khatmahCount = Math.max(0, toNullableInt(r.khatmahCount) ?? 0);
    students.push({
      id,
      serialNumber,
      name: toNullableString(r.name)?.trim() || `طالب رقم ${id}`,
      guardianName: toNullableString(r.guardianName),
      guardianPhone: toNullableString(r.guardianPhone),
      currentReach: toNullableString(r.currentReach),
      currentRevisionFrom: toNullableString(r.currentRevisionFrom),
      currentRevisionTo: toNullableString(r.currentRevisionTo),
      startReach: toNullableString(r.startReach),
      isKhatim: toBool(r.isKhatim, false),
      khatmahCount,
      sheikhId,
      createdAt,
      updatedAt: date(r.updatedAt, createdAt),
    });
  }
  if (studentsSkipped) warnings.push(`تم تجاهل ${studentsSkipped} طالب بمعرّف غير صالح أو مكرر.`);
  if (studentsSerialFixed) warnings.push(`${studentsSerialFixed} طالب بدون رقم تسلسلي أو برقم مكرر، أُعطي رقم تلقائي.`);
  if (studentsUnlinked) warnings.push(`${studentsUnlinked} طالب مرتبط بشيخ غير موجود، تم فك الارتباط.`);

  // --- Histories
  const histories: HistoryRow[] = [];
  const historyIds = new Set<number>();
  let historiesOrphaned = 0;
  let historiesSkipped = 0;
  let historiesSheikhUnlinked = 0;
  for (const r of raw.histories) {
    const id = toNullableInt(r.id);
    if (id === null || id <= 0 || historyIds.has(id)) {
      historiesSkipped++;
      continue;
    }
    const studentId = toNullableInt(r.studentId);
    if (studentId === null || !studentIds.has(studentId)) {
      historiesOrphaned++;
      continue;
    }
    let sheikhId = toNullableInt(r.sheikhId);
    if (sheikhId !== null && !sheikhIds.has(sheikhId)) {
      sheikhId = null;
      historiesSheikhUnlinked++;
    }
    historyIds.add(id);
    const createdAt = date(r.createdAt, now);
    histories.push({
      id,
      studentId,
      sheikhId,
      sheikhName: toNullableString(r.sheikhName),
      date: date(r.date, createdAt),
      type: toNullableString(r.type),
      fromPart: toNullableString(r.fromPart),
      toPart: toNullableString(r.toPart),
      nextReviewDate: parseDate(r.nextReviewDate),
      nextReviewFrom: toNullableString(r.nextReviewFrom),
      nextReviewTo: toNullableString(r.nextReviewTo),
      nextReviewNotes: toNullableString(r.nextReviewNotes),
      status: toNullableString(r.status)?.trim() || 'غير محدد',
      notes: toNullableString(r.notes),
      writtenParts: toNullableString(r.writtenParts),
      createdAt,
      updatedAt: date(r.updatedAt, createdAt),
    });
  }
  if (historiesSkipped) warnings.push(`تم تجاهل ${historiesSkipped} سجل متابعة بمعرّف غير صالح أو مكرر.`);
  if (historiesOrphaned) warnings.push(`تم تجاهل ${historiesOrphaned} سجل متابعة لطالب غير موجود.`);
  if (historiesSheikhUnlinked) {
    warnings.push(`${historiesSheikhUnlinked} سجل متابعة مرتبط بشيخ غير موجود، حُفظ اسم الشيخ وفُك الارتباط.`);
  }

  // --- Settings (key is the identity; numeric ids are not preserved)
  const settingsByKey = new Map<string, SettingRow>();
  for (const r of raw.settings) {
    const key = toNullableString(r.key)?.trim();
    if (!key) continue;
    settingsByKey.set(key, {
      key,
      value: toNullableString(r.value) ?? '',
      updatedAt: date(r.updatedAt, now),
    });
  }

  const data: BackupData = { sheikhs, students, histories, settings: [...settingsByKey.values()] };

  if (!data.sheikhs.length && !data.students.length && !data.histories.length) {
    throw new BackupValidationError('الملف لا يحتوي على أي بيانات (لا مشايخ ولا طلاب ولا سجلات).');
  }

  const hasActiveAdmin = data.sheikhs.some(
    (s) => s.isActive && (s.role === 'مشرف عام' || s.username === 'admin'),
  );
  if (data.sheikhs.length && !hasActiveAdmin) {
    warnings.push('لا يوجد حساب «مشرف عام» نشط في البيانات المستوردة؛ لن تتمكن من إدارة الحسابات بعد الاستيراد.');
  }

  return { data, warnings };
}

export function countsOf(data: BackupData): BackupCounts {
  return {
    sheikhs: data.sheikhs.length,
    students: data.students.length,
    histories: data.histories.length,
    settings: data.settings.length,
  };
}

export function buildBackupFile(data: BackupData, exportedAt: Date = new Date()): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    app: 'نظام كُتّاب',
    counts: countsOf(data),
    data,
  };
}

/** Parses the JSON text of a backup file into raw tables, checking its envelope. */
export function parseBackupJson(text: string): { raw: RawTables; exportedAt: string | null } {
  let parsed: any;
  try {
    // Strip a UTF-8 BOM some editors add when the file is re-saved.
    parsed = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new BackupValidationError('الملف تالف أو ليس ملف نسخة احتياطية صالح (تعذرت قراءة محتواه).');
  }
  if (!parsed || typeof parsed !== 'object' || parsed.format !== BACKUP_FORMAT) {
    throw new BackupValidationError('هذا الملف ليس نسخة احتياطية من نظام كُتّاب.');
  }
  if (typeof parsed.version !== 'number' || parsed.version > BACKUP_VERSION) {
    throw new BackupValidationError(
      'هذه النسخة الاحتياطية صادرة من إصدار أحدث من البرنامج. يرجى تحديث البرنامج على هذا الجهاز أولاً.',
    );
  }
  const d = parsed.data;
  if (!d || typeof d !== 'object') {
    throw new BackupValidationError('ملف النسخة الاحتياطية لا يحتوي على قسم البيانات.');
  }
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  return {
    raw: {
      sheikhs: arr(d.sheikhs),
      students: arr(d.students),
      histories: arr(d.histories),
      settings: arr(d.settings),
    },
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
  };
}

const SQLITE_MAGIC = 'SQLite format 3\u0000';

export function isSqliteFile(buf: Buffer): boolean {
  return buf.length >= 16 && buf.subarray(0, 16).toString('latin1') === SQLITE_MAGIC;
}
