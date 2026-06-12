import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProjectInvite, InviteStatus } from './entities/project-invite.entity';
import { ProjectMember, ProjectRole } from '../members/entities/project-member.entity';
import { MembersService } from '../members/members.service';
import { Project } from '../projects/entities/projects.entity';
import { User } from '../users/entities/user.entity';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';

@Injectable()
export class InvitesService {
  constructor(
    @InjectRepository(ProjectInvite)
    private readonly invitesRepository: Repository<ProjectInvite>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly membersService: MembersService,
    private readonly dataSource: DataSource,
  ) {}

  // I1: 초대 코드 발급. 멤버라면 누구나 가능.
  async createInvite(
    userId: string,
    projectId: number,
    dto: CreateInviteDto,
  ): Promise<{ code: string; message: string; expiresAt: Date }> {
    await this.membersService.assertMember(projectId, userId);

    const project = await this.projectsRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const code = await this.generateUniqueCode();
    const message =
      dto.message ?? `우리 ${project.projectName} 계획 세워봤어. 같이 해보자! 🎉`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const inviter = { id: userId } as User;
    const invite = this.invitesRepository.create({
      project,
      inviter,
      code,
      message,
      expiresAt,
      status: InviteStatus.PENDING,
    });
    const saved = await this.invitesRepository.save(invite);
    return { code: saved.code, message: saved.message!, expiresAt: saved.expiresAt };
  }

  // I2: 초대 코드 수락. 파트너로 등록.
  async acceptInvite(
    userId: string,
    dto: AcceptInviteDto,
  ): Promise<{ projectId: number; role: ProjectRole }> {
    const invite = await this.invitesRepository.findOne({
      where: { code: dto.code, status: InviteStatus.PENDING },
      relations: { project: true },
    });

    if (!invite || invite.expiresAt < new Date()) {
      throw new NotFoundException('Invalid or expired invite code');
    }

    const projectId = invite.project.id;

    // 이미 멤버인지 확인 (본인 프로젝트 포함)
    const existingMember = await this.dataSource
      .getRepository(ProjectMember)
      .findOne({ where: { project: { id: projectId }, user: { id: userId } } });
    if (existingMember) {
      throw new BadRequestException('Already a member of this project');
    }

    // 파트너 정원 확인 (프로젝트당 PARTNER 1명)
    const partnerCount = await this.dataSource
      .getRepository(ProjectMember)
      .count({ where: { project: { id: projectId }, role: ProjectRole.PARTNER } });
    if (partnerCount >= 1) {
      throw new BadRequestException('Partner slot is already taken');
    }

    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.save(
        manager.create(ProjectMember, {
          project: invite.project,
          user,
          role: ProjectRole.PARTNER,
        }),
      );
      invite.status = InviteStatus.ACCEPTED;
      await manager.save(invite);
    });

    return { projectId, role: ProjectRole.PARTNER };
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 8 }, () =>
      chars[Math.floor(Math.random() * chars.length)],
    ).join('');
  }

  private async generateUniqueCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const code = this.generateCode();
      const exists = await this.invitesRepository.findOne({ where: { code } });
      if (!exists) return code;
    }
    throw new BadRequestException('Failed to generate unique invite code');
  }
}
