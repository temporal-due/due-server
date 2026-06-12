import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMember } from './entities/project-member.entity';
import { MembersService } from './members.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectMember])],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
