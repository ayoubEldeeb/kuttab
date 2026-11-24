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
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PERIODS } from '../common/periods.js';
import { getCaller } from '../sheikhs/auth.util.js';
import { HalaqatService, type HalaqaInput, type TransferInput } from './halaqat.service.js';

@Controller()
export class HalaqatController {
  constructor(
    private readonly halaqat: HalaqatService,
    private readonly prisma: PrismaService,
  ) {}

  private async caller(auth?: string, headerId?: string) {
    const c = await getCaller(this.prisma, auth, headerId);
    if (!c) throw new UnauthorizedException('يرجى تسجيل الدخول أولاً');
    return c;
  }

  private async admin(auth?: string, headerId?: string) {
    const c = await this.caller(auth, headerId);
    if (!c.isAdmin) throw new ForbiddenException('إدارة الحلقات متاحة للمشرف العام فقط.');
    return c;
  }

  @Get('periods')
  periods() {
    return PERIODS;
  }

  @Get('halaqat')
  findAll() {
    return this.halaqat.findAll();
  }

  @Get('halaqat/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.halaqat.findOne(id);
  }

  @Post('halaqat')
  async create(@Body() body: HalaqaInput, @Headers('authorization') auth?: string, @Headers('x-sheikh-id') hid?: string) {
    await this.admin(auth, hid);
    return this.halaqat.create(body);
  }

  /** The supervisor can change everything; a halaqa's own sheikh may edit its notes. */
  @Put('halaqat/:id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: HalaqaInput,
    @Headers('authorization') auth?: string,
    @Headers('x-sheikh-id') hid?: string,
  ) {
    const c = await this.caller(auth, hid);
    if (!c.isAdmin) {
      const halaqa = await this.halaqat.findOne(id);
      const onlyNotes = Object.keys(body).every((k) => k === 'notes');
      if (halaqa.sheikhId !== c.id || !onlyNotes) {
        throw new ForbiddenException('يمكنك تعديل ملاحظات حلقتك فقط؛ باقي التعديلات للمشرف العام.');
      }
    }
    return this.halaqat.update(id, body);
  }

  @Delete('halaqat/:id')
  async remove(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string, @Headers('x-sheikh-id') hid?: string) {
    await this.admin(auth, hid);
    return this.halaqat.remove(id);
  }

  @Post('students/transfer')
  async transfer(@Body() body: TransferInput, @Headers('authorization') auth?: string, @Headers('x-sheikh-id') hid?: string) {
    const c = await this.caller(auth, hid);
    return this.halaqat.transfer(body, c.name);
  }

  @Get('students/:id/transfers')
  transfers(@Param('id', ParseIntPipe) id: number) {
    return this.halaqat.transfersOf(id);
  }
}
