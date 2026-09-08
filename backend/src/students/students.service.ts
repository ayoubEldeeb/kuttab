import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  async create(data: { name: string; guardianName?: string; guardianPhone?: string; currentReach?: string }) {
    const count = await this.prisma.student.count();
    const serialNumber = `STU-${String(count + 1).padStart(4, '0')}`;
    
    return this.prisma.student.create({
      data: {
        ...data,
        serialNumber,
      },
    });
  }

  findAll(date?: string) {
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setUTCHours(23, 59, 59, 999);

      return this.prisma.student.findMany({
        orderBy: { name: 'asc' },
        include: {
          histories: {
            orderBy: { date: 'desc' },
            take: 5
          }
        }
      });
    }
    return this.prisma.student.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  findOne(id: number) {
    return this.prisma.student.findUnique({
      where: { id },
      include: { histories: { orderBy: { date: 'desc' } } }
    });
  }

  async addHistory(id: number, data: { status: string; notes?: string; date?: string; type?: string; fromPart?: string; toPart?: string; nextReviewDate?: string; nextReviewFrom?: string; nextReviewTo?: string; nextReviewNotes?: string; writtenParts?: string; }) {
    const targetDate = data.date ? new Date(data.date) : new Date();
    
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const updateData = {
      status: data.status,
      notes: data.notes,
      type: data.type,
      fromPart: data.fromPart,
      toPart: data.toPart,
      writtenParts: data.writtenParts,
      nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null,
      nextReviewFrom: data.nextReviewFrom,
      nextReviewTo: data.nextReviewTo,
      nextReviewNotes: data.nextReviewNotes,
    };

    const existing = await this.prisma.history.findFirst({
      where: {
        studentId: id,
        date: { gte: startOfDay, lte: endOfDay }
      }
    });

    if (data.type === 'تسميع' && data.toPart) {
      await this.prisma.student.update({
        where: { id },
        data: { currentReach: data.toPart }
      });
    }

    if (data.type === 'مراجعة' && data.nextReviewFrom && data.nextReviewTo) {
      await this.prisma.student.update({
        where: { id },
        data: { 
          currentRevisionFrom: data.nextReviewFrom,
          currentRevisionTo: data.nextReviewTo
        }
      });
    }

    if (existing) {
      Object.keys(updateData).forEach(key => {
        const k = key as keyof typeof updateData;
        if (updateData[k] === undefined) {
          delete updateData[k];
        }
      });
      
      return this.prisma.history.update({
        where: { id: existing.id },
        data: updateData
      });
    }

    return this.prisma.history.create({
      data: {
        studentId: id,
        date: targetDate,
        ...updateData
      },
    });
  }

  update(id: number, data: { name?: string; guardianName?: string; guardianPhone?: string; currentReach?: string; currentRevisionFrom?: string; currentRevisionTo?: string; }) {
    return this.prisma.student.update({
      where: { id },
      data
    });
  }
}
