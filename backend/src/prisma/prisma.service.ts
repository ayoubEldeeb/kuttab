import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const dbUrl = process.env.DATABASE_URL;
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
      this.logger.log(`Connecting to database at: ${process.env.DATABASE_URL || 'default'}`);
      await this.$connect();
      this.logger.log('Database connected successfully.');

      // Self-healing schema for SQLite: ensure all required tables and indexes exist
      const url = process.env.DATABASE_URL || '';
      if (!url || url.startsWith('file:')) {
        await this.ensureSchema();
      }
    } catch (error) {
      this.logger.error('Failed to connect to database or initialize schema:', error);
      throw error;
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
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

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
      this.logger.log('Database schema verified/initialized successfully.');
    } catch (err: any) {
      this.logger.warn(`Schema verification warning: ${err?.message || err}`);
    }
  }
}
