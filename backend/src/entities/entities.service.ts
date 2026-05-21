import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateEntityDto } from './dto/create-entity.dto';
import { Entity, PaginatedResponse } from './entities.types';
import { EventRecord } from '../events/events.types';

@Injectable()
export class EntitiesService {
  private readonly logger = new Logger(EntitiesService.name);

  constructor(private readonly dbService: DatabaseService) {}

  async create(createEntityDto: CreateEntityDto): Promise<Entity> {
    this.logger.log(
      `Creating monitored entity with name: ${createEntityDto.name}`,
    );

    const [entity] = (await this.dbService
      .db('entities')
      .insert({
        name: createEntityDto.name,
        status: 'active',
        critical_events_count: 0,
      })
      .returning('*')) as Entity[];

    return entity;
  }

  async getEntitiesWithCriticalEvents(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponse<Entity & { recent_events: EventRecord[] }>> {
    const offset = (page - 1) * limit;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    this.logger.log(
      `Fetching entities with critical events from last 7 days (page=${page}, limit=${limit})`,
    );

    const [{ total }] = await this.dbService
      .db('entities as e')
      .innerJoin('events as ev', 'ev.entity_id', 'e.id')
      .where('ev.type', 'critical')
      .where('ev.created_at', '>=', sevenDaysAgo)
      .countDistinct('e.id', { as: 'total' });

    const rows = await this.dbService
      .db('entities as e')
      .select(
        'e.*',
        this.dbService.db.raw(`
          COALESCE(
            json_agg(
              json_build_object(
                'id', ev.id,
                'entity_id', ev.entity_id,
                'external_id', ev.external_id,
                'type', ev.type,
                'payload', ev.payload,
                'created_at', ev.created_at
              ) ORDER BY ev.created_at DESC
            ) FILTER (WHERE ev.id IS NOT NULL),
            '[]'::json
          ) AS recent_events
        `),
      )
      .innerJoin('events as ev', 'ev.entity_id', 'e.id')
      .where('ev.type', 'critical')
      .where('ev.created_at', '>=', sevenDaysAgo)
      .groupBy('e.id')
      .orderBy('e.critical_events_count', 'desc')
      .orderByRaw('COUNT(ev.id) DESC')
      .limit(limit)
      .offset(offset);

    const totalCount = Number(total);
    return {
      data: rows as (Entity & { recent_events: EventRecord[] })[],
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }
}
