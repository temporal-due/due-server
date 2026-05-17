export const PROJECT_SUGGEST_PROVIDER = 'PROJECT_SUGGEST_PROVIDER';

export interface SuggestProjectInput {
  dueDate: string;
  preparationStyle: string;
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
  startDate: string;
  dueDate: string;
  budget: number;
  personality: {
    preparationStyle: string;
    additionalConsiderations: string;
  };
  phases: SuggestPhaseOutput[];
}

export interface ProjectSuggestProvider {
  suggest(input: SuggestProjectInput): Promise<SuggestProjectOutput>;
}
