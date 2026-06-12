import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Phase } from './entities/phase.entity';
import { Project } from '../projects/entities/projects.entity';
import { PhasesService } from './phases.service';
import { PhasesController } from './phases.controller';
import { TasksModule } from '../tasks/tasks.module';
import { MembersModule } from '../members/members.module';

@Module({
  imports: [TypeOrmModule.forFeature([Phase, Project]), TasksModule, MembersModule],
  controllers: [PhasesController],
  providers: [PhasesService],
  exports: [PhasesService],
})
export class PhasesModule {}
