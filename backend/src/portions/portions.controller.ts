import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Post, Put, Query, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getCaller } from '../sheikhs/auth.util.js';
import { PortionsService, type PortionInput } from './portions.service.js';

@Controller()
export class PortionsController {
  constructor(
    private readonly portions: PortionsService,
    private readonly prisma: PrismaService,
  ) {}

  private async caller(auth?: string, hid?: string) {
    const c = await getCaller(this.prisma, auth, hid);
    if (!c) throw new UnauthorizedException('يرجى تسجيل الدخول أولاً');
    return c;
  }

  @Get('portions')
  list(@Query('from') from?: string, @Query('to') to?: string) {
    return this.portions.listRange(from, to);
  }

  @Get('portions/summary')
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.portions.summary(from, to);
  }

  @Get('students/:id/portions')
  forStudent(@Param('id', ParseIntPipe) id: number) {
    return this.portions.forStudent(id);
  }

  @Post('students/:id/portions')
  async create(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PortionInput,
    @Headers('authorization') auth?: string,
    @Headers('x-sheikh-id') hid?: string,
  ) {
    return this.portions.create(id, body, await this.caller(auth, hid));
  }

  @Put('portions/:id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PortionInput,
    @Headers('authorization') auth?: string,
    @Headers('x-sheikh-id') hid?: string,
  ) {
    await this.caller(auth, hid);
    return this.portions.update(id, body);
  }

  @Delete('portions/:id')
  async remove(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string, @Headers('x-sheikh-id') hid?: string) {
    await this.caller(auth, hid);
    return this.portions.remove(id);
  }
}
