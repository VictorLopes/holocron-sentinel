import { Test, TestingModule } from '@nestjs/testing';
import { EntitiesService } from './entities.service';
import { DatabaseService } from '../database/database.service';

describe('EntitiesService', () => {
  let service: EntitiesService;
  let dbService: DatabaseService;

  const mockKnexInsert = jest.fn().mockReturnValue({
    returning: jest.fn().mockResolvedValue([
      {
        id: '1',
        name: 'Death Star',
        status: 'active',
        critical_events_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]),
  });

  const mockKnex = jest.fn().mockReturnValue({
    insert: mockKnexInsert,
  });

  const mockDatabaseService = {
    db: mockKnex,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntitiesService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<EntitiesService>(EntitiesService);
    dbService = module.get<DatabaseService>(DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should insert and return a new entity', async () => {
      const dto = { name: 'Death Star' };
      const result = await service.create(dto);

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
      expect(result.name).toBe('Death Star');
      expect(result.status).toBe('active');
      expect(mockDatabaseService.db).toHaveBeenCalledWith('entities');
    });
  });
});
