import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectInvite } from './entities/project-invite.entity';
import { Project } from '../projects/entities/projects.entity';
import { User } from '../users/entities/user.entity';
import { InvitesService } from './invites.service';
import { InvitesController } from './invites.controller';
import { MembersModule } from '../members/members.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectInvite, Project, User]), MembersModule],
  controllers: [InvitesController],
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
