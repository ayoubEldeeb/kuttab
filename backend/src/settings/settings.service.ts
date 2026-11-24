import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const WEEK_DAYS = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

/** Defaults of the program settings (discipline, weekly cycle, revision). */
export const PROGRAM_DEFAULTS: Record<string, unknown> = {
  disciplineEnabled: true,
  disciplineAbsenceThreshold: 2,
  disciplineMaxWarnings: 2,
  disciplineCountWindow: 'since_last_decision',
  weekStartDay: 'saturday',
  revisionExamDay: 'saturday',
  defaultDailyRevisionAmount: 4,
  defaultExamRevisionJuz: 3,
};

/** Validates program settings; other keys pass through unchanged. */
function validateProgramSetting(key: string, val: unknown): unknown {
  const int = (min: number, max: number, label: string) => {
    const n = Number(val);
    if (!Number.isInteger(n) || n < min || n > max) throw new BadRequestException(`${label} يجب أن يكون بين ${min} و${max}`);
    return n;
  };
  switch (key) {
    case 'disciplineEnabled':
      return val === true || val === 'true';
    case 'disciplineAbsenceThreshold':
      return int(1, 30, 'عدد الغيابات الموجب للإنذار');
    case 'disciplineMaxWarnings':
      return int(1, 10, 'عدد الإنذارات قبل الفصل');
    case 'disciplineCountWindow':
      if (val !== 'since_last_decision' && val !== 'month') throw new BadRequestException('طريقة احتساب الغياب غير صحيحة');
      return val;
    case 'weekStartDay':
    case 'revisionExamDay':
      if (!WEEK_DAYS.includes(String(val))) throw new BadRequestException('اليوم غير صحيح');
      return val;
    case 'defaultDailyRevisionAmount':
      return int(1, 40, 'مقدار المراجعة اليومية');
    case 'defaultExamRevisionJuz':
      return int(1, 30, 'مقدار اختبار المراجعة');
    default:
      return val;
  }
}

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
      ...PROGRAM_DEFAULTS,
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

    for (const [key, raw] of Object.entries(data)) {
      const val = validateProgramSetting(key, raw);
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
