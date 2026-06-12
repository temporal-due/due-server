import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SuggestTaskResponseDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ['TODO'] })
  status: 'TODO';

  @ApiProperty()
  order: number;
}

export class SuggestPhaseResponseDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ example: '2026-05-01' })
  expectedStartDate: string;

  @ApiProperty({ example: '2026-05-31' })
  expectedEndDate: string;

  @ApiProperty()
  order: number;

  @ApiProperty({ type: () => [SuggestTaskResponseDto] })
  tasks: SuggestTaskResponseDto[];
}

export class SuggestProjectResponseDto {
  @ApiProperty()
  projectName: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  startDate?: string;

  @ApiProperty({ example: '2026-12-31' })
  dueDate: string;

  @ApiPropertyOptional({ description: '예산 추천값 (KRW)' })
  budget?: number;

  @ApiProperty({ type: () => [SuggestPhaseResponseDto] })
  phases: SuggestPhaseResponseDto[];
}
