import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class DashboardQueryDto {
  @ApiPropertyOptional({ enum: ['role', 'due'], default: 'role',
    description: 'role: assignee별 그룹 / due: Phase(듀)별 그룹' })
  @IsOptional()
  @IsIn(['role', 'due'])
  groupBy?: 'role' | 'due' = 'role';

  @ApiPropertyOptional({ enum: ['task', 'schedule'], default: 'task',
    description: 'task: 전체 Task / schedule: dueDate 있는 Task만 날짜순' })
  @IsOptional()
  @IsIn(['task', 'schedule'])
  filter?: 'task' | 'schedule' = 'task';
}
