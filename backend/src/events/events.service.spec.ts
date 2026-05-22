import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EventsService } from './events.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../database/redis.service';
import { EntitySuspendedException } from '../entities/exceptions/entity-suspended.exception';
import { LightweightEventRecord } from './events.types';

describe('EventsService', () => {
  let service: EventsService;
  let redisService: RedisService;
  let dbService: DatabaseService;

  const mockRedisSet = jest.fn();
  const mockRedisDel = jest.fn();
  const mockGetOrSet = jest.fn();

  const mockRedisService = {
    client: {
      set: mockRedisSet,
      del: mockRedisDel,
    },
    getOrSet: mockGetOrSet,
  };

  const mockTransaction = jest.fn();

  const ENTITY_DEFAULT = Symbol('ENTITY_DEFAULT');

  function buildTrxMock(overrides: {
    entityFirstResult?: any | typeof ENTITY_DEFAULT;
    entityUpdate?: jest.Mock;
    eventReturning?: any;
    insertRejectError?: Error & { code?: string };
  }) {
    const entityUpdate =
      overrides.entityUpdate || jest.fn().mockResolvedValue(1);

    const entityFirstResult =
      overrides.entityFirstResult !== undefined
        ? overrides.entityFirstResult
        : { id: '10', status: 'active', critical_events_count: 1 };

    const trx = Object.assign(
      jest.fn().mockImplementation((table) => {
        if (table === 'entities') {
          return {
            where: jest.fn().mockReturnThis(),
            forUpdate: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue(entityFirstResult),
            update: entityUpdate,
          };
        }
        if (table === 'events') {
          const returningMock = overrides.insertRejectError
            ? jest.fn().mockRejectedValue(overrides.insertRejectError)
            : jest.fn().mockResolvedValue(
                overrides.eventReturning ?? [
                  {
                    id: '5',
                    entity_id: '10',
                    external_id: 'ext-123',
                    type: 'info',
                    payload: '{"data":"test"}',
                    created_at: new Date(),
                  },
                ],
              );
          return {
            insert: jest.fn().mockReturnThis(),
            returning: returningMock,
          };
        }
        return {};
      }),
      { fn: { now: () => 'now' } },
    );
    return { trx, entityUpdate };
  }

  const mockDatabaseService = {
    db: Object.assign(
      jest.fn().mockImplementation((table) => {
        if (table === 'events') {
          return {
            where: jest.fn().mockReturnThis(),
            first: jest.fn(),
          };
        }
        if (table === 'entities') {
          return {
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              id: '10',
              status: 'active',
              critical_events_count: 0,
            }),
          };
        }
        return {};
      }),
      {
        transaction: mockTransaction,
      },
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    redisService = module.get<RedisService>(RedisService);
    dbService = module.get<DatabaseService>(DatabaseService);

    process.env.CRITICAL_EVENTS_LIMIT = '3';
  });

  describe('registerEvent', () => {
    it('should return cached event directly if idempotency hit (Redis)', async () => {
      const mockCachedEvent = {
        id: '1',
        entity_id: '10',
        external_id: 'ext-123',
      };
      mockGetOrSet.mockResolvedValue(mockCachedEvent);

      const result = await service.registerEvent({
        entity_id: '10',
        external_id: 'ext-123',
        type: 'info',
        payload: { data: 'test' },
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
      expect(
        (result as LightweightEventRecord & { is_duplicate: boolean })
          .is_duplicate,
      ).toBe(true);
      expect(mockGetOrSet).toHaveBeenCalledWith(
        'event:external_id:ext-123',
        86400,
        expect.any(Function),
      );
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should reject immediately if cached entity is suspended', async () => {
      mockGetOrSet.mockResolvedValueOnce(null);
      mockGetOrSet.mockResolvedValueOnce({
        status: 'suspended',
        critical_events_count: 3,
      });

      await expect(
        service.registerEvent({
          entity_id: '10',
          external_id: 'ext-123',
          type: 'info',
          payload: { data: 'test' },
        }),
      ).rejects.toThrow(EntitySuspendedException);

      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if cached entity does not exist', async () => {
      mockGetOrSet.mockResolvedValueOnce(null);
      mockGetOrSet.mockResolvedValueOnce(null);

      await expect(
        service.registerEvent({
          entity_id: '999',
          external_id: 'ext-nonexistent',
          type: 'info',
          payload: { data: 'test' },
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should reject if transaction detects entity is suspended (race condition)', async () => {
      mockGetOrSet.mockResolvedValueOnce(null);
      mockGetOrSet.mockResolvedValueOnce({
        status: 'active',
        critical_events_count: 0,
      });
      const { trx } = buildTrxMock({
        entityFirstResult: {
          id: '10',
          status: 'suspended',
          critical_events_count: 3,
        },
      });
      mockTransaction.mockImplementation((callback) => callback(trx));

      await expect(
        service.registerEvent({
          entity_id: '10',
          external_id: 'ext-123',
          type: 'info',
          payload: { data: 'test' },
        }),
      ).rejects.toThrow(EntitySuspendedException);
    });

    it('should throw NotFoundException if entity is not found in transaction', async () => {
      mockGetOrSet.mockResolvedValueOnce(null);
      mockGetOrSet.mockResolvedValueOnce({
        status: 'active',
        critical_events_count: 0,
      });
      const trx = Object.assign(
        jest.fn().mockImplementation((table) => {
          if (table === 'entities') {
            return {
              where: jest.fn().mockReturnThis(),
              forUpdate: jest.fn().mockReturnThis(),
              first: jest.fn().mockResolvedValue(undefined),
              update: jest.fn(),
            };
          }
          if (table === 'events') {
            return {
              insert: jest.fn().mockReturnThis(),
              returning: jest.fn().mockResolvedValue([]),
            };
          }
          return {};
        }),
        { fn: { now: () => 'now' } },
      );
      mockTransaction.mockImplementation((callback) => callback(trx));

      await expect(
        service.registerEvent({
          entity_id: '999',
          external_id: 'ext-123',
          type: 'info',
          payload: { data: 'test' },
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should successfully register a non-critical event and NOT update entity counts', async () => {
      mockGetOrSet.mockResolvedValueOnce(null);
      mockGetOrSet.mockResolvedValueOnce({
        status: 'active',
        critical_events_count: 1,
      });
      const entityUpdate = jest.fn().mockResolvedValue(1);
      const { trx } = buildTrxMock({
        entityFirstResult: {
          id: '10',
          status: 'active',
          critical_events_count: 1,
        },
        entityUpdate,
        eventReturning: [
          {
            id: '5',
            entity_id: '10',
            external_id: 'ext-123',
            type: 'info',
            payload: '{"data":"test"}',
            created_at: new Date(),
          },
        ],
      });
      mockTransaction.mockImplementation((callback) => callback(trx));

      const result = await service.registerEvent({
        entity_id: '10',
        external_id: 'ext-123',
        type: 'info',
        payload: { data: 'test' },
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('5');
      expect(entityUpdate).not.toHaveBeenCalled();
      expect(mockRedisSet).toHaveBeenCalledWith(
        'event:external_id:ext-123',
        expect.any(String),
        'EX',
        86400,
      );
      expect(mockRedisDel).toHaveBeenCalledWith('entity:10');
    });

    it('should increment critical count but keep entity active when below limit', async () => {
      mockGetOrSet.mockResolvedValueOnce(null);
      mockGetOrSet.mockResolvedValueOnce({
        status: 'active',
        critical_events_count: 1,
      });
      const entityUpdate = jest.fn().mockResolvedValue(1);
      const { trx } = buildTrxMock({
        entityFirstResult: {
          id: '10',
          status: 'active',
          critical_events_count: 1,
        },
        entityUpdate,
        eventReturning: [
          {
            id: '6',
            entity_id: '10',
            external_id: 'ext-warn',
            type: 'critical',
            payload: '{"level":"high"}',
            created_at: new Date(),
          },
        ],
      });
      mockTransaction.mockImplementation((callback) => callback(trx));

      const result = await service.registerEvent({
        entity_id: '10',
        external_id: 'ext-warn',
        type: 'critical',
        payload: { level: 'high' },
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('6');
      expect(entityUpdate).toHaveBeenCalledWith({
        critical_events_count: 2,
        status: 'active',
        updated_at: 'now',
      });
    });

    it('should increment count and auto-suspend when critical limit is reached', async () => {
      mockGetOrSet.mockResolvedValueOnce(null);
      mockGetOrSet.mockResolvedValueOnce({
        status: 'active',
        critical_events_count: 2,
      });
      const entityUpdate = jest.fn().mockResolvedValue(1);
      const { trx } = buildTrxMock({
        entityFirstResult: {
          id: '10',
          status: 'active',
          critical_events_count: 2,
        },
        entityUpdate,
        eventReturning: [
          {
            id: '7',
            entity_id: '10',
            external_id: 'ext-critical',
            type: 'critical',
            payload: '{"data":"threat"}',
            created_at: new Date(),
          },
        ],
      });
      mockTransaction.mockImplementation((callback) => callback(trx));

      const result = await service.registerEvent({
        entity_id: '10',
        external_id: 'ext-critical',
        type: 'critical',
        payload: { data: 'threat' },
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('7');
      expect(entityUpdate).toHaveBeenCalledWith({
        critical_events_count: 3,
        status: 'suspended',
        updated_at: 'now',
      });
      expect(mockRedisDel).toHaveBeenCalledWith('entity:10');
    });

    it('should handle duplicate key violation during transaction and return existing event', async () => {
      mockGetOrSet.mockResolvedValueOnce(null);
      mockGetOrSet.mockResolvedValueOnce({
        status: 'active',
        critical_events_count: 1,
      });
      const pgError = new Error('duplicate key') as Error & { code: string };
      pgError.code = '23505';
      const { trx } = buildTrxMock({ insertRejectError: pgError });
      mockTransaction.mockImplementation((callback) => callback(trx));

      mockGetOrSet.mockResolvedValue({
        id: 'existing-1',
        entity_id: '10',
        external_id: 'ext-dup',
      });

      const result = await service.registerEvent({
        entity_id: '10',
        external_id: 'ext-dup',
        type: 'critical',
        payload: { data: 'dup' },
      });

      expect(
        (result as LightweightEventRecord & { is_duplicate: boolean })
          .is_duplicate,
      ).toBe(true);
      expect(result.id).toBe('existing-1');
    });
  });

  describe('getRecentEvents', () => {
    function mockDbForEvents(returnedRows: any[], totalCount: number) {
      const countFn = jest.fn().mockResolvedValue([{ count: totalCount }]);
      const whereFn = jest.fn().mockReturnThis();
      const queryBuilder = {
        where: whereFn,
        count: countFn,
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        then: (resolve: (v: any) => any) =>
          Promise.resolve(returnedRows).then(resolve),
      };

      const dbMock = Object.assign(
        jest.fn().mockImplementation(() => queryBuilder),
        { transaction: mockTransaction },
      );

      (dbService as any).db = dbMock;
      return queryBuilder;
    }

    it('should return paginated events with default parameters', async () => {
      const mockRows = [
        {
          id: 1,
          entity_id: '10',
          external_id: 'ext-1',
          type: 'info',
          payload: '{}',
          created_at: new Date(),
        },
        {
          id: 2,
          entity_id: '11',
          external_id: 'ext-2',
          type: 'critical',
          payload: '{}',
          created_at: new Date(),
        },
      ];
      const qb = mockDbForEvents(mockRows, 10);

      const result = await service.getRecentEvents(1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(10);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter events by entity_id and type', async () => {
      const mockRows = [
        {
          id: 3,
          entity_id: '10',
          external_id: 'ext-3',
          type: 'critical',
          payload: '{}',
          created_at: new Date(),
        },
      ];
      const qb = mockDbForEvents(mockRows, 1);

      await service.getRecentEvents(1, 10, '10', 'critical');

      expect(qb.where).toHaveBeenCalledWith('entity_id', '10');
      expect(qb.where).toHaveBeenCalledWith('type', 'critical');
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
