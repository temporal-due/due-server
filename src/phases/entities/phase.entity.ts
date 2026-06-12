import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/projects.entity';
import { Task } from '../../tasks/entities/task.entity';

@Entity('phases')
export class Phase {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'date' })
  expectedStartDate: Date;

  @Column({ type: 'date' })
  expectedEndDate: Date;

  @Column({ type: 'int' })
  order: number;

  // S14 듀 수정 모달 "메모를 입력하세요"
  @Column({ type: 'text', nullable: true })
  memo: string | null;

  // S14 Phase 추가 시 색상 (예: #FFB74D)
  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string | null;

  @ManyToOne(() => Project, (project) => project.phases, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  project: Project;

  @OneToMany(() => Task, (task) => task.phase)
  tasks: Task[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
