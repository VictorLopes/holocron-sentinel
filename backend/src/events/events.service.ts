import { Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../database/redis.service';
import { getCacheKey } from '../database/redis-keys';
import { CreateEventDto } from './dto/create-event.dto';

export interface EventRecord {
  id: string;
  entity_id: string;
  external_id: string;
  type: string;
  payload: Record<string, any>;
  created_at: Date;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly dbService: DatabaseService,
    private readonly redisService: RedisService,
  ) { }

  async getEventByExternalId(externalId: string): Promise<EventRecord | null> {
    const cacheKey = getCacheKey('EVENT_EXTERNAL_ID', externalId);
    return this.redisService.getOrSet(cacheKey, 86400, async () => {
      const dbEvent = await this.dbService.db('events')
        .where('external_id', externalId)
        .first();

      if (!dbEvent) {
        return null;
      }

      return {
        id: dbEvent.id.toString(),
        entity_id: dbEvent.entity_id.toString(),
        external_id: dbEvent.external_id,
        type: dbEvent.type,
        payload: typeof dbEvent.payload === 'string' ? JSON.parse(dbEvent.payload) : dbEvent.payload,
        created_at: dbEvent.created_at,
      };
    });
  }

  async getEntityCached(entityId: string | number): Promise<{ status: string; critical_events_count: number } | null> {
    const cacheKey = getCacheKey('ENTITY', entityId);
    return this.redisService.getOrSet(cacheKey, 86400, async () => {
      const dbEntity = await this.dbService.db('entities')
        .where('id', entityId)
        .first();

      if (!dbEntity) {
        return null;
      }

      return {
        status: dbEntity.status,
        critical_events_count: Number(dbEntity.critical_events_count),
      };
    });
  }

  async registerEvent(createEventDto: CreateEventDto): Promise<EventRecord> {
    const { entity_id, external_id, type, payload } = createEventDto;

    const existingEvent = await this.getEventByExternalId(external_id);
    if (existingEvent) {
      this.logger.log(`Duplicate event ignored (idempotency) for external_id: ${external_id}`);
      return existingEvent;
    }

    const entityInfo = await this.getEntityCached(entity_id);
    if (!entityInfo) {
      throw new NotFoundException(`Monitored entity with ID ${entity_id} not found`);
    }

    if (entityInfo.status === 'suspended') {
      throw new UnprocessableEntityException(`Monitored entity is suspended and cannot accept new events`);
    }

    try {
      const result = await this.dbService.db.transaction(async (trx) => {
        const entityRow = await trx('entities')
          .where('id', entity_id)
          .forUpdate()
          .first();

        if (!entityRow) {
          throw new NotFoundException(`Monitored entity with ID ${entity_id} not found`);
        }

        if (entityRow.status === 'suspended') {
          throw new UnprocessableEntityException(`Monitored entity is suspended and cannot accept new events`);
        }

        let dbEvent;
        try {
          const [inserted] = await trx('events')
            .insert({
              entity_id,
              external_id,
              type,
              payload: JSON.stringify(payload),
            })
            .returning('*');
          dbEvent = inserted;
        } catch (err: any) {
          if (err.code === '23505') {
            this.logger.warn(`Duplicate key violation during transaction for external_id: ${external_id}`);
            throw new Error('DUPLICATE_EVENT');
          }
          throw err;
        }

        let updatedStatus = entityRow.status;
        let updatedCount = Number(entityRow.critical_events_count);

        if (type === 'critical') {
          updatedCount += 1;
          const limit = Number(process.env.CRITICAL_EVENTS_LIMIT) || 3;
          if (updatedCount >= limit) {
            updatedStatus = 'suspended';
          }

          await trx('entities')
            .where('id', entity_id)
            .update({
              critical_events_count: updatedCount,
              status: updatedStatus,
              updated_at: trx.fn.now(),
            });
        }

        return { dbEvent, updatedStatus, updatedCount };
      });

      const newRecord: EventRecord = {
        id: result.dbEvent.id.toString(),
        entity_id: result.dbEvent.entity_id.toString(),
        external_id: result.dbEvent.external_id,
        type: result.dbEvent.type,
        payload: typeof result.dbEvent.payload === 'string' ? JSON.parse(result.dbEvent.payload) : result.dbEvent.payload,
        created_at: result.dbEvent.created_at,
      };

      try {
        const eventKey = getCacheKey('EVENT_EXTERNAL_ID', external_id);
        await this.redisService.client.set(eventKey, JSON.stringify(newRecord), 'EX', 86400);

        const entityKey = getCacheKey('ENTITY', entity_id);
        await this.redisService.client.set(
          entityKey,
          JSON.stringify({
            status: result.updatedStatus,
            critical_events_count: result.updatedCount,
          }),
          'EX',
          86400,
        );
      } catch (err) {
        this.logger.warn(`Redis failed to write caches after transaction: ${err}`);
      }

      return newRecord;

    } catch (err: any) {
      if (err.message === 'DUPLICATE_EVENT') {
        const duplicate = await this.getEventByExternalId(external_id);
        if (duplicate) {
          return duplicate;
        }
      }
      throw err;
    }
  }
}
