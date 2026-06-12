export const PROJECT_SUGGEST_PROVIDER = 'PROJECT_SUGGEST_PROVIDER';

export interface SuggestProjectInput {
  type: string;
  projectName?: string;
  startDate?: string;
  dueDate: string;
  scheduleMode?: string;
  style: string;
  planLevel?: string;
  additionalConsiderations?: string;
}

export interface SuggestTaskOutput {
  name: string;
  status: 'TODO';
  order: number;
}

export interface SuggestPhaseOutput {
  name: string;
  expectedStartDate: string;
  expectedEndDate: string;
  order: number;
  tasks: SuggestTaskOutput[];
}

export interface SuggestProjectOutput {
  projectName: string;
  startDate?: string;
  dueDate: string;
  budget?: number;
  phases: SuggestPhaseOutput[];
}

export interface ProjectSuggestProvider {
  suggest(input: SuggestProjectInput): Promise<SuggestProjectOutput>;
}
