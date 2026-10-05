import { Controller, Get, Post, Put, Delete, Body, Param, Headers, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { SheikhsService } from './sheikhs.service.js';

function extractSheikhId(authHeader?: string, headerId?: string): number | null {
  if (headerId) {
    const parsed = parseInt(headerId, 10);
    if (!isNaN(parsed)) return parsed;
  }
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    const parts = token.split('_');
    if (parts[0] === 'shk' && parts[1]) {
      const parsed = parseInt(parts[1], 10);
      if (!isNaN(parsed)) return parsed;
    }
  }
  return null;
}

@Controller('sheikhs')
export class SheikhsController {
  constructor(private readonly sheikhsService: SheikhsService) {}

  @Post('login')
  login(@Body() credentials: { username: string; password?: string }) {
    return this.sheikhsService.login(credentials);
  }

  @Get('me')
  async getMe(@Headers('authorization') authHeader?: string, @Headers('x-sheikh-id') headerId?: string) {
    const sheikhId = extractSheikhId(authHeader, headerId);

    if (!sheikhId) {
      throw new UnauthorizedException('يرجى تسجيل الدخول أولاً');
    }

    return this.sheikhsService.getProfile(sheikhId);
  }

  @Get()
  findAll() {
    return this.sheikhsService.findAll();
  }

  @Get('supervision/stats')
  getSupervisionStats() {
    return this.sheikhsService.getSupervisionStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sheikhsService.findOne(+id);
  }

  @Post()
  async create(
    @Body()
    data: {
      name: string;
      username?: string;
      password?: string;
      phone?: string;
      role?: string;
      isActive?: boolean;
    },
    @Headers('authorization') authHeader?: string,
    @Headers('x-sheikh-id') headerId?: string
  ) {
    const currentSheikhId = extractSheikhId(authHeader, headerId);
    if (currentSheikhId) {
      const caller = await this.sheikhsService.findOne(currentSheikhId);
      const isAdmin = caller?.role === 'مشرف عام' || caller?.username === 'admin';
      if (!isAdmin) {
        throw new ForbiddenException('فقط المشرف العام يملك صلاحية إضافة حسابات جديدة للمشايخ.');
      }
    }
    return this.sheikhsService.create(data);
  }

  @Post(':id/reset-password')
  async resetPassword(
    @Param('id') id: string,
    @Headers('authorization') authHeader?: string,
    @Headers('x-sheikh-id') headerId?: string
  ) {
    const currentSheikhId = extractSheikhId(authHeader, headerId);
    if (!currentSheikhId) {
      throw new UnauthorizedException('يرجى تسجيل الدخول أولاً');
    }

    const caller = await this.sheikhsService.findOne(currentSheikhId);
    const isAdmin = caller?.role === 'مشرف عام' || caller?.username === 'admin';
    if (!isAdmin) {
      throw new ForbiddenException('فقط المشرف العام يملك صلاحية إعادة تعيين كلمة مرور المشايخ.');
    }

    return this.sheikhsService.resetPassword(+id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body()
    data: {
      name?: string;
      username?: string;
      password?: string;
      phone?: string;
      role?: string;
      isActive?: boolean;
    },
    @Headers('authorization') authHeader?: string,
    @Headers('x-sheikh-id') headerId?: string
  ) {
    const targetId = +id;
    const currentSheikhId = extractSheikhId(authHeader, headerId);

    // If caller is authenticated as a different sheikh, prevent editing personal info
    if (currentSheikhId && currentSheikhId !== targetId) {
      throw new ForbiddenException('لا يمكنك تعديل بيانات حساب شيخ آخر. يمكنك فقط إعادة تعيين كلمة المرور إلى password123.');
    }

    return this.sheikhsService.update(targetId, data);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Headers('authorization') authHeader?: string,
    @Headers('x-sheikh-id') headerId?: string
  ) {
    const currentSheikhId = extractSheikhId(authHeader, headerId);
    if (currentSheikhId) {
      const caller = await this.sheikhsService.findOne(currentSheikhId);
      const isAdmin = caller?.role === 'مشرف عام' || caller?.username === 'admin';
      if (!isAdmin) {
        throw new ForbiddenException('فقط المشرف العام يملك صلاحية حذف أو إيقاف حسابات المشايخ.');
      }
    }
    return this.sheikhsService.remove(+id);
  }
}

