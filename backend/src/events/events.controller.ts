import {
  Controller,
  Post,
  Sse,
  Get,
  Query,
  Body,
  UsePipes,
  ValidationPipe,
  MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { QueryEventsDto } from './dto/query-events.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(@Body() createEventDto: CreateEventDto) {
    return this.eventsService.registerEvent(createEventDto);
  }

  @Get()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async findAll(@Query() query: QueryEventsDto) {
    return this.eventsService.getRecentEvents(
      query.page,
      query.limit,
      query.entity_id,
      query.type,
    );
  }

  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.eventsService.eventStream$.pipe(
      map((event) => ({
        data: event,
        id: event.id,
      })),
    );
  }
}
