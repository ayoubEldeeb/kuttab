import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Ensure default settings exist
    const defaultSettings = [
      { key: 'holidayDays', value: JSON.stringify(['thursday', 'friday']) },
      { key: 'customHolidays', value: JSON.stringify([]) },
      { key: 'fontSize', value: 'normal' },
      { key: 'theme', value: 'emerald' },
      { key: 'centerName', value: 'مركز حلقات تحفيظ القرآن الكريم' },
    ];

    for (const setting of defaultSettings) {
      const existing = await this.prisma.systemSetting.findUnique({
        where: { key: setting.key },
      });
      if (!existing) {
        await this.prisma.systemSetting.create({
          data: setting,
        });
      }
    }
  }

  async getAll(): Promise<Record<string, any>> {
    const records = await this.prisma.systemSetting.findMany();
    const result: Record<string, any> = {
      holidayDays: ['thursday', 'friday'],
      customHolidays: [],
      fontSize: 'normal',
      theme: 'emerald',
      centerName: 'مركز حلقات تحفيظ القرآن الكريم',
    };

    for (const r of records) {
      try {
        result[r.key] = JSON.parse(r.value);
      } catch {
        result[r.key] = r.value;
      }
    }

    return result;
  }

  async getSetting(key: string): Promise<any> {
    const record = await this.prisma.systemSetting.findUnique({
      where: { key },
    });
    if (!record) return null;
    try {
      return JSON.parse(record.value);
    } catch {
      return record.value;
    }
  }

  async updateSettings(data: Record<string, any>) {
    const updated: Record<string, any> = {};

    for (const [key, val] of Object.entries(data)) {
      const stringValue = typeof val === 'object' ? JSON.stringify(val) : String(val);
      await this.prisma.systemSetting.upsert({
        where: { key },
        create: { key, value: stringValue },
        update: { value: stringValue },
      });
      updated[key] = val;
    }

    return this.getAll();
  }
}
