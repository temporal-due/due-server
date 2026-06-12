import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { InvitesService } from './invites.service';
import { AcceptInviteDto } from './dto/accept-invite.dto';

@ApiTags('Invites')
@ApiBearerAuth('access-token')
@Controller('invites')
@UseGuards(JwtAuthGuard)
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  // I2: 초대 코드로 파트너 참여
  @Post('accept')
  acceptInvite(@CurrentUser() user: User, @Body() dto: AcceptInviteDto) {
    return this.invitesService.acceptInvite(user.id, dto);
  }
}
