import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ProjectsService } from './projects.service';
import { Project } from './entities/projects.entity';
import { PhasesService } from '../phases/phases.service';
import { encodeCursor } from '../common/utils/cursor.util';

const makeProject = (overrides: Partial<Project> = {}): Project =>
  ({
    id: 1,
    projectName: 'Test Project',
    startDate: new Date('2026-01-01'),
    dueDate: new Date('2026-06-30'),
    budget: 1000000,
    personality: { preparationStyle: 'systematic', additionalConsiderations: '' },
    owner: { id: 'user-uuid' },
    phases: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as Project);

describe('ProjectsService', () => {
  let service: ProjectsService;
  let mockProjectRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let mockDataSource: { transaction: jest.Mock };
  let mockPhasesService: { createManyInTransaction: jest.Mock };
  let mockQb: {
    leftJoin: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    take: jest.Mock;
    getMany: jest.Mock;
  };

  beforeEach(async () => {
    mockQb = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };
    mockProjectRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    };
    mockDataSource = { transaction: jest.fn() };
    mockPhasesService = { createManyInTransaction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getRepositoryToken(Project), useValue: mockProjectRepository },
        { provide: DataSource, useValue: mockDataSource },
        { provide: PhasesService, useValue: mockPhasesService },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  describe('listProjects', () => {
    it('결과가 limit보다 많으면 hasMore=true, nextCursor 설정', async () => {
      const projects = [makeProject({ id: 3 }), makeProject({ id: 2 }), makeProject({ id: 1 })];
      mockQb.getMany.mockResolvedValue(projects);

      const result = await service.listProjects('user-uuid', { limit: 2 });

      expect(result.hasMore).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.nextCursor).toBe(encodeCursor(2));
    });

    it('결과가 limit 이하면 hasMore=false, nextCursor=null', async () => {
      mockQb.getMany.mockResolvedValue([makeProject({ id: 1 })]);

      const result = await service.listProjects('user-uuid', { limit: 20 });

      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('cursor 제공 시 andWhere로 id 필터링', async () => {
      mockQb.getMany.mockResolvedValue([]);
      const cursor = encodeCursor(5);

      await service.listProjects('user-uuid', { cursor, limit: 10 });

      expect(mockQb.andWhere).toHaveBeenCalledWith('project.id < :cursorId', { cursorId: 5 });
    });

    it('잘못된 cursor 시 BadRequestException', async () => {
      await expect(
        service.listProjects('user-uuid', { cursor: 'invalid!!', limit: 10 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createProject', () => {
    const dto = {
      projectName: 'New Project',
      startDate: '2026-01-01',
      dueDate: '2026-06-30',
      budget: 500000,
      personality: { preparationStyle: 'systematic', additionalConsiderations: '' },
      phases: [],
    };

    it('startDate > dueDate 시 BadRequestException (트랜잭션 진입 전)', async () => {
      await expect(
        service.createProject('user-uuid', { ...dto, startDate: '2026-12-01', dueDate: '2026-01-01' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('정상 호출 시 dataSource.transaction 실행', async () => {
      const created = makeProject();
      mockDataSource.transaction.mockResolvedValue(created);

      const result = await service.createProject('user-uuid', dto);

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(result).toEqual(created);
    });
  });

  describe('updateProject', () => {
    it('정상 수정 시 저장된 프로젝트 반환', async () => {
      const project = makeProject();
      mockProjectRepository.findOne.mockResolvedValue(project);
      mockProjectRepository.save.mockResolvedValue({ ...project, projectName: '수정됨' });

      const result = await service.updateProject('user-uuid', 1, { projectName: '수정됨' });

      expect(result.projectName).toBe('수정됨');
      expect(mockProjectRepository.save).toHaveBeenCalled();
    });

    it('프로젝트 없음 시 NotFoundException', async () => {
      mockProjectRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProject('user-uuid', 999, { projectName: '수정됨' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('소유자 불일치 시 ForbiddenException', async () => {
      mockProjectRepository.findOne.mockResolvedValue(makeProject({ owner: { id: 'other-user' } as any }));

      await expect(
        service.updateProject('user-uuid', 1, { projectName: '수정됨' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('기존 startDate와 새 dueDate 조합이 역전되면 BadRequestException', async () => {
      const project = makeProject({ startDate: new Date('2026-06-01') });
      mockProjectRepository.findOne.mockResolvedValue(project);

      await expect(
        service.updateProject('user-uuid', 1, { dueDate: '2026-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('일부 필드만 제공 시 해당 필드만 수정', async () => {
      const project = makeProject();
      mockProjectRepository.findOne.mockResolvedValue(project);
      mockProjectRepository.save.mockImplementation(async (p) => p);

      await service.updateProject('user-uuid', 1, { budget: 9999 });

      expect(mockProjectRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ budget: 9999, projectName: 'Test Project' }),
      );
    });
  });
});
