import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { markPresent, parseDay } from '../common/attendance.js';
import { describeSegments, measurePortion, surahName, type PortionSegment } from '../quran/quran-metrics.js';
import type { Caller } from '../sheikhs/auth.util.js';

export const PORTION_STATUSES = ['جاري', 'أتقن', 'لم يتقن'] as const;

export interface PortionInput {
  date?: string;
  segments?: unknown;
  status?: string;
  notes?: string | null;
  /** Update the student's "current reach" to the end of this portion (default true). */
  updateReach?: boolean;
}

function day(value: string | undefined) {
  try {
    return parseDay(value);
  } catch {
    throw new BadRequestException('التاريخ غير صحيح');
  }
}

function decorate<T extends { segments: string }>(p: T) {
  let segments: PortionSegment[] = [];
  try {
    segments = JSON.parse(p.segments);
  } catch {}
  return { ...p, segments, description: describeSegments(segments) };
}

@Injectable()
export class PortionsService {
  constructor(private readonly prisma: PrismaService) {}

  private measure(segments: unknown) {
    const m = measurePortion(segments);
    if (m.errors.length) throw new BadRequestException(m.errors.join(' '));
    return m;
  }

  async listRange(fromStr?: string, toStr?: string) {
    const from = day(fromStr);
    const to = day(toStr ?? fromStr);
    to.setUTCHours(23, 59, 59, 999);
    const rows = await this.prisma.memorizationPortion.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });
    return rows.map(decorate);
  }

  async forStudent(studentId: number) {
    const rows = await this.prisma.memorizationPortion.findMany({ where: { studentId }, orderBy: { date: 'desc' } });
    const totals = rows.reduce(
      (t, r) => ({ ayahCount: t.ayahCount + r.ayahCount, thumnAmount: t.thumnAmount + r.thumnAmount }),
      { ayahCount: 0, thumnAmount: 0 },
    );
    return {
      portions: rows.map(decorate),
      totals: { ...totals, thumnAmount: Math.round(totals.thumnAmount * 100) / 100, count: rows.length },
    };
  }

  /** Totals per student between two dates (used for month-to-date figures and reports). */
  async summary(fromStr?: string, toStr?: string) {
    const from = day(fromStr);
    const to = day(toStr ?? fromStr);
    to.setUTCHours(23, 59, 59, 999);
    const grouped = await this.prisma.memorizationPortion.groupBy({
      by: ['studentId'],
      where: { date: { gte: from, lte: to } },
      _sum: { ayahCount: true, thumnAmount: true },
      _count: { _all: true },
    });
    return grouped.map((g) => ({
      studentId: g.studentId,
      ayahCount: g._sum.ayahCount ?? 0,
      thumnAmount: Math.round((g._sum.thumnAmount ?? 0) * 100) / 100,
      portions: g._count._all,
    }));
  }

  async create(studentId: number, input: PortionInput, caller: Caller) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('الطالب غير موجود');
    if (student.status !== 'active') throw new BadRequestException('لا يمكن التسجيل لطالب مفصول.');
    const m = this.measure(input.segments);
    const status = input.status ?? 'جاري';
    if (!PORTION_STATUSES.includes(status as any)) throw new BadRequestException('حالة المقدار غير صحيحة');
    const date = day(input.date);

    const created = await this.prisma.$transaction(async (tx) => {
      const portion = await tx.memorizationPortion.create({
        data: {
          studentId,
          date,
          segments: JSON.stringify(m.segments),
          ayahCount: m.ayahCount,
          thumnAmount: m.thumnAmount,
          status,
          notes: input.notes?.trim() || null,
          sheikhId: caller.id,
          sheikhName: caller.name,
        },
      });
      if (input.updateReach !== false) {
        const last = m.segments[m.segments.length - 1];
        await tx.student.update({
          where: { id: studentId },
          data: { currentReach: `سورة ${surahName(last.surah)} - الآية ${last.toAyah}` },
        });
      }
      await markPresent(tx, studentId, date, caller);
      return portion;
    });
    return decorate(created);
  }

  async update(id: number, input: PortionInput) {
    const existing = await this.prisma.memorizationPortion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('المقدار غير موجود');
    const data: Record<string, unknown> = {};
    if (input.segments !== undefined) {
      const m = this.measure(input.segments);
      data.segments = JSON.stringify(m.segments);
      data.ayahCount = m.ayahCount;
      data.thumnAmount = m.thumnAmount;
    }
    if (input.status !== undefined) {
      if (!PORTION_STATUSES.includes(input.status as any)) throw new BadRequestException('حالة المقدار غير صحيحة');
      data.status = input.status;
    }
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
    if (input.date !== undefined) data.date = day(input.date);
    return decorate(await this.prisma.memorizationPortion.update({ where: { id }, data }));
  }

  async remove(id: number) {
    const existing = await this.prisma.memorizationPortion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('المقدار غير موجود');
    await this.prisma.memorizationPortion.delete({ where: { id } });
    return { success: true };
  }
}
