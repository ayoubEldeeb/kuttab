import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  async create(data: { name: string; guardianName?: string; guardianPhone?: string; currentReach?: string }) {
    const count = await this.prisma.student.count();
    const serialNumber = `STU-${String(count + 1).padStart(4, '0')}`;
    
    return this.prisma.student.create({
      data: {
        ...data,
        serialNumber,
      },
    });
  }

  findAll(date?: string) {
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setUTCHours(23, 59, 59, 999);

      return this.prisma.student.findMany({
        orderBy: { name: 'asc' },
        include: {
          histories: {
            orderBy: { date: 'desc' },
            take: 60,
            include: {
              sheikh: {
                select: { id: true, name: true, role: true },
              },
            },
          },
        },
      });
    }
    return this.prisma.student.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        histories: {
          orderBy: { date: 'desc' },
          take: 5,
          include: {
            sheikh: {
              select: { id: true, name: true, role: true },
            },
          },
        },
      },
    });
  }

  findOne(id: number) {
    return this.prisma.student.findUnique({
      where: { id },
      include: {
        histories: {
          orderBy: { date: 'desc' },
          include: {
            sheikh: {
              select: { id: true, name: true, role: true },
            },
          },
        },
      },
    });
  }

  async addHistory(id: number, data: { 
    status: string; 
    notes?: string; 
    date?: string; 
    type?: string; 
    fromPart?: string; 
    toPart?: string; 
    nextReviewDate?: string; 
    nextReviewFrom?: string; 
    nextReviewTo?: string; 
    nextReviewNotes?: string; 
    writtenParts?: string;
    sheikhId?: number;
    sheikhName?: string;
  }) {
    const targetDate = data.date ? new Date(data.date) : new Date();
    
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    let resolvedSheikhName = data.sheikhName;
    if (data.sheikhId && !resolvedSheikhName) {
      const sh = await this.prisma.sheikh.findUnique({ where: { id: data.sheikhId } });
      if (sh) resolvedSheikhName = sh.name;
    }

    const updateData: Record<string, any> = {
      status: data.status,
      notes: data.notes,
      type: data.type,
      fromPart: data.fromPart,
      toPart: data.toPart,
      writtenParts: data.writtenParts,
      sheikhId: data.sheikhId !== undefined ? data.sheikhId : undefined,
      sheikhName: resolvedSheikhName !== undefined ? resolvedSheikhName : undefined,
      nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null,
      nextReviewFrom: data.nextReviewFrom,
      nextReviewTo: data.nextReviewTo,
      nextReviewNotes: data.nextReviewNotes,
    };

    const existing = await this.prisma.history.findFirst({
      where: {
        studentId: id,
        date: { gte: startOfDay, lte: endOfDay },
      },
    });

    if (
      data.type &&
      (data.type === 'تسميع' || data.type.includes('تسميع')) &&
      data.toPart &&
      data.status !== 'عرض ولم يحفظ' &&
      data.status !== 'كتب فقط' &&
      data.status !== 'لم يحضر'
    ) {
      await this.prisma.student.update({
        where: { id },
        data: { currentReach: data.toPart },
      });
    }

    if (data.type && (data.type === 'مراجعة' || data.type.includes('مراجعة')) && data.nextReviewFrom && data.nextReviewTo) {
      await this.prisma.student.update({
        where: { id },
        data: { 
          currentRevisionFrom: data.nextReviewFrom,
          currentRevisionTo: data.nextReviewTo,
        },
      });
    }

    if (existing) {
      Object.keys(updateData).forEach((key) => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });
      
      return this.prisma.history.update({
        where: { id: existing.id },
        data: updateData,
        include: {
          sheikh: { select: { id: true, name: true, role: true } },
        },
      });
    }

    return this.prisma.history.create({
      data: {
        studentId: id,
        date: targetDate,
        status: data.status,
        ...updateData,
      },
      include: {
        sheikh: { select: { id: true, name: true, role: true } },
      },
    });
  }

  update(id: number, data: { name?: string; guardianName?: string; guardianPhone?: string; currentReach?: string; currentRevisionFrom?: string; currentRevisionTo?: string; }) {
    return this.prisma.student.update({
      where: { id },
      data,
    });
  }

  async getStudentReport(id: number, startDateStr?: string, endDateStr?: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        histories: {
          orderBy: { date: 'asc' },
          include: {
            sheikh: { select: { id: true, name: true, role: true } },
          },
        },
      },
    });

    if (!student) {
      throw new Error(`Student with id ${id} not found`);
    }

    // Resolve system holidays
    const holidaySetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'holidayDays' },
    });
    let holidayDays: string[] = ['thursday', 'friday'];
    if (holidaySetting) {
      try {
        holidayDays = JSON.parse(holidaySetting.value);
      } catch {
        holidayDays = ['thursday', 'friday'];
      }
    }

    const customHolidaySetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'customHolidays' },
    });
    let customHolidays: Array<{ id: string; date: string; name: string; reason?: string }> = [];
    if (customHolidaySetting) {
      try {
        customHolidays = JSON.parse(customHolidaySetting.value);
      } catch {
        customHolidays = [];
      }
    }

    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayArabicNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    // Resolve date range
    const today = new Date();
    let end = endDateStr ? new Date(endDateStr) : new Date(today);
    let start = startDateStr ? new Date(startDateStr) : new Date(end);
    if (!startDateStr) {
      start.setDate(end.getDate() - 13); // Default last 14 days
    }

    // Normalize to YYYY-MM-DD
    const formatDateKey = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const startKey = formatDateKey(start);
    const endKey = formatDateKey(end);

    // Map histories by YYYY-MM-DD
    const historiesByDate: Record<string, any[]> = {};
    student.histories.forEach((h) => {
      const hDate = new Date(h.date);
      const k = formatDateKey(hDate);
      if (!historiesByDate[k]) historiesByDate[k] = [];
      historiesByDate[k].push(h);
    });

    // Generate list of all days in the range
    const days: any[] = [];
    let current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const endMidnight = new Date(end);
    endMidnight.setHours(0, 0, 0, 0);

    let workingDaysCount = 0;
    let holidayDaysCount = 0;
    let attendedDaysCount = 0;
    let absentDaysCount = 0;
    let memorizedPortionsCount = 0;
    let writtenThumnsCount = 0;
    let writtenAyahsCount = 0;
    let revisionSessionsCount = 0;
    let daysMemorizedAndWrittenCount = 0;
    let daysMemorizedOnlyCount = 0;
    let daysWrittenOnlyCount = 0;
    let daysAttemptedOnlyCount = 0;
    let daysRevisionOnlyCount = 0;

    while (current <= endMidnight) {
      const dateKey = formatDateKey(current);
      const dayIndex = current.getDay();
      const dayKey = dayKeys[dayIndex];
      const dayName = dayArabicNames[dayIndex];

      const matchedCustomHoliday = customHolidays.find((ch) => ch.date === dateKey);
      const isCustomHoliday = !!matchedCustomHoliday;
      const isWeeklyHoliday = holidayDays.includes(dayKey);
      const isHoliday = isCustomHoliday || isWeeklyHoliday;
      const holidayName = matchedCustomHoliday ? matchedCustomHoliday.name : (isWeeklyHoliday ? 'عطلة أسبوعية رسمية' : undefined);
      const holidayReason = matchedCustomHoliday ? matchedCustomHoliday.reason : undefined;

      if (isHoliday) {
        holidayDaysCount++;
      } else {
        workingDaysCount++;
      }

      const dayHistories = historiesByDate[dateKey] || [];
      const history = dayHistories[0] || null;

      let attendanceStatus = 'لا توجد حلقة';
      let attendanceType: 'attended' | 'absent' | 'holiday' | 'none' = 'none';

      let recitationInfo: {
        didRecite: boolean;
        fromPart?: string;
        toPart?: string;
        status?: string;
        text?: string;
      } = { didRecite: false };

      let writingInfo: {
        didWrite: boolean;
        thumns: number;
        ayahs: number;
        parts: string[];
        text: string;
      } = { didWrite: false, thumns: 0, ayahs: 0, parts: [], text: '-' };

      let revisionInfo: {
        didReview: boolean;
        fromPart?: string;
        toPart?: string;
        status?: string;
        text?: string;
      } = { didReview: false };

      let notes = '';
      let sheikhName = '';

      if (history) {
        notes = history.notes || '';
        sheikhName = history.sheikhName || history.sheikh?.name || '';

        if (history.status === 'لم يحضر') {
          attendanceStatus = 'لم يحضر';
          attendanceType = 'absent';
          absentDaysCount++;
        } else {
          attendanceStatus = 'حاضر';
          attendanceType = 'attended';
          attendedDaysCount++;

          // Recitation check
          if (history.status.includes('حفظ') || history.type === 'تسميع' || history.fromPart || history.toPart) {
            recitationInfo.didRecite = true;
            recitationInfo.fromPart = history.fromPart || '';
            recitationInfo.toPart = history.toPart || '';
            recitationInfo.status = history.status;

            if (history.status === 'عرض ولم يحفظ' || history.status === 'لم يحفظ') {
              recitationInfo.text = 'عرض ولم يحفظ (بحاجة لإعادة وتثبيت)';
            } else {
              memorizedPortionsCount++;
              if (history.fromPart && history.toPart && history.fromPart !== history.toPart) {
                recitationInfo.text = `من ${history.fromPart} إلى ${history.toPart}`;
              } else if (history.fromPart || history.toPart) {
                recitationInfo.text = history.fromPart || history.toPart;
              } else {
                recitationInfo.text = 'أتم حفظ وتسميع الورد اليومي بنجاح';
              }
            }
          }

          // Writing check (Thumn vs Ayah parsing)
          let parsedParts: any[] = [];
          if (history.writtenParts) {
            try {
              const parsed = JSON.parse(history.writtenParts);
              if (Array.isArray(parsed)) parsedParts = parsed;
              else if (typeof parsed === 'object' && parsed !== null) parsedParts = [parsed];
            } catch {
              if (history.writtenParts.trim()) parsedParts = [history.writtenParts.trim()];
            }
          }

          let dayThumns = 0;
          let dayAyahs = 0;
          const formattedPartsList: string[] = [];

          parsedParts.forEach((part: any) => {
            if (typeof part === 'object' && part !== null) {
              if (part.type === 'ayahs' || part.ayahCount) {
                const count = Number(part.ayahCount || part.count) || 1;
                dayAyahs += count;
                dayThumns += Math.round((count / 20) * 10) / 10;
                formattedPartsList.push(`${count} آيات من سورة ${part.surah || ''} (${part.fromAyah || 1}-${part.toAyah || count})`);
              } else if (part.thumnCount) {
                const count = Number(part.thumnCount) || 1;
                dayThumns += count;
                dayAyahs += count * 20;
                formattedPartsList.push(`${count} أثمان من ${part.surah || ''}`);
              } else if (part.text) {
                formattedPartsList.push(part.text);
                dayThumns += 1;
                dayAyahs += 20;
              }
            } else if (typeof part === 'string' && part.trim() !== '') {
              const trimmed = part.trim();
              const ayaMatch = trimmed.match(/(\d+)\s*آي/);
              if (ayaMatch) {
                const c = parseInt(ayaMatch[1], 10);
                dayAyahs += c;
                dayThumns += Math.round((c / 20) * 10) / 10;
              } else {
                dayThumns += 1;
                dayAyahs += 20;
              }
              formattedPartsList.push(trimmed);
            }
          });

          if ((history.status === 'عرض وحفظ وكتب' || history.status === 'كتب فقط') && formattedPartsList.length === 0) {
            dayThumns += 1;
            dayAyahs += 20;
            formattedPartsList.push('لوح قرآني كامل');
          }

          if (dayThumns > 0 || dayAyahs > 0 || formattedPartsList.length > 0) {
            writingInfo.didWrite = true;
            writingInfo.thumns = dayThumns;
            writingInfo.ayahs = dayAyahs;
            writingInfo.parts = formattedPartsList;
            writingInfo.text = formattedPartsList.join('، ');
            writtenThumnsCount += dayThumns;
            writtenAyahsCount += dayAyahs;
          } else if (history.status.includes('ولم يكتب')) {
            writingInfo.didWrite = false;
            writingInfo.text = 'لم يكتب في اللوح';
          }

          // Revision check
          if (history.type === 'مراجعة' || history.nextReviewFrom || history.nextReviewTo) {
            revisionInfo.didReview = true;
            revisionInfo.fromPart = history.nextReviewFrom || history.fromPart || '';
            revisionInfo.toPart = history.nextReviewTo || history.toPart || '';
            revisionInfo.status = history.status;
            if (history.status === 'حفظ' || history.status.includes('حفظ')) {
              revisionInfo.text = `أتم المراجعة: من ${revisionInfo.fromPart || '-'} إلى ${revisionInfo.toPart || '-'}`;
              revisionSessionsCount++;
            } else if (history.status === 'لم يحفظ') {
              revisionInfo.text = `لم يتقن المراجعة (بحاجة لتثبيت): من ${revisionInfo.fromPart || '-'} إلى ${revisionInfo.toPart || '-'}`;
            } else {
              revisionInfo.text = `ورد المراجعة: من ${revisionInfo.fromPart || '-'} إلى ${revisionInfo.toPart || '-'}`;
            }
          }
        }
      } else {
        if (isHoliday) {
          attendanceStatus = isCustomHoliday
            ? (holidayReason ? `عطلة: ${holidayName} (${holidayReason})` : `عطلة: ${holidayName || 'إجازة رسمية'}`)
            : 'عطلة أسبوعية';
          attendanceType = 'holiday';
        } else {
          attendanceStatus = 'لا توجد حلقة';
          attendanceType = 'none';
        }
      }

      // Granular Daily Activity Analysis (حفظ ولم يكتب، كتب ولم يحفظ، إلخ)
      let activityType: 
        | 'recited_and_wrote' 
        | 'recited_only' 
        | 'wrote_only' 
        | 'attempted_recitation' 
        | 'revision_only' 
        | 'attended_only' 
        | 'absent' 
        | 'holiday' 
        | 'none' = 'none';
      let activityLabel = 'لا توجد حلقة';
      let activityBadgeColor = 'slate';

      if (attendanceType === 'holiday') {
        activityType = 'holiday';
        activityLabel = isCustomHoliday
          ? (holidayReason ? `${holidayName} (${holidayReason})` : (holidayName || 'إجازة رسمية'))
          : 'عطلة أسبوعية رسمية';
        activityBadgeColor = 'amber';
      } else if (attendanceType === 'absent') {
        activityType = 'absent';
        activityLabel = 'غائب (لم يحضر)';
        activityBadgeColor = 'rose';
      } else if (attendanceType === 'attended') {
        const didReciteSuccessfully = recitationInfo.didRecite && history?.status !== 'عرض ولم يحفظ' && history?.status !== 'لم يحفظ';
        const attemptedRecitation = history?.status === 'عرض ولم يحفظ' || history?.status === 'لم يحفظ';
        const didWrite = writingInfo.didWrite;

        if (didReciteSuccessfully && didWrite) {
          activityType = 'recited_and_wrote';
          activityLabel = 'حَفِظَ وكَتَبَ في اللوح';
          activityBadgeColor = 'emerald';
          daysMemorizedAndWrittenCount++;
        } else if (didReciteSuccessfully && !didWrite) {
          activityType = 'recited_only';
          activityLabel = 'حَفِظَ ولم يكتب في اللوح';
          activityBadgeColor = 'teal';
          writingInfo.text = 'لم يكتب في اللوح اليوم';
          daysMemorizedOnlyCount++;
        } else if (!didReciteSuccessfully && didWrite) {
          activityType = 'wrote_only';
          activityLabel = 'كَتَبَ في اللوح فقط';
          activityBadgeColor = 'purple';
          recitationInfo.text = 'لم يُسمّع حفظاً جديداً اليوم';
          daysWrittenOnlyCount++;
        } else if (attemptedRecitation) {
          activityType = 'attempted_recitation';
          activityLabel = 'عَرَضَ ولم يحفظ (إعادة)';
          activityBadgeColor = 'amber';
          daysAttemptedOnlyCount++;
        } else if (revisionInfo.didReview) {
          activityType = 'revision_only';
          activityLabel = 'مراجعة وتثبيت فقط';
          activityBadgeColor = 'indigo';
          daysRevisionOnlyCount++;
        } else {
          activityType = 'attended_only';
          activityLabel = 'حاضر (جلسة عامة)';
          activityBadgeColor = 'slate';
        }
      }

      days.push({
        date: dateKey,
        dayName,
        dayKey,
        isHoliday,
        isWeeklyHoliday,
        isCustomHoliday,
        holidayName,
        holidayReason,
        attendanceStatus,
        attendanceType,
        activityType,
        activityLabel,
        activityBadgeColor,
        recitation: recitationInfo,
        writing: writingInfo,
        revision: revisionInfo,
        notes,
        sheikhName,
      });

      current.setDate(current.getDate() + 1);
    }

    const totalDays = days.length;
    const effectiveWorkingDays = workingDaysCount > 0 ? workingDaysCount : totalDays;
    const attendanceRate = effectiveWorkingDays > 0 ? Math.round((attendedDaysCount / effectiveWorkingDays) * 100) : 100;

    let overallEvaluation = 'ممتاز ومواظب';
    if (attendanceRate >= 90) overallEvaluation = 'ممتاز ومواظب 🌟';
    else if (attendanceRate >= 80) overallEvaluation = 'جيد جداً ومجتهد 👍';
    else if (attendanceRate >= 65) overallEvaluation = 'جيد ويحتاج لمزيد من المواظبة';
    else overallEvaluation = 'بحاجة لمتابعة حثيثة وتواصل مع ولي الأمر';

    return {
      student: {
        id: student.id,
        name: student.name,
        serialNumber: student.serialNumber,
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
        currentReach: student.currentReach,
        currentRevisionFrom: student.currentRevisionFrom,
        currentRevisionTo: student.currentRevisionTo,
        createdAt: student.createdAt,
      },
      period: {
        startDate: startKey,
        endDate: endKey,
        totalDays,
        workingDays: workingDaysCount,
        holidayDays: holidayDaysCount,
      },
      stats: {
        attendedDays: attendedDaysCount,
        absentDays: absentDaysCount,
        holidayDays: holidayDaysCount,
        attendanceRate,
        daysMemorizedAndWritten: daysMemorizedAndWrittenCount,
        daysMemorizedOnly: daysMemorizedOnlyCount,
        daysWrittenOnly: daysWrittenOnlyCount,
        daysAttemptedOnly: daysAttemptedOnlyCount,
        daysRevisionOnly: daysRevisionOnlyCount,
        memorizedPortions: memorizedPortionsCount,
        writtenThumns: Math.round(writtenThumnsCount * 10) / 10,
        writtenAyahs: writtenAyahsCount,
        revisionSessions: revisionSessionsCount,
        overallEvaluation,
      },
      holidayDays,
      customHolidays,
      days,
    };
  }

  async getDashboardStats() {
    const totalStudents = await this.prisma.student.count();

    // Fetch holiday setting
    const holidaySetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'holidayDays' },
    });
    let holidayDays: string[] = ['thursday', 'friday'];
    if (holidaySetting) {
      try {
        holidayDays = JSON.parse(holidaySetting.value);
      } catch {
        holidayDays = ['thursday', 'friday'];
      }
    }

    const customHolidaySetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'customHolidays' },
    });
    let customHolidays: Array<{ id: string; date: string; name: string; reason?: string }> = [];
    if (customHolidaySetting) {
      try {
        customHolidays = JSON.parse(customHolidaySetting.value);
      } catch {
        customHolidays = [];
      }
    }

    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date();
    const todayIsoDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayCustomHoliday = customHolidays.find((ch) => ch.date === todayIsoDate);
    const isTodayHoliday = !!todayCustomHoliday || holidayDays.includes(dayKeys[today.getDay()]);

    const startOfToday = new Date(today);
    startOfToday.setUTCHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setUTCHours(23, 59, 59, 999);

    const todayHistories = await this.prisma.history.findMany({
      where: {
        date: { gte: startOfToday, lte: endOfToday },
      },
      include: {
        student: {
          select: { id: true, name: true, serialNumber: true, currentReach: true },
        },
        sheikh: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    const attendedCount = todayHistories.filter((h) => h.status !== 'لم يحضر').length;
    const absentCount = todayHistories.filter((h) => h.status === 'لم يحضر').length;
    const memorizedCount = todayHistories.filter((h) => h.status.includes('حفظ')).length;
    const writtenCount = todayHistories.filter((h) => h.status.includes('كتب')).length;
    const needsRevisionCount = todayHistories.filter((h) => h.status === 'عرض ولم يحفظ' || h.status === 'لم يحفظ').length;

    const recentActivities = await this.prisma.history.findMany({
      take: 12,
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: { id: true, name: true, serialNumber: true },
        },
        sheikh: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);

    const pastHistories = await this.prisma.history.findMany({
      where: {
        date: { gte: sevenDaysAgo },
      },
      select: {
        date: true,
        status: true,
      },
    });

    const weeklyTrend: Record<string, { date: string; dayName: string; isHoliday: boolean; attended: number; absent: number; memorized: number }> = {};
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayIndex = d.getDay();
      const dayName = dayNames[dayIndex];
      const isDayHoliday = customHolidays.some((ch) => ch.date === isoDate) || holidayDays.includes(dayKeys[dayIndex]);
      weeklyTrend[isoDate] = {
        date: isoDate,
        dayName,
        isHoliday: isDayHoliday,
        attended: 0,
        absent: 0,
        memorized: 0,
      };
    }

    pastHistories.forEach((h) => {
      const isoDate = new Date(h.date).toISOString().split('T')[0];
      if (weeklyTrend[isoDate]) {
        if (h.status === 'لم يحضر') {
          weeklyTrend[isoDate].absent++;
        } else {
          weeklyTrend[isoDate].attended++;
        }
        if (h.status.includes('حفظ')) {
          weeklyTrend[isoDate].memorized++;
        }
      }
    });

    const studentsWithReach = await this.prisma.student.findMany({
      select: { id: true, name: true, currentReach: true },
    });

    const getStageName = (reach: string | null): string => {
      if (!reach || reach.trim() === '' || reach === '-' || reach === 'لم يحدد' || reach === 'لم يحدد المستوى') {
        return 'غير محدد';
      }

      const juzMatch = reach.match(/الجزء\s*(\d+)/);
      if (juzMatch) {
        const juz = parseInt(juzMatch[1], 10);
        if (juz === 30) return 'جزء عمّ';
        if (juz === 29) return 'جزء تبارك';
        if (juz === 28) return 'جزء قد سمع';
        if (juz >= 22 && juz <= 27) return 'ربع ياسين';
        if (juz >= 16 && juz <= 21) return 'ربع مريم';
        if (juz >= 9 && juz <= 15) return 'ربع الأعراف';
        if (juz >= 1 && juz <= 8) return 'ربع البقرة';
      }

      const normalized = reach.replace(/[ًٌٍَُِّْٰٓ]/g, '');

      // جزء عمّ (78 - 114)
      const ammaSurahs = [
        'النبأ', 'النازعات', 'عبس', 'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج',
        'الطارق', 'الأعلى', 'الغاشية', 'الفجر', 'البلد', 'الشمس', 'الليل', 'الضحى', 'الشرح',
        'التين', 'العلق', 'القدر', 'البينة', 'الزلزلة', 'العاديات', 'القارعة', 'التكاثر',
        'العصر', 'الهمزة', 'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر', 'المسد',
        'الإخلاص', 'الفلق', 'الناس', 'عم'
      ];
      if (ammaSurahs.some((s) => normalized.includes(s.replace(/[ًٌٍَُِّْٰٓ]/g, '')))) return 'جزء عمّ';

      // جزء تبارك (67 - 77)
      const tabarakSurahs = [
        'الملك', 'القلم', 'الحاقة', 'المعارج', 'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات', 'تبارك'
      ];
      if (tabarakSurahs.some((s) => normalized.includes(s.replace(/[ًٌٍَُِّْٰٓ]/g, '')))) return 'جزء تبارك';

      // جزء قد سمع (58 - 66)
      const qadSamaaSurahs = [
        'المجادلة', 'الحشر', 'الممتحنة', 'الصف', 'الجمعة', 'المنافقون', 'الطلاق', 'التحريم', 'قد سمع'
      ];
      if (qadSamaaSurahs.some((s) => normalized.includes(s.replace(/[ًٌٍَُِّْٰٓ]/g, '')))) return 'جزء قد سمع';

      // ربع ياسين (33 - 57)
      const yasinSurahs = [
        'يس', 'ياسين', 'الأحزاب', 'سبأ', 'فاطر', 'الصافات', 'ص', 'الزمر', 'غافر', 'فصلت',
        'الشورى', 'الزخرف', 'الدخان', 'الجاثية', 'الأحقاف', 'محمد', 'الفتح', 'الحجرات', 'ق',
        'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة', 'الحديد'
      ];
      if (yasinSurahs.some((s) => normalized.includes(s.replace(/[ًٌٍَُِّْٰٓ]/g, '')))) return 'ربع ياسين';

      // ربع مريم (19 - 32)
      const maryamSurahs = [
        'مريم', 'طه', 'الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء', 'النمل', 'القصص', 'العنكبوت', 'الروم', 'لقمان', 'السجدة'
      ];
      if (maryamSurahs.some((s) => normalized.includes(s.replace(/[ًٌٍَُِّْٰٓ]/g, '')))) return 'ربع مريم';

      // ربع الأعراف (7 - 18)
      const aarafSurahs = [
        'الأعراف', 'الأنفال', 'التوبة', 'يونس', 'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل', 'الإسراء', 'الكهف'
      ];
      if (aarafSurahs.some((s) => normalized.includes(s.replace(/[ًٌٍَُِّْٰٓ]/g, '')))) return 'ربع الأعراف';

      // ربع البقرة (1 - 6)
      const baqarahSurahs = [
        'الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام'
      ];
      if (baqarahSurahs.some((s) => normalized.includes(s.replace(/[ًٌٍَُِّْٰٓ]/g, '')))) return 'ربع البقرة';

      return 'غير محدد';
    };

    const quranLevels: Record<string, number> = {
      'جزء عمّ': 0,
      'جزء تبارك': 0,
      'جزء قد سمع': 0,
      'ربع ياسين': 0,
      'ربع مريم': 0,
      'ربع الأعراف': 0,
      'ربع البقرة': 0,
      'غير محدد': 0,
    };

    studentsWithReach.forEach((s) => {
      const stage = getStageName(s.currentReach);
      if (quranLevels[stage] !== undefined) {
        quranLevels[stage]++;
      } else {
        quranLevels['غير محدد']++;
      }
    });

    // Compute effective attendance rate (if today is holiday and no attendance, don't penalize)
    const effectiveAttendanceRate = totalStudents > 0
      ? (isTodayHoliday && todayHistories.length === 0 ? 100 : Math.round((attendedCount / totalStudents) * 100))
      : 0;

    return {
      totalStudents,
      holidayDays,
      today: {
        isHoliday: isTodayHoliday,
        recordedCount: todayHistories.length,
        attendedCount,
        absentCount,
        memorizedCount,
        writtenCount,
        needsRevisionCount,
        attendanceRate: effectiveAttendanceRate,
        completionRate: attendedCount > 0 ? Math.round((memorizedCount / attendedCount) * 100) : 0,
      },
      weeklyTrend: Object.values(weeklyTrend),
      quranLevels: Object.entries(quranLevels).map(([level, count]) => ({ level, count })),
      recentActivities: recentActivities.map((a) => ({
        id: a.id,
        studentId: a.studentId,
        studentName: a.student?.name || '',
        studentSerial: a.student?.serialNumber || '',
        sheikhId: a.sheikhId || a.sheikh?.id || null,
        sheikhName: a.sheikhName || a.sheikh?.name || null,
        status: a.status,
        type: a.type,
        fromPart: a.fromPart,
        toPart: a.toPart,
        date: a.date,
        createdAt: a.createdAt,
      })),
    };
  }

  async recordAttendance(data: {
    studentId: number;
    date: string;
    status: string; // 'حاضر' | 'لم يحضر'
    sheikhId?: number;
    sheikhName?: string;
    notes?: string;
  }) {
    const targetDate = new Date(data.date);
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const existing = await this.prisma.history.findFirst({
      where: {
        studentId: data.studentId,
        date: { gte: startOfDay, lte: endOfDay },
      },
    });

    const resolvedType = (existing && existing.type && existing.type !== 'حضور') ? existing.type : 'حضور';

    return this.addHistory(data.studentId, {
      date: data.date,
      status: data.status,
      type: resolvedType,
      sheikhId: data.sheikhId,
      sheikhName: data.sheikhName,
      notes: data.notes,
    });
  }

  async bulkRecordAttendance(data: {
    date: string;
    studentIds: number[];
    status: string;
    sheikhId?: number;
    sheikhName?: string;
  }) {
    const results = [];
    for (const studentId of data.studentIds) {
      const res = await this.recordAttendance({
        studentId,
        date: data.date,
        status: data.status,
        sheikhId: data.sheikhId,
        sheikhName: data.sheikhName,
      });
      results.push(res);
    }
    return { count: results.length, success: true };
  }

  async resetAttendance(data: { date: string; studentIds?: number[] }) {
    const targetDate = new Date(data.date);
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const whereClause: any = {
      date: { gte: startOfDay, lte: endOfDay },
    };
    if (data.studentIds && data.studentIds.length > 0) {
      whereClause.studentId = { in: data.studentIds };
    }

    const deleted = await this.prisma.history.deleteMany({
      where: whereClause,
    });
    return { deletedCount: deleted.count, success: true };
  }
}

