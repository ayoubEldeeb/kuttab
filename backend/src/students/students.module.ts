import { Module } from '@nestjs/common';
import { StudentsService } from './students.service.js';
import { StudentsController } from './students.controller.js';
import { DisciplineModule } from '../discipline/discipline.module.js';

@Module({
  imports: [DisciplineModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
