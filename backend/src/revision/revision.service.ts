import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { dayBounds, markPresent, parseDay } from '../common/attendance.js';
import type { Caller } from '../sheikhs/auth.util.js';

export const DAILY_RESULTS = ['أتقن', 'لم يتقن'] as const;
export const EXAM_RESULTS = ['ممتاز', 'جيد جداً', 'جيد', 'مقبول', 'لم يجتز'] as const;

export interface RevisionInput {
  studentId?: number;
  date?: string;
  kind?: string;
  fromPart?: string | null;
  toPart?: string | null;
  amount?: number;
  fromJuz?: number | null;
  toJuz?: number | null;
  result?: string;
  notes?: string | null;
  /** Daily: the next assignment to store on the student. */
  nextFromPart?: string | null;
  nextToPart?: string | null;
  /** Exam: the juz the next exam starts from. */
  nextExamFromJuz?: number | null;
}

const juzOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 30) throw new BadRequestException('رقم الجزء يجب أن يكون بين 1 و30');
  return n;
};

@Injectable()
export class RevisionService {
  constructor(private readonly prisma: PrismaService) {}

  private day(v?: string) {
    try {
      return parseDay(v);
    } catch {
      throw new BadRequestException('التاريخ غير صحيح');
    }
  }

  async sessionsOn(dateStr?: string, kind?: string) {
    const { start, end } = dayBounds(this.day(dateStr));
    return this.prisma.revisionSession.findMany({
      where: { date: { gte: start, lte: end }, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: 'asc' },
    });
  }

  forStudent(studentId: number) {
    return this.prisma.revisionSession.findMany({ where: { studentId }, orderBy: { date: 'desc' } });
  }

  /** Records (or corrects) today's daily revision or exam result and moves the student's plan forward. */
  async save(input: RevisionInput, caller: Caller) {
    const kind = input.kind;
    if (kind !== 'daily' && kind !== 'exam') throw new BadRequestException('نوع المراجعة غير صحيح');
    const results: readonly string[] = kind === 'daily' ? DAILY_RESULTS : EXAM_RESULTS;
    if (!input.result || !results.includes(input.result)) throw new BadRequestException('يرجى اختيار نتيجة صحيحة');

    const studentId = Number(input.studentId);
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('الطالب غير موجود');
    if (student.status !== 'active') throw new BadRequestException('لا يمكن التسجيل لطالب مفصول.');

    const date = this.day(input.date);
    const fromJuz = juzOrNull(input.fromJuz);
    const toJuz = juzOrNull(input.toJuz);
    if (kind === 'exam') {
      if (fromJuz === null || toJuz === null) throw new BadRequestException('يرجى تحديد أجزاء الاختبار');
    } else if (!input.fromPart) {
      throw new BadRequestException('يرجى تحديد مقدار المراجعة');
    }
    const amount =
      kind === 'exam'
        ? Math.abs(toJuz! - fromJuz!) + 1
        : Math.max(0, Number(input.amount) || 0);

    const data = {
      fromPart: kind === 'daily' ? input.fromPart || null : null,
      toPart: kind === 'daily' ? input.toPart || input.fromPart || null : null,
      fromJuz: kind === 'exam' ? fromJuz : null,
      toJuz: kind === 'exam' ? toJuz : null,
      amount,
      result: input.result,
      notes: input.notes?.trim() || null,
      sheikhId: caller.id,
      sheikhName: caller.name,
    };

    const { start, end } = dayBounds(date);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.revisionSession.findFirst({
        where: { studentId, kind, date: { gte: start, lte: end } },
      });
      const session = existing
        ? await tx.revisionSession.update({ where: { id: existing.id }, data })
        : await tx.revisionSession.create({ data: { studentId, date, kind, ...data } });

      if (kind === 'daily' && input.nextFromPart) {
        await tx.student.update({
          where: { id: studentId },
          data: { currentRevisionFrom: input.nextFromPart, currentRevisionTo: input.nextToPart || input.nextFromPart },
        });
      }
      if (kind === 'exam' && input.nextExamFromJuz !== undefined) {
        await tx.student.update({ where: { id: studentId }, data: { examNextFromJuz: juzOrNull(input.nextExamFromJuz) } });
      }
      await markPresent(tx, studentId, date, caller);
      return session;
    });
  }

  /** Removes a recorded result and puts the student's plan back to what that session was assigned. */
  async remove(id: number) {
    const s = await this.prisma.revisionSession.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('التسجيل غير موجود');
    await this.prisma.$transaction(async (tx) => {
      await tx.revisionSession.delete({ where: { id } });
      if (s.kind === 'daily' && s.fromPart) {
        await tx.student.update({
          where: { id: s.studentId },
          data: { currentRevisionFrom: s.fromPart, currentRevisionTo: s.toPart || s.fromPart },
        });
      } else if (s.kind === 'exam' && s.fromJuz) {
        await tx.student.update({ where: { id: s.studentId }, data: { examNextFromJuz: s.fromJuz } });
      }
    });
    return { success: true };
  }
}
