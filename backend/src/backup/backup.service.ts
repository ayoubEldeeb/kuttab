import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword } from '../sheikhs/password.util.js';
import {
  BackupCounts,
  BackupData,
  BackupFile,
  BackupValidationError,
  RawTables,
  buildBackupFile,
  countsOf,
  isSqliteFile,
  normalizeTables,
  parseBackupJson,
} from './backup.format.js';

export type BackupSourceKind = 'backup-file' | 'legacy-database';

export interface ImportPreview {
  sourceKind: BackupSourceKind;
  fileName: string;
  exportedAt: string | null;
  incoming: BackupCounts;
  current: BackupCounts;
  warnings: string[];
}

export interface ImportResult {
  imported: BackupCounts;
  safetyBackupPath: string | null;
  warnings: string[];
}

interface UploadedFile {
  originalname?: string;
  buffer?: Buffer;
  size?: number;
}

const DEFAULT_PASSWORD = '123456';
const CHUNK = 200;

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get isPostgres(): boolean {
    return (process.env.DATABASE_URL || '').startsWith('postgres');
  }

  /** Absolute path of the SQLite file in use, or null on Postgres. */
  getDatabaseFilePath(): string | null {
    if (this.isPostgres) return null;
    const url = process.env.DATABASE_URL || 'file:./dev.db';
    const p = url.replace(/^file:/, '').split('?')[0];
    // Prisma resolves relative SQLite paths against the schema directory.
    return path.isAbsolute(p) ? p : path.resolve(process.cwd(), 'prisma', p);
  }

  getSafetyBackupDir(): string {
    const dbFile = this.getDatabaseFilePath();
    return dbFile ? path.join(path.dirname(dbFile), 'backups') : path.join(os.tmpdir(), 'kittab-backups');
  }

  async getCurrentCounts(): Promise<BackupCounts> {
    const [sheikhs, students, histories, settings] = await Promise.all([
      this.prisma.sheikh.count(),
      this.prisma.student.count(),
      this.prisma.history.count(),
      this.prisma.systemSetting.count(),
    ]);
    return { sheikhs, students, histories, settings };
  }

  async getInfo() {
    return {
      counts: await this.getCurrentCounts(),
      databaseKind: this.isPostgres ? 'postgres' : 'sqlite',
      databasePath: this.getDatabaseFilePath(),
      safetyBackupDir: this.getSafetyBackupDir(),
    };
  }

  // ------------------------------------------------------------------ export

  async readCurrentData(): Promise<BackupData> {
    const [sheikhs, students, histories, settings] = await Promise.all([
      this.prisma.sheikh.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.student.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.history.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.systemSetting.findMany({ orderBy: { id: 'asc' } }),
    ]);
    return {
      sheikhs,
      students,
      histories,
      settings: settings.map(({ key, value, updatedAt }) => ({ key, value, updatedAt })),
    };
  }

  async exportBackup(): Promise<BackupFile> {
    return buildBackupFile(await this.readCurrentData());
  }

  // ------------------------------------------------------------------ import

  /** Reads and validates an uploaded file without touching the database. */
  async preview(file: UploadedFile | undefined): Promise<ImportPreview> {
    const parsed = await this.parseUpload(file);
    return {
      sourceKind: parsed.sourceKind,
      fileName: file?.originalname || '',
      exportedAt: parsed.exportedAt,
      incoming: countsOf(parsed.data),
      current: await this.getCurrentCounts(),
      warnings: parsed.warnings,
    };
  }

  /**
   * Replaces all data on this device with the uploaded data, in one
   * transaction. The current data is first saved to a safety backup file
   * that can be restored through the same import screen.
   */
  async importReplace(file: UploadedFile | undefined): Promise<ImportResult> {
    const parsed = await this.parseUpload(file);
    const warnings = [...parsed.warnings];
    const data = this.applyLoginDefaults(parsed.data, warnings);

    const safetyBackupPath = await this.writeSafetyBackup();

    await this.prisma.$transaction(
      async (tx) => {
        await tx.history.deleteMany();
        await tx.student.deleteMany();
        await tx.sheikh.deleteMany();
        await tx.systemSetting.deleteMany();

        for (let i = 0; i < data.sheikhs.length; i += CHUNK) {
          await tx.sheikh.createMany({ data: data.sheikhs.slice(i, i + CHUNK) });
        }
        for (let i = 0; i < data.students.length; i += CHUNK) {
          await tx.student.createMany({ data: data.students.slice(i, i + CHUNK) });
        }
        for (let i = 0; i < data.histories.length; i += CHUNK) {
          await tx.history.createMany({ data: data.histories.slice(i, i + CHUNK) });
        }
        for (let i = 0; i < data.settings.length; i += CHUNK) {
          await tx.systemSetting.createMany({ data: data.settings.slice(i, i + CHUNK) });
        }

        if (this.isPostgres) {
          // Explicit ids were inserted, so move each sequence past the max id.
          for (const table of ['Sheikh', 'Student', 'History', 'SystemSetting']) {
            await tx.$executeRawUnsafe(
              `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`,
            );
          }
        }

        const after = {
          sheikhs: await tx.sheikh.count(),
          students: await tx.student.count(),
          histories: await tx.history.count(),
          settings: await tx.systemSetting.count(),
        };
        const expected = countsOf(data);
        if (JSON.stringify(after) !== JSON.stringify(expected)) {
          // Throwing rolls the whole transaction back.
          throw new Error(`Imported row counts ${JSON.stringify(after)} differ from expected ${JSON.stringify(expected)}`);
        }
      },
      { maxWait: 30_000, timeout: 10 * 60_000 },
    );

    this.logger.log(`Import completed: ${JSON.stringify(countsOf(data))}; safety backup: ${safetyBackupPath ?? 'none'}`);
    return { imported: countsOf(data), safetyBackupPath, warnings };
  }

  /**
   * Makes sure every account can sign in after the move: accounts without a
   * password get the default one (same rule the app applies on startup), and
   * if there are no accounts at all the default admin is created.
   */
  private applyLoginDefaults(data: BackupData, warnings: string[]): BackupData {
    let withoutPassword = 0;
    const sheikhs = data.sheikhs.map((s) => {
      if (s.password) return s;
      withoutPassword++;
      return { ...s, password: hashPassword(DEFAULT_PASSWORD) };
    });
    if (withoutPassword) {
      warnings.push(`${withoutPassword} حساب بدون كلمة مرور، عُيّنت له كلمة المرور الافتراضية ${DEFAULT_PASSWORD}.`);
    }
    if (!sheikhs.length) {
      const now = new Date();
      sheikhs.push({
        id: 1,
        name: 'الشيخ المشرف العام',
        username: 'admin',
        password: hashPassword(DEFAULT_PASSWORD),
        phone: '',
        role: 'مشرف عام',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      warnings.push(`لا توجد حسابات مشايخ في الملف، أُنشئ حساب المشرف العام (admin / ${DEFAULT_PASSWORD}).`);
    }
    return { ...data, sheikhs };
  }

  private async writeSafetyBackup(): Promise<string | null> {
    const counts = await this.getCurrentCounts();
    if (!counts.sheikhs && !counts.students && !counts.histories) return null;
    const dir = this.getSafetyBackupDir();
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(dir, `kittab-before-import-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify(await this.exportBackup(), null, 2), 'utf8');
    return file;
  }

  // ------------------------------------------------------------------ parsing

  private async parseUpload(file: UploadedFile | undefined) {
    if (!file?.buffer || !file.buffer.length) {
      throw new BackupValidationError('لم يتم استلام أي ملف، أو أن الملف فارغ.');
    }

    let raw: RawTables;
    let exportedAt: string | null = null;
    let sourceKind: BackupSourceKind;

    if (isSqliteFile(file.buffer)) {
      sourceKind = 'legacy-database';
      raw = await this.readSqliteFile(file.buffer);
    } else {
      sourceKind = 'backup-file';
      const parsed = parseBackupJson(file.buffer.toString('utf8'));
      raw = parsed.raw;
      exportedAt = parsed.exportedAt;
    }

    const { data, warnings } = normalizeTables(raw);
    return { sourceKind, exportedAt, data, warnings };
  }

  /**
   * Reads the database file of any older desktop edition. Every column is
   * read as text so missing columns (older schema) and differing storage
   * formats never break the read; normalization takes it from there.
   */
  private async readSqliteFile(buffer: Buffer): Promise<RawTables> {
    if (this.isPostgres) {
      throw new BackupValidationError(
        'استيراد ملف قاعدة البيانات (kittab.db) متاح في نسخة سطح المكتب فقط. استخدم ملف النسخة الاحتياطية بدلاً منه.',
      );
    }

    const tmpFile = path.join(os.tmpdir(), `kittab-import-${randomUUID()}.db`);
    fs.writeFileSync(tmpFile, buffer);
    const client = new PrismaClient({
      datasources: { db: { url: `file:${tmpFile.replace(/\\/g, '/')}` } },
    });

    try {
      const tables = await client.$queryRawUnsafe<{ name: string }[]>(
        `SELECT name FROM sqlite_master WHERE type = 'table'`,
      );
      const names = new Set(tables.map((t) => t.name));
      if (!names.has('Student')) {
        throw new BackupValidationError('ملف قاعدة البيانات لا يحتوي على جدول الطلاب؛ تأكد أنه ملف kittab.db الخاص بالبرنامج.');
      }

      const readTable = async (table: string): Promise<Record<string, unknown>[]> => {
        if (!names.has(table)) return [];
        const cols = await client.$queryRawUnsafe<{ name: string }[]>(
          `SELECT name FROM pragma_table_info('${table}')`,
        );
        if (!cols.length) return [];
        const select = cols
          .map((c) => `CAST("${c.name.replace(/"/g, '""')}" AS TEXT) AS "${c.name.replace(/"/g, '""')}"`)
          .join(', ');
        return client.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT ${select} FROM "${table}"`);
      };

      return {
        sheikhs: await readTable('Sheikh'),
        students: await readTable('Student'),
        histories: await readTable('History'),
        settings: await readTable('SystemSetting'),
      };
    } catch (err) {
      if (err instanceof BackupValidationError) throw err;
      this.logger.error(`Failed to read uploaded database: ${(err as Error)?.message}`);
      throw new BackupValidationError('تعذرت قراءة ملف قاعدة البيانات؛ قد يكون الملف تالفاً أو منسوخاً أثناء تشغيل البرنامج.');
    } finally {
      await client.$disconnect().catch(() => {});
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
    }
  }
}
