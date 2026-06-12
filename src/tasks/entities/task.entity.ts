import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Phase } from '../../phases/entities/phase.entity';

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

export enum TaskAssignee {
  OWNER = 'OWNER',
  PARTNER = 'PARTNER',
  TOGETHER = 'TOGETHER',
  UNASSIGNED = 'UNASSIGNED',
}

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  name: string;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.TODO,
  })
  status: TaskStatus;

  @Column({ type: 'int' })
  order: number;

  // S12 배정 칩(나/파트너/함께/미배정)
  @Column({ type: 'enum', enum: TaskAssignee, default: TaskAssignee.UNASSIGNED })
  assignee: TaskAssignee;

  // S13 항목별 마감일
  @Column({ type: 'date', nullable: true })
  dueDate: Date | null;

  @ManyToOne(() => Phase, (phase) => phase.tasks, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  phase: Phase;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
