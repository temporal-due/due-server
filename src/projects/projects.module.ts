import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { Project } from './entities/projects.entity';
import { User } from '../users/entities/user.entity';
import { PhasesModule } from '../phases/phases.module';

@Module({
  imports: [TypeOrmModule.forFeature([Project, User]), PhasesModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
