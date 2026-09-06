import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { StudentsModule } from './students/students.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [PrismaModule, StudentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
