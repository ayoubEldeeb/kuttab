import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { StudentsService } from './students.service.js';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  create(@Body() createStudentDto: { name: string; guardianName?: string; guardianPhone?: string; currentReach?: string }) {
    return this.studentsService.create(createStudentDto);
  }

  @Get()
  findAll() {
    return this.studentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.studentsService.findOne(+id);
  }

  @Post(':id/history')
  addHistory(@Param('id') id: string, @Body() data: { status: string; notes?: string; date?: string }) {
    return this.studentsService.addHistory(+id, data);
  }
}
