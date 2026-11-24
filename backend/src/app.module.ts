import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { StudentsModule } from './students/students.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { SheikhsModule } from './sheikhs/sheikhs.module.js';
import { BackupModule } from './backup/backup.module.js';
import { HalaqatModule } from './halaqat/halaqat.module.js';
import { DisciplineModule } from './discipline/discipline.module.js';
import { PortionsModule } from './portions/portions.module.js';
import { RevisionModule } from './revision/revision.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [PrismaModule, StudentsModule, SettingsModule, SheikhsModule, BackupModule, HalaqatModule, DisciplineModule, PortionsModule, RevisionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
