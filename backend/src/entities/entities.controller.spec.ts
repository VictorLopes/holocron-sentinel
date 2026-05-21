import { Test, TestingModule } from '@nestjs/testing';
import { EntitiesController } from './entities.controller';
import { EntitiesService } from './entities.service';

describe('EntitiesController', () => {
  let controller: EntitiesController;
  let service: EntitiesService;

  const mockEntitiesService = {
    create: jest.fn().mockImplementation((dto) => Promise.resolve({
      id: '1',
      name: dto.name,
      status: 'active',
      critical_events_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EntitiesController],
      providers: [
        {
          provide: EntitiesService,
          useValue: mockEntitiesService,
        },
      ],
    }).compile();

    controller = module.get<EntitiesController>(EntitiesController);
    service = module.get<EntitiesService>(EntitiesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create an entity', async () => {
      const dto = { name: 'Death Star' };
      const result = await controller.create(dto);
      expect(result).toBeDefined();
      expect(result.name).toBe('Death Star');
      expect(result.status).toBe('active');
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });
});
