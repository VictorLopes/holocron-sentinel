import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../database/redis.service';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

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

  const mockKnexSelect = jest.fn();
  const mockTransaction = jest.fn();

  const mockDatabaseService = {
    db: Object.assign(
      jest.fn().mockImplementation((table) => {
        if (table === 'events') {
          return {
            where: jest.fn().mockReturnThis(),
            first: mockKnexSelect,
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

  it('should be defined', () => {
    expect(service).toBeDefined();
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
      expect((result as any).is_duplicate).toBe(true);
      expect(mockGetOrSet).toHaveBeenCalledWith(
        'event:external_id:ext-123',
        86400,
        expect.any(Function),
      );
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should reject immediately if cached entity is suspended', async () => {
      mockGetOrSet.mockResolvedValueOnce(null); // No cached event
      mockGetOrSet.mockResolvedValueOnce({
        status: 'suspended',
        critical_events_count: 3,
      }); // Suspended entity

      await expect(
        service.registerEvent({
          entity_id: '10',
          external_id: 'ext-123',
          type: 'info',
          payload: { data: 'test' },
        }),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should successfully register a non-critical event and cache it', async () => {
      mockGetOrSet.mockResolvedValueOnce(null); // No cached event
      mockGetOrSet.mockResolvedValueOnce({
        status: 'active',
        critical_events_count: 1,
      }); // Active entity

      const mockTrx = jest.fn().mockImplementation((table) => {
        if (table === 'entities') {
          return {
            where: jest.fn().mockReturnThis(),
            forUpdate: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              id: '10',
              status: 'active',
              critical_events_count: 1,
            }),
            update: jest.fn().mockResolvedValue(1),
          };
        }
        if (table === 'events') {
          return {
            insert: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([
              {
                id: '5',
                entity_id: '10',
                external_id: 'ext-123',
                type: 'info',
                payload: { data: 'test' },
                created_at: new Date(),
              },
            ]),
          };
        }
      });
      mockTrx.fn = { now: () => 'now' };
      mockTransaction.mockImplementation((callback) => callback(mockTrx));

      const result = await service.registerEvent({
        entity_id: '10',
        external_id: 'ext-123',
        type: 'info',
        payload: { data: 'test' },
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('5');
      expect(mockTransaction).toHaveBeenCalled();
      expect(mockRedisSet).toHaveBeenCalledWith(
        'event:external_id:ext-123',
        expect.any(String),
        'EX',
        86400,
      );
      expect(mockRedisDel).toHaveBeenCalledWith('entity:10');
    });

    it('should increment count and auto-suspend when critical limit is reached', async () => {
      mockGetOrSet.mockResolvedValueOnce(null); // No cached event
      mockGetOrSet.mockResolvedValueOnce({
        status: 'active',
        critical_events_count: 2,
      }); // Active entity with 2 critical events

      const mockTrxUpdate = jest.fn().mockResolvedValue(1);
      const mockTrx = jest.fn().mockImplementation((table) => {
        if (table === 'entities') {
          return {
            where: jest.fn().mockReturnThis(),
            forUpdate: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({
              id: '10',
              status: 'active',
              critical_events_count: 2,
            }),
            update: mockTrxUpdate,
          };
        }
        if (table === 'events') {
          return {
            insert: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([
              {
                id: '6',
                entity_id: '10',
                external_id: 'ext-critical',
                type: 'critical',
                payload: { data: 'threat' },
                created_at: new Date(),
              },
            ]),
          };
        }
      });
      mockTrx.fn = { now: () => 'now' };
      mockTransaction.mockImplementation((callback) => callback(mockTrx));

      const result = await service.registerEvent({
        entity_id: '10',
        external_id: 'ext-critical',
        type: 'critical',
        payload: { data: 'threat' },
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('6');
      expect(mockTrxUpdate).toHaveBeenCalledWith({
        critical_events_count: 3,
        status: 'suspended',
        updated_at: 'now',
      });
      expect(mockRedisDel).toHaveBeenCalledWith('entity:10');
    });
  });
});
