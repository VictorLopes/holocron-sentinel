import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { EntitiesService } from './entities.service';
import { CreateEntityDto } from './dto/create-entity.dto';
import { QueryEntitiesDto } from './dto/query-entities.dto';

@Controller('entities')
export class EntitiesController {
  constructor(private readonly entitiesService: EntitiesService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(@Body() createEntityDto: CreateEntityDto) {
    return this.entitiesService.create(createEntityDto);
  }

  @Get()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async findAll(@Query() query: QueryEntitiesDto) {
    return this.entitiesService.getEntitiesWithCriticalEvents(
      query.page,
      query.limit,
    );
  }
}
