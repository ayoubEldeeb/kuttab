import { Controller, Get, Post, Body } from '@nestjs/common';
import { SettingsService } from './settings.service.js';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getAll() {
    return this.settingsService.getAll();
  }

  @Post()
  update(@Body() data: Record<string, any>) {
    return this.settingsService.updateSettings(data);
  }
}
