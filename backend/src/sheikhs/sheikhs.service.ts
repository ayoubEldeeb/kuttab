import { Injectable, OnModuleInit, UnauthorizedException, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from './password.util.js';

@Injectable()
export class SheikhsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Seed default sheikh if none exist
    const count = await this.prisma.sheikh.count();
    if (count === 0) {
      await this.prisma.sheikh.create({
        data: {
          name: 'الشيخ المشرف العام',
          username: 'admin',
          password: hashPassword('123456'),
          phone: '',
          role: 'مشرف عام',
          isActive: true,
        },
      });
    } else {
      // Ensure existing sheikhs have usernames and passwords
      const sheikhsWithoutUsername = await this.prisma.sheikh.findMany({
        where: { username: null },
      });
      for (const s of sheikhsWithoutUsername) {
        const fallbackUsername = s.id === 1 ? 'admin' : `sheikh_${s.id}`;
        await this.prisma.sheikh.update({
          where: { id: s.id },
          data: {
            username: fallbackUsername,
            password: s.password || hashPassword('123456'),
          },
        });
      }
    }
  }

  async login(credentials: { username: string; password?: string }) {
    const rawUsername = credentials.username?.trim().toLowerCase();
    const rawPassword = credentials.password || '';

    if (!rawUsername) {
      throw new BadRequestException('يرجى إدخال اسم المستخدم');
    }

    const sheikh = await this.prisma.sheikh.findFirst({
      where: {
        username: rawUsername,
      },
    });

    if (!sheikh) {
      throw new UnauthorizedException('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    if (!sheikh.isActive) {
      throw new ForbiddenException('تم إيقاف هذا الحساب، يرجى مراجعة إدارة المركز');
    }

    const isValid = verifyPassword(rawPassword, sheikh.password);
    if (!isValid) {
      throw new UnauthorizedException('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    return {
      success: true,
      sheikh: {
        id: sheikh.id,
        name: sheikh.name,
        username: sheikh.username,
        phone: sheikh.phone,
        role: sheikh.role,
        isActive: sheikh.isActive,
      },
      token: `shk_${sheikh.id}_${Buffer.from(sheikh.username || 'user').toString('base64')}_${Date.now()}`,
    };
  }

  async getProfile(id: number) {
    const sheikh = await this.prisma.sheikh.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { histories: true },
        },
      },
    });

    if (!sheikh) {
      throw new NotFoundException('حساب الشيخ غير موجود');
    }

    return {
      id: sheikh.id,
      name: sheikh.name,
      username: sheikh.username,
      phone: sheikh.phone,
      role: sheikh.role,
      isActive: sheikh.isActive,
      recordedSessionsCount: sheikh._count.histories,
      createdAt: sheikh.createdAt,
      updatedAt: sheikh.updatedAt,
    };
  }

  async findAll() {
    const sheikhs = await this.prisma.sheikh.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { histories: true },
        },
      },
    });

    return sheikhs.map((s) => ({
      id: s.id,
      name: s.name,
      username: s.username,
      phone: s.phone,
      role: s.role,
      isActive: s.isActive,
      recordedSessionsCount: s._count.histories,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  async findOne(id: number) {
    const sheikh = await this.prisma.sheikh.findUnique({
      where: { id },
      include: {
        _count: {
          select: { histories: true },
        },
      },
    });

    if (!sheikh) return null;

    return {
      id: sheikh.id,
      name: sheikh.name,
      username: sheikh.username,
      phone: sheikh.phone,
      role: sheikh.role,
      isActive: sheikh.isActive,
      recordedSessionsCount: sheikh._count.histories,
      createdAt: sheikh.createdAt,
      updatedAt: sheikh.updatedAt,
    };
  }

  async create(data: { name: string; username?: string; password?: string; phone?: string; role?: string; isActive?: boolean }) {
    const cleanName = data.name.trim();
    const cleanUsername = (data.username?.trim().toLowerCase()) || `sheikh_${Date.now().toString().slice(-4)}`;

    // Check if username already taken
    const existing = await this.prisma.sheikh.findUnique({
      where: { username: cleanUsername },
    });
    if (existing) {
      throw new BadRequestException(`اسم المستخدم «${cleanUsername}» مستخدم بالفعل، يرجى اختيار اسم مستخدم آخر`);
    }

    const hashedPassword = hashPassword(data.password?.trim() || '123456');

    const created = await this.prisma.sheikh.create({
      data: {
        name: cleanName,
        username: cleanUsername,
        password: hashedPassword,
        phone: data.phone?.trim() || null,
        role: data.role || 'محفظ',
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    return {
      id: created.id,
      name: created.name,
      username: created.username,
      phone: created.phone,
      role: created.role,
      isActive: created.isActive,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async update(id: number, data: { name?: string; username?: string; password?: string; phone?: string; role?: string; isActive?: boolean }) {
    // If username is being updated, check uniqueness
    if (data.username !== undefined) {
      const cleanUsername = data.username.trim().toLowerCase();
      const existing = await this.prisma.sheikh.findUnique({
        where: { username: cleanUsername },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException(`اسم المستخدم «${cleanUsername}» مستخدم بالفعل بحساب آخر`);
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.username !== undefined) updateData.username = data.username.trim().toLowerCase();
    if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.password && data.password.trim() !== '') {
      updateData.password = hashPassword(data.password.trim());
    }

    const updated = await this.prisma.sheikh.update({
      where: { id },
      data: updateData,
    });

    return {
      id: updated.id,
      name: updated.name,
      username: updated.username,
      phone: updated.phone,
      role: updated.role,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async resetPassword(id: number) {
    const sheikh = await this.prisma.sheikh.findUnique({
      where: { id },
    });

    if (!sheikh) {
      throw new NotFoundException('حساب الشيخ غير موجود');
    }

    await this.prisma.sheikh.update({
      where: { id },
      data: {
        password: hashPassword('password123'),
      },
    });

    return {
      success: true,
      message: 'تمت إعادة تعيين كلمة المرور إلى password123 بنجاح',
      defaultPassword: 'password123',
    };
  }

  async remove(id: number) {
    // Check if sheikh has histories
    const sheikh = await this.prisma.sheikh.findUnique({
      where: { id },
      include: { _count: { select: { histories: true } } },
    });

    if (sheikh && sheikh._count.histories > 0) {
      // Instead of hard deletion which would break foreign keys, mark as inactive
      return this.prisma.sheikh.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.sheikh.delete({
      where: { id },
    });
  }
}
