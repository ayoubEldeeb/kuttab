import { Module } from '@nestjs/common';
import { PortionsController } from './portions.controller.js';
import { PortionsService } from './portions.service.js';

@Module({ controllers: [PortionsController], providers: [PortionsService] })
export class PortionsModule {}
