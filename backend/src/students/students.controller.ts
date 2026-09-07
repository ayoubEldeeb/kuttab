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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.studentsService.findOne(+id);
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
