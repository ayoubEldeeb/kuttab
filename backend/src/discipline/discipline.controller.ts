import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getCaller } from '../sheikhs/auth.util.js';
import { DisciplineService } from './discipline.service.js';

@Controller('discipline')
export class DisciplineController {
  constructor(
    private readonly discipline: DisciplineService,
    private readonly prisma: PrismaService,
  ) {}

  private async caller(auth?: string, hid?: string) {
    const c = await getCaller(this.prisma, auth, hid);
    if (!c) throw new UnauthorizedException('يرجى تسجيل الدخول أولاً');
    return c;
  }

  @Get('settings')
  settings() {
    return this.discipline.getSettings();
  }

  @Get('alerts')
  alerts() {
    return this.discipline.alerts();
  }

  @Get('students/:id')
  student(@Param('id', ParseIntPipe) id: number) {
    return this.discipline.detailsFor(id);
  }

  @Post('students/:id/actions')
  async act(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { kind?: string; reason?: string },
    @Headers('authorization') auth?: string,
    @Headers('x-sheikh-id') hid?: string,
  ) {
    return this.discipline.act(id, body, await this.caller(auth, hid));
  }

  @Delete('actions/:id')
  async remove(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string, @Headers('x-sheikh-id') hid?: string) {
    const c = await this.caller(auth, hid);
    if (!c.isAdmin) throw new ForbiddenException('إلغاء الإجراءات متاح للمشرف العام فقط.');
    return this.discipline.removeAction(id);
  }
}
