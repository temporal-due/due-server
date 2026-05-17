import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsService } from './projects.service';
import { ProjectSuggestService } from './project-suggest.service';
import { ProjectsController } from './projects.controller';
import { Project } from './entities/projects.entity';
import { User } from '../users/entities/user.entity';
import { PhasesModule } from '../phases/phases.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [TypeOrmModule.forFeature([Project, User]), PhasesModule, AiModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectSuggestService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
