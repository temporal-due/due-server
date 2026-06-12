import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { PhasesService } from './phases.service';
import { TasksService } from '../tasks/tasks.service';
import { UpdatePhaseOrderDto } from './dto/update-phase-order.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { CreateTaskRequestDto } from '../tasks/dto/create-task-request.dto';

@ApiTags('Phases')
@ApiBearerAuth('access-token')
@Controller('phases')
@UseGuards(JwtAuthGuard)
export class PhasesController {
  constructor(
    private readonly phasesService: PhasesService,
    private readonly tasksService: TasksService,
  ) {}

  // PH2: 듀 수정 모달
  @Patch(':phaseId')
  updatePhase(
    @CurrentUser() user: User,
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Body() dto: UpdatePhaseDto,
  ) {
    return this.phasesService.updatePhase(user.id, phaseId, dto);
  }

  // PH3: 듀 삭제
  @Delete(':phaseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePhase(
    @CurrentUser() user: User,
    @Param('phaseId', ParseIntPipe) phaseId: number,
  ) {
    return this.phasesService.deletePhase(user.id, phaseId);
  }

  // PH4: 정렬(기존 유지)
  @Patch(':phaseId/order')
  updateOrder(
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Body() dto: UpdatePhaseOrderDto,
  ) {
    return this.phasesService.updateOrder(phaseId, dto.order);
  }

  // T1: 새로운 항목 추가하기
  @Post(':phaseId/tasks')
  createTask(
    @CurrentUser() user: User,
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Body() dto: CreateTaskRequestDto,
  ) {
    return this.tasksService.createTask(user.id, phaseId, dto);
  }
}
