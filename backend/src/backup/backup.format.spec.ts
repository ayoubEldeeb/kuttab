import {
  BACKUP_FORMAT,
  BackupValidationError,
  buildBackupFile,
  emptyRaw,
  isSqliteFile,
  normalizeTables,
  parseBackupJson,
  parseDate,
  type RawTables,
} from './backup.format.js';

const NOW = new Date('2026-11-24T10:00:00.000Z');

function raw(partial: Partial<RawTables>): RawTables {
  return { ...emptyRaw(), ...partial };
}

describe('parseDate', () => {
  it('reads Prisma SQLite epoch milliseconds (number and text)', () => {
    expect(parseDate(1788739345186)?.toISOString()).toBe('2026-09-07T00:02:25.186Z');
    expect(parseDate('1788739345186')?.toISOString()).toBe('2026-09-07T00:02:25.186Z');
  });

  it('reads SQLite CURRENT_TIMESTAMP text as UTC', () => {
    expect(parseDate('2026-09-16 08:30:00')?.toISOString()).toBe('2026-09-16T08:30:00.000Z');
  });

  it('reads ISO strings and epoch seconds', () => {
    expect(parseDate('2026-09-16T08:30:00.000Z')?.toISOString()).toBe('2026-09-16T08:30:00.000Z');
    expect(parseDate('1788739345')?.toISOString()).toBe('2026-09-07T00:02:25.000Z');
  });

  it('returns null for blanks and garbage', () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate('not a date')).toBeNull();
  });
});

