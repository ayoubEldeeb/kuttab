import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { isPeriodId } from '../common/periods.js';

export interface HalaqaInput {
  name?: string;
  period?: string;
  sheikhId?: number | null;
  notes?: string | null;
}

export interface TransferInput {
  studentIds: number[];
  toPeriod: string | null;
  toHalaqaId?: number | null;
  reason?: string | null;
  date?: string;
}

@Injectable()
export class HalaqatService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const halaqat = await this.prisma.halaqa.findMany({
      orderBy: [{ period: 'asc' }, { name: 'asc' }],
      include: {
        sheikh: { select: { id: true, name: true, role: true } },
        _count: { select: { students: { where: { status: 'active' } } } },
      },
    });
    return halaqat.map(({ _count, ...h }) => ({ ...h, studentsCount: _count.students }));
  }

  async findOne(id: number) {
    const halaqa = await this.prisma.halaqa.findUnique({
      where: { id },
      include: {
        sheikh: { select: { id: true, name: true, role: true } },
        students: {
          where: { status: 'active' },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, serialNumber: true, currentReach: true, period: true },
        },
      },
    });
    if (!halaqa) throw new NotFoundException('الحلقة غير موجودة');
    return halaqa;
  }

  private async validate(input: HalaqaInput, partial: boolean) {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined || !partial) {
      const name = (input.name ?? '').trim();
      if (!name) throw new BadRequestException('يرجى كتابة اسم الحلقة');
      data.name = name;
    }
    if (input.period !== undefined || !partial) {
      if (!isPeriodId(input.period)) throw new BadRequestException('يرجى اختيار فترة الحلقة (العصر أو المغرب)');
      data.period = input.period;
    }
    if (input.sheikhId !== undefined) {
      if (input.sheikhId === null) {
        data.sheikhId = null;
      } else {
        const sheikh = await this.prisma.sheikh.findUnique({ where: { id: Number(input.sheikhId) } });
        if (!sheikh) throw new BadRequestException('الشيخ المختار غير موجود');
        data.sheikhId = sheikh.id;
      }
    }
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
    return data;
  }

  async create(input: HalaqaInput) {
    const data = await this.validate(input, false);
    return this.prisma.halaqa.create({ data: data as any });
  }

  /**
   * Updates a halaqa. Its students follow it: a new period moves them to that
   * period, and a new sheikh becomes their sheikh.
   */
  async update(id: number, input: HalaqaInput) {
    const existing = await this.prisma.halaqa.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('الحلقة غير موجودة');
    const data = await this.validate(input, true);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.halaqa.update({ where: { id }, data });
      const studentData: Record<string, unknown> = {};
      if (data.period !== undefined && data.period !== existing.period) studentData.period = data.period;
      if (data.sheikhId !== undefined && data.sheikhId !== existing.sheikhId) studentData.sheikhId = data.sheikhId;
      if (Object.keys(studentData).length) {
        await tx.student.updateMany({ where: { halaqaId: id }, data: studentData });
      }
      return updated;
    });
  }

  /** Deletes a halaqa; its students stay in the same period without a halaqa. */
  async remove(id: number) {
    const existing = await this.prisma.halaqa.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('الحلقة غير موجودة');
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.student.updateMany({ where: { halaqaId: id }, data: { halaqaId: null } });
      await tx.halaqa.delete({ where: { id } });
      return { success: true, unassignedStudents: count };
    });
  }

  /**
   * Moves students to a period and (optionally) a halaqa, logging every move.
   * A halaqa decides the period: choosing one in the other period is rejected.
   */
  async transfer(input: TransferInput, byName: string | null) {
    const ids = Array.isArray(input.studentIds) ? [...new Set(input.studentIds.map(Number))].filter((n) => n > 0) : [];
    if (!ids.length) throw new BadRequestException('لم يتم اختيار أي طالب');

    let toPeriod: string | null = input.toPeriod ?? null;
    let halaqa: { id: number; name: string; period: string; sheikhId: number | null } | null = null;
    if (input.toHalaqaId) {
      halaqa = await this.prisma.halaqa.findUnique({ where: { id: Number(input.toHalaqaId) } });
      if (!halaqa) throw new BadRequestException('الحلقة المختارة غير موجودة');
      if (toPeriod && toPeriod !== halaqa.period) {
        throw new BadRequestException('الحلقة المختارة ليست في الفترة المحددة');
      }
      toPeriod = halaqa.period;
    }
    if (toPeriod !== null && !isPeriodId(toPeriod)) throw new BadRequestException('الفترة غير صحيحة');

    const students = await this.prisma.student.findMany({
      where: { id: { in: ids } },
      include: { halaqa: { select: { id: true, name: true } } },
    });
    if (students.length !== ids.length) throw new BadRequestException('بعض الطلاب المختارين غير موجودين');

    const date = input.date ? new Date(input.date) : new Date();
    if (isNaN(date.getTime())) throw new BadRequestException('تاريخ النقل غير صحيح');
    const reason = input.reason?.trim() || null;

    let moved = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const s of students) {
        const newHalaqaId = halaqa?.id ?? null;
        if (s.period === toPeriod && s.halaqaId === newHalaqaId) continue;
        await tx.studentTransfer.create({
          data: {
            studentId: s.id,
            date,
            fromPeriod: s.period,
            toPeriod,
            fromHalaqaId: s.halaqaId,
            toHalaqaId: newHalaqaId,
            fromHalaqaName: s.halaqa?.name ?? null,
            toHalaqaName: halaqa?.name ?? null,
            reason,
            byName,
          },
        });
        await tx.student.update({
          where: { id: s.id },
          data: {
            period: toPeriod,
            halaqaId: newHalaqaId,
            // The halaqa's sheikh becomes the student's sheikh; without a halaqa the sheikh is kept.
            ...(halaqa?.sheikhId ? { sheikhId: halaqa.sheikhId } : {}),
          },
        });
        moved++;
      }
    });
    return { success: true, moved, unchanged: students.length - moved };
  }

  transfersOf(studentId: number) {
    return this.prisma.studentTransfer.findMany({ where: { studentId }, orderBy: { date: 'desc' } });
  }
}
