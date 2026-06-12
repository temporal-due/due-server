import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Phase } from '../../phases/entities/phase.entity';

export interface ProjectPersonality {
  /** @deprecated style 컬럼으로 대체. additionalConsiderations만 보존한다. */
  preparationStyle?: string;
  additionalConsiderations: string;
}

export enum ProjectType {
  WEDDING = 'WEDDING',
  HOUSE = 'HOUSE',
  HONEYMOON = 'HONEYMOON',
  CHILD = 'CHILD',
  EXERCISE = 'EXERCISE',
  CUSTOM = 'CUSTOM',
}

export enum PreparationStyle {
  ALL_IN = 'ALL_IN',
  SAVE_MONEY = 'SAVE_MONEY',
  RECOMMEND = 'RECOMMEND',
}

export enum PlanLevel {
  DETAILED = 'DETAILED',
  OUTLINE = 'OUTLINE',
  MANUAL = 'MANUAL',
}

export enum ScheduleMode {
  FIXED = 'FIXED',
  FLEXIBLE = 'FLEXIBLE',
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  // type/style은 POST /projects가 아직 전송하지 않으므로 지금은 nullable.
  // 클라가 값을 보내기 시작하는 단계(suggest/생성 확장)에서 NOT NULL로 조인다.
  @Column({ type: 'enum', enum: ProjectType, nullable: true })
  type: ProjectType | null;

  @Column({ type: 'varchar' })
  projectName: string;

  @Column({ type: 'enum', enum: PreparationStyle, nullable: true })
  style: PreparationStyle | null;

  @Column({ type: 'enum', enum: PlanLevel, nullable: true })
  planLevel: PlanLevel | null;

  @Column({ type: 'enum', enum: ScheduleMode, default: ScheduleMode.FIXED })
  scheduleMode: ScheduleMode;

  // FLEXIBLE 일정이면 startDate 없이 dueDate만으로 운영 → nullable.
  @Column({ type: 'date', nullable: true })
  startDate: Date;

  @Column({ type: 'date' })
  dueDate: Date;

  // 기획 S5에 예산 입력 UI 없음 → 필수 해제.
  @Column({ type: 'int', nullable: true })
  budget: number;

  // S13/S14 대표 색상 (예: #FF8A65)
  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string | null;

  @Column({ type: 'jsonb' })
  personality: ProjectPersonality;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  owner: User;

  @OneToMany(() => Phase, (phase) => phase.project)
  phases: Phase[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
