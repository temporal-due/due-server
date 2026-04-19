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
  preparationStyle: string;
  additionalConsiderations: string;
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  projectName: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  dueDate: Date;

  @Column({ type: 'int' })
  budget: number;

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
