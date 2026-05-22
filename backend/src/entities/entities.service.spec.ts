import { Test, TestingModule } from '@nestjs/testing';
import { EntitiesService } from './entities.service';
import { DatabaseService } from '../database/database.service';

function createQueryBuilder(rows: any[], countValue: number) {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    orderByRaw: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    count: jest.fn().mockResolvedValue([{ count: countValue }]),
    countDistinct: jest.fn().mockResolvedValue([{ total: countValue }]),
    then: (resolve: (value: any) => any) => Promise.resolve(rows).then(resolve),
  };
  return qb;
}

describe('EntitiesService', () => {
  let service: EntitiesService;
  let dbService: DatabaseService;

  const mockInsertReturning = jest.fn().mockResolvedValue([
    {
      id: '1',
      name: 'Death Star',
      status: 'active',
      critical_events_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);

  const mockKnex = Object.assign(
    jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnValue({
        returning: mockInsertReturning,
      }),
    }),
    { raw: jest.fn().mockImplementation((sql: string) => sql) },
  );

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntitiesService,
        {
          provide: DatabaseService,
          useValue: { db: mockKnex },
        },
      ],
    }).compile();

    service = module.get<EntitiesService>(EntitiesService);
    dbService = module.get<DatabaseService>(DatabaseService);
  });

  describe('create', () => {
    it('should insert a new entity with active status and zero critical events', async () => {
      const dto = { name: 'Death Star' };
      const result = await service.create(dto);

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
      expect(result.name).toBe('Death Star');
      expect(result.status).toBe('active');
      expect(result.critical_events_count).toBe(0);
      expect(mockKnex).toHaveBeenCalledWith('entities');
    });
  });

  describe('getAllEntities', () => {
    it('should return paginated entities without filters', async () => {
      const mockRows = [
        {
          id: '1',
          name: 'Tatooine',
          status: 'active',
          critical_events_count: 0,
          total_events: 5,
          last_event_at: new Date(),
        },
        {
          id: '2',
          name: 'Alderaan',
          status: 'suspended',
          critical_events_count: 3,
          total_events: 10,
          last_event_at: new Date(),
        },
      ];
      const qb = createQueryBuilder(mockRows, 2);
      mockKnex.mockReturnValue(qb);

      const result = await service.getAllEntities(1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter by search query using ILIKE', async () => {
      const qb = createQueryBuilder([], 0);
      mockKnex.mockReturnValue(qb);

      await service.getAllEntities(1, 10, 'Tatooine');

      expect(qb.where).toHaveBeenCalledWith('e.name', 'ILIKE', '%Tatooine%');
    });

    it('should filter by status', async () => {
      const qb = createQueryBuilder([], 0);
      mockKnex.mockReturnValue(qb);

      await service.getAllEntities(1, 10, undefined, 'suspended');

      expect(qb.where).toHaveBeenCalledWith('e.status', 'suspended');
    });

    it('should apply pagination offset correctly for page 2', async () => {
      const qb = createQueryBuilder([], 0);
      mockKnex.mockReturnValue(qb);

      await service.getAllEntities(2, 5);

      expect(qb.limit).toHaveBeenCalledWith(5);
      expect(qb.offset).toHaveBeenCalledWith(5);
    });
  });

  describe('getEntitiesWithCriticalEvents', () => {
    it('should return entities with critical events from last 7 days', async () => {
      const mockRows = [
        {
          id: '1',
          name: 'Death Star',
          status: 'suspended',
          critical_events_count: 5,
          recent_events: [
            {
              id: 'e1',
              entity_id: '1',
              external_id: 'ext-1',
              type: 'critical',
              payload: '{}',
              created_at: new Date(),
            },
          ],
        },
      ];
      const qb = createQueryBuilder(mockRows, 1);
      mockKnex.mockReturnValue(qb);

      const result = await service.getEntitiesWithCriticalEvents(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Death Star');
      expect(result.data[0].recent_events).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(qb.innerJoin).toHaveBeenCalledWith(
        'events as ev',
        'ev.entity_id',
        'e.id',
      );
    });
  });
});
