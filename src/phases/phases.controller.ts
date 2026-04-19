import { Body, Controller, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PhasesService } from './phases.service';
import { UpdatePhaseOrderDto } from './dto/update-phase-order.dto';

@Controller('phases')
@UseGuards(JwtAuthGuard)
export class PhasesController {
  constructor(private readonly phasesService: PhasesService) {}

  @Patch(':phaseId/order')
  updateOrder(
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Body() dto: UpdatePhaseOrderDto,
  ) {
    return this.phasesService.updateOrder(phaseId, dto.order);
  }
}
