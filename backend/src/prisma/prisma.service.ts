import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Makes a hosted Postgres URL safe to hand to Prisma at runtime:
 * behind a transaction pooler prepared statements must be off, and
 * channel_binding is a libpq-only parameter the query engine rejects.
 */
function normalizeDatabaseUrl(url: string): string {
  if (!url.startsWith('postgres')) return url;
  try {
    const u = new URL(url);
    u.searchParams.delete('channel_binding');
    if (u.hostname.includes('-pooler.') || u.port === '6543') {
      u.searchParams.set('pgbouncer', 'true');
    }
    return u.toString();
  } catch {
    return url;
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const dbUrl = process.env.DATABASE_URL
      ? normalizeDatabaseUrl(process.env.DATABASE_URL)
      : undefined;
    super({
      datasources: dbUrl
        ? {
            db: {
              url: dbUrl,
            },
          }
        : undefined,
      log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    try {
      const url = process.env.DATABASE_URL || '';
      // never log credentials
      this.logger.log(
        `Connecting to database: ${url.startsWith('postgres') ? new URL(url).hostname : url || 'default'}`,
      );
      await this.$connect();
      this.logger.log('Database connected successfully.');

      // Self-healing schema for SQLite: ensure all required tables and indexes exist
      if (!url || url.startsWith('file:')) {
        await this.ensureSchema();
      }
    } catch (error) {
      this.logger.error('Failed to connect to database or initialize schema:', error);
      throw error;
    }
  }

  /** Adds a column to an existing SQLite table only when it is missing. */
  private async ensureColumn(table: string, column: string, definition: string) {
    const cols = await this.$queryRawUnsafe<{ name: string }[]>(`SELECT name FROM pragma_table_info('${table}')`);
    if (!cols.some((c) => c.name === column)) {
      await this.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition};`);
      this.logger.log(`Added column ${table}.${column}`);
    }
  }

  private async ensureSchema() {
    try {
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Student" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "serialNumber" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "guardianName" TEXT,
          "guardianPhone" TEXT,
          "currentReach" TEXT,
          "currentRevisionFrom" TEXT,
          "currentRevisionTo" TEXT,
          "startReach" TEXT,
          "isKhatim" BOOLEAN NOT NULL DEFAULT 0,
          "khatmahCount" INTEGER NOT NULL DEFAULT 0,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Columns added after the first desktop release; existing databases get them on startup.
      await this.ensureColumn('Student', 'startReach', 'TEXT');
      await this.ensureColumn('Student', 'isKhatim', 'BOOLEAN NOT NULL DEFAULT 0');
      await this.ensureColumn('Student', 'khatmahCount', 'INTEGER NOT NULL DEFAULT 0');
      await this.ensureColumn('Student', 'sheikhId', 'INTEGER');
      await this.ensureColumn('Student', 'period', 'TEXT');
      await this.ensureColumn('Student', 'halaqaId', 'INTEGER');
      await this.ensureColumn('Student', 'status', "TEXT NOT NULL DEFAULT 'active'");
      await this.ensureColumn('Student', 'dismissedAt', 'DATETIME');
      await this.ensureColumn('Student', 'dailyRevisionAmount', 'INTEGER NOT NULL DEFAULT 4');
      await this.ensureColumn('Student', 'examRevisionJuz', 'INTEGER NOT NULL DEFAULT 3');
      await this.ensureColumn('Student', 'examNextFromJuz', 'INTEGER');

      await this.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "Student_serialNumber_key" ON "Student"("serialNumber");
      `);

      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Sheikh" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "name" TEXT NOT NULL,
          "phone" TEXT,
          "role" TEXT NOT NULL DEFAULT 'محفظ',
          "isActive" BOOLEAN NOT NULL DEFAULT 1,
          "password" TEXT,
          "username" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "Sheikh_username_key" ON "Sheikh"("username");
      `);

      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SystemSetting" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "key" TEXT NOT NULL,
          "value" TEXT NOT NULL,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "SystemSetting_key_key" ON "SystemSetting"("key");
      `);

      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "History" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "studentId" INTEGER NOT NULL,
          "sheikhId" INTEGER,
          "sheikhName" TEXT,
          "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "type" TEXT,
          "fromPart" TEXT,
          "toPart" TEXT,
          "nextReviewDate" DATETIME,
          "nextReviewFrom" TEXT,
          "nextReviewTo" TEXT,
          "nextReviewNotes" TEXT,
          "status" TEXT NOT NULL,
          "notes" TEXT,
          "writtenParts" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "History_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
          CONSTRAINT "History_sheikhId_fkey" FOREIGN KEY ("sheikhId") REFERENCES "Sheikh" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        );
      `);
      await this.ensureColumn('History', 'excused', 'BOOLEAN NOT NULL DEFAULT 0');

      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Halaqa" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "name" TEXT NOT NULL,
          "period" TEXT NOT NULL,
          "sheikhId" INTEGER,
          "notes" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Halaqa_sheikhId_fkey" FOREIGN KEY ("sheikhId") REFERENCES "Sheikh" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        );
      `);

      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "StudentTransfer" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "studentId" INTEGER NOT NULL,
          "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "fromPeriod" TEXT,
          "toPeriod" TEXT,
          "fromHalaqaId" INTEGER,
          "toHalaqaId" INTEGER,
          "fromHalaqaName" TEXT,
          "toHalaqaName" TEXT,
          "reason" TEXT,
          "byName" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "StudentTransfer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
        );
      `);

      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "DisciplineAction" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "studentId" INTEGER NOT NULL,
          "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "kind" TEXT NOT NULL,
          "absenceCount" INTEGER NOT NULL DEFAULT 0,
          "reason" TEXT,
          "byId" INTEGER,
          "byName" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "DisciplineAction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
        );
      `);

      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "MemorizationPortion" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "studentId" INTEGER NOT NULL,
          "date" DATETIME NOT NULL,
          "segments" TEXT NOT NULL,
          "ayahCount" INTEGER NOT NULL DEFAULT 0,
          "thumnAmount" REAL NOT NULL DEFAULT 0,
          "status" TEXT NOT NULL DEFAULT 'جاري',
          "notes" TEXT,
          "sheikhId" INTEGER,
          "sheikhName" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "MemorizationPortion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
        );
      `);

      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "RevisionSession" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "studentId" INTEGER NOT NULL,
          "date" DATETIME NOT NULL,
          "kind" TEXT NOT NULL,
          "fromPart" TEXT,
          "toPart" TEXT,
          "amount" REAL NOT NULL DEFAULT 0,
          "fromJuz" INTEGER,
          "toJuz" INTEGER,
          "result" TEXT NOT NULL,
          "notes" TEXT,
          "sheikhId" INTEGER,
          "sheikhName" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "RevisionSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
        );
      `);

      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "History_studentId_date_idx" ON "History"("studentId", "date");`);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MemorizationPortion_studentId_date_idx" ON "MemorizationPortion"("studentId", "date");`);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RevisionSession_date_kind_idx" ON "RevisionSession"("date", "kind");`);
      await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DisciplineAction_studentId_idx" ON "DisciplineAction"("studentId");`);

      this.logger.log('Database schema verified/initialized successfully.');
    } catch (err: any) {
      this.logger.warn(`Schema verification warning: ${err?.message || err}`);
    }
  }
}
