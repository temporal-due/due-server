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
