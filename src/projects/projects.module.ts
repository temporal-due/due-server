import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsService } from './projects.service';
import { ProjectSuggestService } from './project-suggest.service';
import { ProjectsController } from './projects.controller';
import { ProjectTypesController } from './project-types.controller';
import { Project } from './entities/projects.entity';
import { User } from '../users/entities/user.entity';
import { PhasesModule } from '../phases/phases.module';
import { AiModule } from '../ai/ai.module';
import { MembersModule } from '../members/members.module';
import { InvitesModule } from '../invites/invites.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, User]),
    PhasesModule,
    AiModule,
    MembersModule,
    InvitesModule,
  ],
  controllers: [ProjectsController, ProjectTypesController],
  providers: [ProjectsService, ProjectSuggestService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
