import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export function dayBounds(date: Date) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

/** Parses a "YYYY-MM-DD" (or ISO) date; throws a user-facing message when invalid. */
export function parseDay(value: string | undefined, fallback = new Date()): Date {
  if (!value) return fallback;
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new Error('INVALID_DATE');
  return d;
}

/**
 * Recording memorization or revision for a student means he attended that day.
 * Creates a "present" record when the day has none, and turns an absence into
 * presence; an existing presence (with its recitation details) is left untouched.
 */
export async function markPresent(db: Db, studentId: number, date: Date, by?: { id?: number | null; name?: string | null }) {
  const { start, end } = dayBounds(date);
  const existing = await db.history.findFirst({ where: { studentId, date: { gte: start, lte: end } } });
  if (!existing) {
    await db.history.create({
      data: {
        studentId,
        date,
        status: 'حاضر',
        type: 'حضور',
        sheikhId: by?.id ?? null,
        sheikhName: by?.name ?? null,
      },
    });
  } else if (existing.status === 'لم يحضر') {
    await db.history.update({ where: { id: existing.id }, data: { status: 'حاضر', excused: false } });
  }
}
