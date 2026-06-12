import { ApiProperty } from '@nestjs/swagger';
import { ProjectType } from '../entities/projects.entity';

export class ProjectTypeResponseDto {
  @ApiProperty({ enum: ProjectType, example: ProjectType.WEDDING })
  type: ProjectType;

  @ApiProperty({ example: '결혼식' })
  label: string;

  @ApiProperty({ example: true, description: 'false면 클라가 🔒 잠금 표시' })
  available: boolean;

  @ApiProperty({ example: '#FF8A65' })
  defaultColor: string;
}
