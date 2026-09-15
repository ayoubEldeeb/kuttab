import { Module } from '@nestjs/common';
import { SheikhsService } from './sheikhs.service.js';
import { SheikhsController } from './sheikhs.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [SheikhsController],
  providers: [SheikhsService],
  exports: [SheikhsService],
})
export class SheikhsModule {}