describe('normalizeTables', () => {
  it('fills columns that older editions did not have with defaults', () => {
    const { data, warnings } = normalizeTables(
      raw({
        sheikhs: [{ id: '1', name: 'المشرف', username: 'admin', password: 'x', role: 'مشرف عام', isActive: '1' }],
        students: [{ id: '1', serialNumber: '001', name: 'أحمد', createdAt: '1788739324379', updatedAt: '1788739324379' }],
      }),
      NOW,
    );
    expect(data.students[0]).toMatchObject({
      id: 1,
      serialNumber: '001',
      startReach: null,
      isKhatim: false,
      khatmahCount: 0,
      sheikhId: null,
    });
    expect(data.students[0].createdAt.getTime()).toBe(1788739324379);
    expect(data.sheikhs[0].isActive).toBe(true);
    expect(warnings).toEqual([]);
  });

  it('keeps ids and relations exactly', () => {
    const { data } = normalizeTables(
      raw({
        sheikhs: [{ id: 7, name: 'ش', username: 'abc', password: 'p', role: 'مشرف عام' }],
        students: [{ id: 42, serialNumber: 'A', name: 'ط', sheikhId: 7 }],
        histories: [{ id: 900, studentId: 42, sheikhId: 7, status: 'حاضر', date: '1788739200000' }],
      }),
      NOW,
    );
    expect(data.students[0].sheikhId).toBe(7);
    expect(data.histories[0]).toMatchObject({ id: 900, studentId: 42, sheikhId: 7, status: 'حاضر' });
    expect(data.histories[0].date.getTime()).toBe(1788739200000);
  });

  it('drops orphan history rows and unlinks missing sheikhs, with warnings', () => {
    const { data, warnings } = normalizeTables(
      raw({
        sheikhs: [{ id: 1, name: 'ش', username: 'admin', password: 'p', role: 'مشرف عام' }],
        students: [{ id: 1, serialNumber: 'A', name: 'ط', sheikhId: 99 }],
        histories: [
          { id: 1, studentId: 1, sheikhId: 99, sheikhName: 'قديم', status: 'حاضر' },
          { id: 2, studentId: 55, status: 'حاضر' },
        ],
      }),
      NOW,
    );
    expect(data.students[0].sheikhId).toBeNull();
    expect(data.histories).toHaveLength(1);
    expect(data.histories[0]).toMatchObject({ sheikhId: null, sheikhName: 'قديم' });
    expect(warnings.join('\n')).toContain('لطالب غير موجود');
  });

  it('repairs duplicate usernames and serial numbers instead of failing the insert', () => {
    const { data, warnings } = normalizeTables(
      raw({
        sheikhs: [
          { id: 1, name: 'أ', username: 'Admin', password: 'p', role: 'مشرف عام' },
          { id: 2, name: 'ب', username: 'admin', password: 'p' },
          { id: 3, name: 'ج', username: null, password: 'p' },
        ],
        students: [
          { id: 1, serialNumber: 'S1', name: 'أ' },
          { id: 2, serialNumber: 'S1', name: 'ب' },
        ],
      }),
      NOW,
    );
    expect(data.sheikhs.map((s) => s.username)).toEqual(['admin', 'sheikh_2', 'sheikh_3']);
    expect(data.students.map((s) => s.serialNumber)).toEqual(['S1', 'ST-2']);
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('skips rows with invalid or duplicate ids', () => {
    const { data } = normalizeTables(
      raw({ students: [{ id: 'x', name: 'a' }, { id: 1, name: 'b' }, { id: 1, name: 'c' }] }),
      NOW,
    );
    expect(data.students.map((s) => s.name)).toEqual(['b']);
  });

  it('dedupes settings by key, last one wins', () => {
    const { data } = normalizeTables(
      raw({
        students: [{ id: 1, name: 'a', serialNumber: '1' }],
        settings: [
          { key: 'theme', value: 'navy' },
          { key: 'theme', value: 'dark' },
          { key: '', value: 'ignored' },
        ],
      }),
      NOW,
    );
    expect(data.settings).toEqual([{ key: 'theme', value: 'dark', updatedAt: NOW }]);
  });

  it('rejects an empty data set', () => {
    expect(() => normalizeTables(raw({ settings: [{ key: 'a', value: 'b' }] }), NOW)).toThrow(BackupValidationError);
  });

  it('warns when no active general supervisor remains', () => {
    const { warnings } = normalizeTables(
      raw({ sheikhs: [{ id: 2, name: 'ش', username: 'teacher', password: 'p', role: 'محفظ' }] }),
      NOW,
    );
    expect(warnings.join('\n')).toContain('مشرف عام');
  });
});

describe('backup file round trip', () => {
  it('survives JSON serialization unchanged', () => {
    const { data } = normalizeTables(
      raw({
        sheikhs: [{ id: 1, name: 'ش', username: 'admin', password: 'salt:hash', role: 'مشرف عام', createdAt: 1, updatedAt: 2 }],
        students: [
          { id: 3, serialNumber: '003', name: 'ط', isKhatim: 1, khatmahCount: 2, sheikhId: 1, createdAt: 3, updatedAt: 4 },
        ],
        histories: [{ id: 5, studentId: 3, status: 'حاضر', date: 5, nextReviewDate: 6, createdAt: 7, updatedAt: 8 }],
        settings: [{ key: 'holidayDays', value: '["friday"]', updatedAt: 9 }],
      }),
      NOW,
    );
    const file = buildBackupFile(data, NOW);
    expect(file.format).toBe(BACKUP_FORMAT);
    expect(file.counts).toMatchObject({ sheikhs: 1, students: 1, histories: 1, settings: 1 });

    const text = JSON.stringify(file);
    const reparsed = normalizeTables(parseBackupJson(text).raw, NOW).data;
    expect(reparsed).toEqual(data);
  });

  it('accepts a BOM-prefixed file', () => {
    const file = buildBackupFile(
      normalizeTables(raw({ students: [{ id: 1, serialNumber: '1', name: 'a' }] }), NOW).data,
      NOW,
    );
    expect(() => parseBackupJson('﻿' + JSON.stringify(file))).not.toThrow();
  });

  it('rejects foreign JSON, corrupt text, and newer backup versions', () => {
    expect(() => parseBackupJson('{"hello":1}')).toThrow(BackupValidationError);
    expect(() => parseBackupJson('{oops')).toThrow(BackupValidationError);
    expect(() => parseBackupJson(JSON.stringify({ format: BACKUP_FORMAT, version: 99, data: {} }))).toThrow(
      /إصدار أحدث/,
    );
  });
});

describe('isSqliteFile', () => {
  it('detects the SQLite header', () => {
    expect(isSqliteFile(Buffer.from('SQLite format 3\u0000rest', 'latin1'))).toBe(true);
    expect(isSqliteFile(Buffer.from('{"format":"kittab-backup"}'))).toBe(false);
  });
});

describe('version 2 tables', () => {
  const base = {
    sheikhs: [{ id: 1, name: 'ش', username: 'admin', password: 'p', role: 'مشرف عام' }],
    halaqat: [
      { id: 1, name: 'حلقة الشيخ أحمد', period: 'asr', sheikhId: 1, notes: 'ملاحظة' },
      { id: 2, name: 'حلقة بلا شيخ', period: 'maghrib', sheikhId: 99 },
    ],
    students: [
      // halaqa decides the period even if the stored period disagrees
      { id: 1, serialNumber: 'A', name: 'أ', halaqaId: 1, period: 'maghrib', status: 'dismissed', dailyRevisionAmount: 6 },
      { id: 2, serialNumber: 'B', name: 'ب', halaqaId: 77, period: 'maghrib', dailyRevisionAmount: 999 },
    ],
    histories: [{ id: 1, studentId: 1, status: 'لم يحضر', excused: 1 }],
    transfers: [{ id: 1, studentId: 1, fromPeriod: 'maghrib', toPeriod: 'asr', toHalaqaId: 1 }],
    disciplineActions: [
      { id: 1, studentId: 1, kind: 'warning' },
      { id: 2, studentId: 1, kind: 'bogus' },
      { id: 3, studentId: 42, kind: 'warning' },
    ],
    portions: [{ id: 1, studentId: 2, segments: '[{"surah":78,"fromAyah":5,"toAyah":10}]', ayahCount: 6, thumnAmount: 0.4 }],
    revisionSessions: [
      { id: 1, studentId: 2, kind: 'daily', result: 'أتقن', fromPart: 'x' },
      { id: 2, studentId: 2, kind: 'exam', result: 'جيد', fromJuz: 28, toJuz: 30 },
      { id: 3, studentId: 2, kind: 'other', result: 'x' },
    ],
  };

  it('normalizes halaqat, student program fields and child records', () => {
    const { data, warnings } = normalizeTables(raw(base), NOW);
    expect(data.halaqat.map((h) => h.sheikhId)).toEqual([1, null]);
    expect(data.students[0]).toMatchObject({ halaqaId: 1, period: 'asr', status: 'dismissed', dailyRevisionAmount: 6 });
    expect(data.students[0].dismissedAt).toEqual(NOW);
    expect(data.students[1]).toMatchObject({ halaqaId: null, period: 'maghrib', status: 'active', dailyRevisionAmount: 4 });
    expect(data.histories[0].excused).toBe(true);
    expect(data.transfers).toHaveLength(1);
    expect(data.disciplineActions.map((a) => a.id)).toEqual([1]);
    expect(data.portions[0]).toMatchObject({ ayahCount: 6, status: 'جاري' });
    expect(data.revisionSessions.map((r) => r.kind)).toEqual(['daily', 'exam']);
    expect(warnings.join('\n')).toContain('لطالب غير موجود');
  });

  it('round-trips every table through a backup file', () => {
    const { data } = normalizeTables(raw(base), NOW);
    const reparsed = normalizeTables(parseBackupJson(JSON.stringify(buildBackupFile(data, NOW))).raw, NOW).data;
    expect(reparsed).toEqual(data);
  });

  it('still reads version 1 files (new tables empty)', () => {
    const v1 = { format: BACKUP_FORMAT, version: 1, data: { students: [{ id: 1, serialNumber: '1', name: 'a' }] } };
    const { data } = normalizeTables(parseBackupJson(JSON.stringify(v1)).raw, NOW);
    expect(data.students[0]).toMatchObject({ period: null, halaqaId: null, status: 'active', dailyRevisionAmount: 4, examRevisionJuz: 3 });
    expect(data.halaqat).toEqual([]);
    expect(data.portions).toEqual([]);
  });
});
