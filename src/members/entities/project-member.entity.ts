import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Project } from '../../projects/entities/projects.entity';
import { User } from '../../users/entities/user.entity';

export enum ProjectRole {
  OWNER = 'OWNER',
  PARTNER = 'PARTNER',
}

@Entity('project_members')
@Unique(['project', 'user'])
export class ProjectMember {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Project, { nullable: false, onDelete: 'CASCADE' })
  project: Project;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'enum', enum: ProjectRole })
  role: ProjectRole;

  @CreateDateColumn()
  joinedAt: Date;
}
