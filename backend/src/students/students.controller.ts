import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { StudentsService } from './students.service.js';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  create(@Body() createStudentDto: { name: string; guardianName?: string; guardianPhone?: string; currentReach?: string }) {
    return this.studentsService.create(createStudentDto);
  }

  @Get()
  findAll(@Query('date') date?: string) {
    return this.studentsService.findAll(date);
  }

  @Get('dashboard/stats')
  getDashboardStats() {
    return this.studentsService.getDashboardStats();
  }

  @Post('attendance/record')
  recordAttendance(@Body() body: {
    studentId: number;
    date: string;
    status: string;
    sheikhId?: number;
    sheikhName?: string;
    notes?: string;
  }) {
    return this.studentsService.recordAttendance(body);
  }

  @Post('attendance/bulk')
  bulkAttendance(@Body() body: {
    date: string;
    studentIds: number[];
    status: string;
    sheikhId?: number;
    sheikhName?: string;
  }) {
    return this.studentsService.bulkRecordAttendance(body);
  }

  @Post('attendance/reset')
  resetAttendance(@Body() body: { date: string; studentIds?: number[] }) {
    return this.studentsService.resetAttendance(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.studentsService.findOne(+id);
  }

  @Get(':id/report')
  getReport(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.studentsService.getStudentReport(+id, startDate, endDate);
  }

  @Post(':id/history')
  addHistory(
    @Param('id') id: string, 
    @Body() data: { 
      status: string; 
      notes?: string; 
      date?: string;
      type?: string;
      fromPart?: string;
      toPart?: string;
      writtenParts?: string;
      sheikhId?: number;
      sheikhName?: string;
      nextReviewDate?: string;
      nextReviewFrom?: string;
      nextReviewTo?: string;
    }
  ) {
    return this.studentsService.addHistory(+id, data);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateData: { name?: string; guardianName?: string; guardianPhone?: string; currentReach?: string; currentRevisionFrom?: string; currentRevisionTo?: string; }) {
    return this.studentsService.update(+id, updateData);
  }
}
