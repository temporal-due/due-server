import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectMember, ProjectRole } from './entities/project-member.entity';

@Injectable()
export class MembersService {
  constructor(
    @InjectRepository(ProjectMember)
    private readonly membersRepository: Repository<ProjectMember>,
  ) {}

  // 멤버 여부 검증. 비멤버는 ForbiddenException, requireOwner=true면 OWNER 아닌 경우도 ForbiddenException.
  async assertMember(
    projectId: number,
    userId: string,
    requireOwner = false,
  ): Promise<ProjectMember> {
    const member = await this.membersRepository.findOne({
      where: { project: { id: projectId }, user: { id: userId } },
    });
    if (!member) {
      throw new ForbiddenException('Access denied');
    }
    if (requireOwner && member.role !== ProjectRole.OWNER) {
      throw new ForbiddenException('Access denied');
    }
    return member;
  }

  // 해당 유저가 멤버인 프로젝트 ID 목록 반환. listProjects 쿼리용.
  async getProjectIdsForUser(userId: string): Promise<number[]> {
    const rows = await this.membersRepository
      .createQueryBuilder('pm')
      .leftJoin('pm.project', 'project')
      .leftJoin('pm.user', 'u')
      .select('project.id', 'id')
      .where('u.id = :userId', { userId })
      .getRawMany<{ id: number }>();
    return rows.map((r) => Number(r.id));
  }

  // I3: 프로젝트 멤버 목록.
  async listMembers(
    projectId: number,
  ): Promise<{ userId: string; nickname: string | null; role: ProjectRole }[]> {
    const members = await this.membersRepository.find({
      where: { project: { id: projectId } },
      relations: { user: true },
    });
    return members.map((m) => ({
      userId: m.user.id,
      nickname: m.user.nickname,
      role: m.role,
    }));
  }

  // I4: OWNER만 호출 가능 (컨트롤러에서 assertMember(requireOwner=true) 선행). OWNER 제거는 불가.
  async removeMember(projectId: number, targetUserId: string): Promise<void> {
    const member = await this.membersRepository.findOne({
      where: { project: { id: projectId }, user: { id: targetUserId } },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    if (member.role === ProjectRole.OWNER) {
      throw new BadRequestException('Cannot remove the project owner');
    }
    await this.membersRepository.remove(member);
  }
}
