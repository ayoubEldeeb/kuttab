import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Caller } from '../sheikhs/auth.util.js';
import {
  DISCIPLINE_KINDS,
  type DisciplineKind,
  type DisciplineSettings,
  type DisciplineState,
  computeDisciplineState,
  readDisciplineSettings,
} from './discipline.logic.js';

const ABSENT = 'لم يحضر';

/**
 * An absence counts from the later of its day and the moment it was recorded,
 * so an absence entered late (after a decision) is still taken into account.
 */
const effectiveDate = (a: { date: Date; updatedAt: Date }) => (a.updatedAt > a.date ? a.updatedAt : a.date);

@Injectable()
export class DisciplineService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<DisciplineSettings> {
    const rows = await this.prisma.systemSetting.findMany({ where: { key: { startsWith: 'discipline' } } });
    const raw: Record<string, unknown> = {};
    for (const r of rows) {
      try {
        raw[r.key] = JSON.parse(r.value);
      } catch {
        raw[r.key] = r.value;
      }
    }
    return readDisciplineSettings(raw);
  }

  async stateFor(studentId: number, settings?: DisciplineSettings): Promise<DisciplineState> {
    const student = await this.prisma.student.findUnique({ where: { id: studentId }, select: { status: true } });
    if (!student) throw new NotFoundException('الطالب غير موجود');
    const [absences, actions] = await Promise.all([
      this.prisma.history.findMany({
        where: { studentId, status: ABSENT, excused: false },
        select: { date: true, updatedAt: true },
      }),
      this.prisma.disciplineAction.findMany({ where: { studentId }, select: { kind: true, date: true } }),
    ]);
    return computeDisciplineState({
      status: student.status,
      absences: absences.map(effectiveDate),
      actions,
      settings: settings ?? (await this.getSettings()),
    });
  }

  async detailsFor(studentId: number) {
    const [state, actions] = await Promise.all([
      this.stateFor(studentId),
      this.prisma.disciplineAction.findMany({ where: { studentId }, orderBy: { date: 'desc' } }),
    ]);
    return { ...state, actions };
  }

  /** Every active student who currently needs a decision. */
  async alerts() {
    const settings = await this.getSettings();
    if (!settings.enabled) return [];
    const [students, absences, actions] = await Promise.all([
      this.prisma.student.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          name: true,
          serialNumber: true,
          period: true,
          guardianPhone: true,
          halaqa: { select: { id: true, name: true } },
        },
      }),
      this.prisma.history.findMany({
        where: { status: ABSENT, excused: false, student: { status: 'active' } },
        select: { studentId: true, date: true, updatedAt: true },
      }),
      this.prisma.disciplineAction.findMany({ select: { studentId: true, kind: true, date: true } }),
    ]);
    const group = <T extends { studentId: number }>(rows: T[]) => {
      const m = new Map<number, T[]>();
      for (const r of rows) m.set(r.studentId, [...(m.get(r.studentId) ?? []), r]);
      return m;
    };
    const absBy = group(absences);
    const actBy = group(actions);

    return students
      .map((s) => ({
        student: s,
        state: computeDisciplineState({
          status: 'active',
          absences: (absBy.get(s.id) ?? []).map(effectiveDate),
          actions: actBy.get(s.id) ?? [],
          settings,
        }),
      }))
      .filter((x) => x.state.alert)
      .sort((a, b) => (b.state.alert!.suggestion === 'dismissal' ? 1 : 0) - (a.state.alert!.suggestion === 'dismissal' ? 1 : 0));
  }

  async act(studentId: number, body: { kind?: string; reason?: string }, caller: Caller) {
    const kind = body.kind as DisciplineKind;
    if (!DISCIPLINE_KINDS.includes(kind)) throw new BadRequestException('نوع الإجراء غير صحيح');
    if ((kind === 'dismissal' || kind === 'reinstatement') && !caller.isAdmin) {
      throw new BadRequestException('فصل الطالب أو إعادته متاح للمشرف العام فقط.');
    }

    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('الطالب غير موجود');
    if (kind === 'reinstatement' && student.status !== 'dismissed') {
      throw new BadRequestException('الطالب غير مفصول.');
    }
    if (kind !== 'reinstatement' && student.status === 'dismissed') {
      throw new BadRequestException('الطالب مفصول؛ أعده أولاً قبل أي إجراء آخر.');
    }

    const before = await this.stateFor(studentId);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.disciplineAction.create({
        data: {
          studentId,
          date: now,
          kind,
          absenceCount: before.unexcusedAbsences,
          reason: body.reason?.trim() || null,
          byId: caller.id,
          byName: caller.name,
        },
      });
      if (kind === 'dismissal') {
        await tx.student.update({ where: { id: studentId }, data: { status: 'dismissed', dismissedAt: now } });
      } else if (kind === 'reinstatement') {
        await tx.student.update({ where: { id: studentId }, data: { status: 'active', dismissedAt: null } });
      }
    });
    return this.detailsFor(studentId);
  }

  /** Undoes a recorded decision (e.g. a warning given by mistake). */
  async removeAction(actionId: number) {
    const action = await this.prisma.disciplineAction.findUnique({ where: { id: actionId } });
    if (!action) throw new NotFoundException('الإجراء غير موجود');
    await this.prisma.$transaction(async (tx) => {
      await tx.disciplineAction.delete({ where: { id: actionId } });
      if (action.kind === 'dismissal' || action.kind === 'reinstatement') {
        // The latest remaining dismissal/reinstatement decides the status again.
        const last = await tx.disciplineAction.findFirst({
          where: { studentId: action.studentId, kind: { in: ['dismissal', 'reinstatement'] } },
          orderBy: { date: 'desc' },
        });
        const dismissed = last?.kind === 'dismissal';
        await tx.student.update({
          where: { id: action.studentId },
          data: { status: dismissed ? 'dismissed' : 'active', dismissedAt: dismissed ? last!.date : null },
        });
      }
    });
    return this.detailsFor(action.studentId);
  }
}
