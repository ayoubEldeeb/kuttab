import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  async create(data: { name: string; guardianName?: string; guardianPhone?: string; currentReach?: string }) {
    // Generate Serial Number
    const count = await this.prisma.student.count();
    const serialNumber = `STU-${String(count + 1).padStart(4, '0')}`;
    
    return this.prisma.student.create({
      data: {
        ...data,
        serialNumber,
      },
    });
  }

  findAll() {
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

  async addHistory(id: number, data: { status: string; notes?: string; date?: string }) {
    return this.prisma.history.create({
      data: {
        studentId: id,
        status: data.status,
        notes: data.notes,
        date: data.date ? new Date(data.date) : new Date(),
      },
    });
  }
}
