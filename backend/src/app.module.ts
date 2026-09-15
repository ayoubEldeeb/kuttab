import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { StudentsModule } from './students/students.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { SheikhsModule } from './sheikhs/sheikhs.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [PrismaModule, StudentsModule, SettingsModule, SheikhsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
