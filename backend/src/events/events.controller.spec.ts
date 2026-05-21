import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

describe('EventsController', () => {
  let controller: EventsController;
  let service: EventsService;

  const mockEventsService = {
    registerEvent: jest.fn().mockImplementation((dto: CreateEventDto) => Promise.resolve({
      id: '1',
      entity_id: dto.entity_id.toString(),
      external_id: dto.external_id,
      type: dto.type,
      payload: dto.payload,
      created_at: new Date(),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        {
          provide: EventsService,
          useValue: mockEventsService,
        },
      ],
    }).compile();

    controller = module.get<EventsController>(EventsController);
    service = module.get<EventsService>(EventsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should register an event', async () => {
      const dto: CreateEventDto = {
        entity_id: '10',
        external_id: 'ext-abc',
        type: 'info',
        payload: { test: true },
      };

      const result = await controller.create(dto);
      expect(result).toBeDefined();
      expect(result.external_id).toBe('ext-abc');
      expect(result.entity_id).toBe('10');
      expect(service.registerEvent).toHaveBeenCalledWith(dto);
    });
  });
});
