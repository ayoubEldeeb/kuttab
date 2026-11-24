import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Post, Query, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getCaller } from '../sheikhs/auth.util.js';
import { RevisionService, type RevisionInput } from './revision.service.js';

@Controller()
export class RevisionController {
  constructor(
    private readonly revision: RevisionService,
    private readonly prisma: PrismaService,
  ) {}

  private async caller(auth?: string, hid?: string) {
    const c = await getCaller(this.prisma, auth, hid);
    if (!c) throw new UnauthorizedException('يرجى تسجيل الدخول أولاً');
    return c;
  }

  @Get('revision/sessions')
  sessions(@Query('date') date?: string, @Query('kind') kind?: string) {
    return this.revision.sessionsOn(date, kind);
  }

  @Get('students/:id/revisions')
  forStudent(@Param('id', ParseIntPipe) id: number) {
    return this.revision.forStudent(id);
  }

  @Post('revision/sessions')
  async save(@Body() body: RevisionInput, @Headers('authorization') auth?: string, @Headers('x-sheikh-id') hid?: string) {
    return this.revision.save(body, await this.caller(auth, hid));
  }

  @Delete('revision/sessions/:id')
  async remove(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string, @Headers('x-sheikh-id') hid?: string) {
    await this.caller(auth, hid);
    return this.revision.remove(id);
  }
}
