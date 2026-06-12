import { ProjectType } from './entities/projects.entity';

export interface ProjectTypeCatalogItem {
  type: ProjectType;
  label: string;
  available: boolean;
  defaultColor: string;
}

/**
 * S3 프로젝트 종류 선택 카탈로그.
 * MVP는 WEDDING과 CUSTOM만 available:true, 나머지는 잠금(🔒) 표시용 false.
 * 별도 엔티티 없이 정적 상수로 관리한다.
 */
export const PROJECT_TYPE_CATALOG: ProjectTypeCatalogItem[] = [
  { type: ProjectType.WEDDING, label: '결혼식', available: true, defaultColor: '#FF8A65' },
  { type: ProjectType.HOUSE, label: '내 집 마련', available: false, defaultColor: '#4FC3F7' },
  { type: ProjectType.HONEYMOON, label: '신혼여행', available: false, defaultColor: '#81C784' },
  { type: ProjectType.CHILD, label: '출산·육아', available: false, defaultColor: '#FFD54F' },
  { type: ProjectType.EXERCISE, label: '운동·건강', available: false, defaultColor: '#BA68C8' },
  { type: ProjectType.CUSTOM, label: '나만의 프로젝트', available: true, defaultColor: '#90A4AE' },
];
