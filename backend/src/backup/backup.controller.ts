import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { extractSheikhId, isAdminSheikh } from '../sheikhs/auth.util.js';
import { BackupValidationError } from './backup.format.js';
import { BackupService } from './backup.service.js';

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
export const IMPORT_CONFIRMATION = 'REPLACE_ALL_DATA';

const uploadInterceptor = FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

@Controller('backup')
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly prisma: PrismaService,
  ) {}

  /** Backup and restore expose every account and record, so only the general supervisor may use them. */
  private async requireAdmin(authHeader?: string, headerId?: string) {
    const id = extractSheikhId(authHeader, headerId);
    if (!id) throw new UnauthorizedException('يرجى تسجيل الدخول أولاً');
    const caller = await this.prisma.sheikh.findUnique({ where: { id } });
    if (!caller || !caller.isActive) throw new UnauthorizedException('يرجى تسجيل الدخول أولاً');
    if (!isAdminSheikh(caller)) {
      throw new ForbiddenException('النسخ الاحتياطي ونقل البيانات متاح للمشرف العام فقط.');
    }
  }

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof BackupValidationError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  @Get('info')
  async info(@Headers('authorization') auth?: string, @Headers('x-sheikh-id') headerId?: string) {
    await this.requireAdmin(auth, headerId);
    return this.backupService.getInfo();
  }

  @Get('export')
  async export(
    @Res({ passthrough: true }) res: Response,
    @Headers('authorization') auth?: string,
    @Headers('x-sheikh-id') headerId?: string,
  ) {
    await this.requireAdmin(auth, headerId);
    const backup = await this.backupService.exportBackup();
    const day = backup.exportedAt.slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="kittab-backup-${day}.json"`);
    res.setHeader('Cache-Control', 'no-store');
    // Compact JSON keeps the file small enough to send over WhatsApp/e-mail.
    return JSON.stringify(backup);
  }

  @Post('preview')
  @HttpCode(200)
  @UseInterceptors(uploadInterceptor)
  async preview(
    @UploadedFile() file: any,
    @Headers('authorization') auth?: string,
    @Headers('x-sheikh-id') headerId?: string,
  ) {
    await this.requireAdmin(auth, headerId);
    return this.run(() => this.backupService.preview(file));
  }

  @Post('import')
  @HttpCode(200)
  @UseInterceptors(uploadInterceptor)
  async import(
    @UploadedFile() file: any,
    @Body('confirm') confirm?: string,
    @Headers('authorization') auth?: string,
    @Headers('x-sheikh-id') headerId?: string,
  ) {
    await this.requireAdmin(auth, headerId);
    if (confirm !== IMPORT_CONFIRMATION) {
      throw new BadRequestException('يجب تأكيد استبدال البيانات قبل الاستيراد.');
    }
    return this.run(() => this.backupService.importReplace(file));
  }
}
