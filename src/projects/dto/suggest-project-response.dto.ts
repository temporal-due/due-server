import { ApiProperty } from '@nestjs/swagger';

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

export class SuggestProjectPersonalityResponseDto {
  @ApiProperty()
  preparationStyle: string;

  @ApiProperty()
  additionalConsiderations: string;
}

export class SuggestProjectResponseDto {
  @ApiProperty()
  projectName: string;

  @ApiProperty({ example: '2026-05-01' })
  startDate: string;

  @ApiProperty({ example: '2026-08-31' })
  dueDate: string;

  @ApiProperty()
  budget: number;

  @ApiProperty({ type: () => SuggestProjectPersonalityResponseDto })
  personality: SuggestProjectPersonalityResponseDto;

  @ApiProperty({ type: () => [SuggestPhaseResponseDto] })
  phases: SuggestPhaseResponseDto[];
}
