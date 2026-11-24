import { Module } from '@nestjs/common';
import { HalaqatController } from './halaqat.controller.js';
import { HalaqatService } from './halaqat.service.js';

@Module({
  controllers: [HalaqatController],
  providers: [HalaqatService],
  exports: [HalaqatService],
})
export class HalaqatModule {}
