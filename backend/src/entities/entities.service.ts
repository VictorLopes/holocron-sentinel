import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateEntityDto } from './dto/create-entity.dto';

export interface Entity {
  id: string;
  name: string;
  status: string;
  critical_events_count: number;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class EntitiesService {
  private readonly logger = new Logger(EntitiesService.name);

  constructor(private readonly dbService: DatabaseService) {}

  async create(createEntityDto: CreateEntityDto): Promise<Entity> {
    this.logger.log(`Creating monitored entity with name: ${createEntityDto.name}`);

    const [entity] = await this.dbService.db('entities')
      .insert({
        name: createEntityDto.name,
        status: 'active',
        critical_events_count: 0,
      })
      .returning('*');

    return entity as Entity;
  }
}
