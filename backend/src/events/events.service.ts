import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../database/redis.service';
import { getCacheKey } from '../database/redis-keys';
import { CreateEventDto } from './dto/create-event.dto';
import {
  EventRecord,
  LightweightEventRecord,
  EntityRow,
  DbEventRow,
} from './events.types';
import { EntitySuspendedException } from '../entities/exceptions/entity-suspended.exception';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly dbService: DatabaseService,
    private readonly redisService: RedisService,
  ) {}

  async registerEvent(
    createEventDto: CreateEventDto,
  ): Promise<
    EventRecord | (LightweightEventRecord & { is_duplicate: boolean })
  > {
    const { entity_id, external_id, type } = createEventDto;

    const duplicateResult = await this.checkExternalId(external_id);
    if (duplicateResult) {
      return duplicateResult;
    }

    await this.validateEntityStatus(entity_id);

    try {
      const result = await this.dbService.db.transaction(async (trx) => {
        const entityRow = await this.verifyAndLockEntityInTransaction(
          trx,
          entity_id,
        );

        const { updatedStatus, updatedCount } =
          await this.updateEntityStatusInTransaction(
            trx,
            entity_id,
            entityRow,
            type,
          );

        const dbEvent = await this.insertEventInTransaction(
          trx,
          createEventDto,
        );

        return { dbEvent, updatedStatus, updatedCount };
      });

      const newRecord = this.mapToEventRecord(result.dbEvent);

      await this.updateCache(external_id, entity_id, newRecord);

      return newRecord;
    } catch (err: unknown) {
      return this.handleDuplicateEventError(external_id, err);
    }
  }

  async getEventByExternalId(
    externalId: string,
  ): Promise<LightweightEventRecord | null> {
    const cacheKey = getCacheKey('EVENT_EXTERNAL_ID', externalId);
    return this.redisService.getOrSet(cacheKey, 86400, async () => {
      const dbEvent = (await this.dbService
        .db('events')
        .where('external_id', externalId)
        .first()) as DbEventRow | undefined;

      if (!dbEvent) {
        return null;
      }

      return {
        id: dbEvent.id.toString(),
        entity_id: dbEvent.entity_id.toString(),
        external_id: dbEvent.external_id,
      };
    });
  }

  async getEntityCached(
    entityId: string | number,
  ): Promise<{ status: string; critical_events_count: number } | null> {
    const cacheKey = getCacheKey('ENTITY', entityId);
    return this.redisService.getOrSet(cacheKey, 86400, async () => {
      const dbEntity = (await this.dbService
        .db('entities')
        .where('id', entityId)
        .first()) as EntityRow | undefined;

      if (!dbEntity) {
        return null;
      }

      return {
        status: dbEntity.status,
        critical_events_count: Number(dbEntity.critical_events_count),
      };
    });
  }

  private async checkExternalId(
    externalId: string,
  ): Promise<(LightweightEventRecord & { is_duplicate: boolean }) | null> {
    const existingEvent = await this.getEventByExternalId(externalId);
    if (existingEvent) {
      this.logger.log(
        `Duplicate event ignored (idempotency) for external_id: ${externalId}`,
      );
      return {
        ...existingEvent,
        is_duplicate: true,
      };
    }
    return null;
  }

  private async validateEntityStatus(entityId: string | number): Promise<void> {
    const entityInfo = await this.getEntityCached(entityId);

    if (!entityInfo) {
      throw new NotFoundException(
        `Monitored entity with ID ${entityId} not found`,
      );
    }

    if (entityInfo.status === 'suspended') {
      throw new EntitySuspendedException();
    }
  }

  private async verifyAndLockEntityInTransaction(
    trx: Knex.Transaction,
    entityId: string | number,
  ): Promise<EntityRow> {
    const entityRow = (await trx('entities')
      .where('id', entityId)
      .forUpdate()
      .first()) as EntityRow | undefined;

    if (!entityRow) {
      throw new NotFoundException(
        `Monitored entity with ID ${entityId} not found`,
      );
    }

    if (entityRow.status === 'suspended') {
      throw new EntitySuspendedException();
    }

    return entityRow;
  }

  private async insertEventInTransaction(
    trx: Knex.Transaction,
    createEventDto: CreateEventDto,
  ): Promise<DbEventRow> {
    const { entity_id, external_id, type, payload } = createEventDto;
    try {
      const [inserted] = (await trx('events')
        .insert({
          entity_id,
          external_id,
          type,
          payload: JSON.stringify(payload),
        })
        .returning('*')) as DbEventRow[];
      return inserted;
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as Record<string, unknown>).code === '23505'
      ) {
        this.logger.warn(
          `Duplicate key violation during transaction for external_id: ${external_id}`,
        );
        throw new Error('DUPLICATE_EVENT');
      }
      throw err;
    }
  }

  private async updateEntityStatusInTransaction(
    trx: Knex.Transaction,
    entityId: string | number,
    entityRow: EntityRow,
    type: string,
  ): Promise<{ updatedStatus: string; updatedCount: number }> {
    let updatedStatus = entityRow.status;
    let updatedCount = Number(entityRow.critical_events_count);

    if (type === 'critical') {
      updatedCount += 1;
      const limit = Number(process.env.CRITICAL_EVENTS_LIMIT) || 3;
      if (updatedCount >= limit) {
        updatedStatus = 'suspended';
      }

      await trx('entities').where('id', entityId).update({
        critical_events_count: updatedCount,
        status: updatedStatus,
        updated_at: trx.fn.now(),
      });
    }

    return { updatedStatus, updatedCount };
  }

  private mapToEventRecord(dbEvent: DbEventRow): EventRecord {
    return {
      id: dbEvent.id.toString(),
      entity_id: dbEvent.entity_id.toString(),
      external_id: dbEvent.external_id,
      type: dbEvent.type,
      payload:
        typeof dbEvent.payload === 'string'
          ? (JSON.parse(dbEvent.payload) as Record<string, any>)
          : dbEvent.payload,
      created_at: dbEvent.created_at,
    };
  }

  private async updateCache(
    externalId: string,
    entityId: string | number,
    newRecord: EventRecord,
  ): Promise<void> {
    try {
      const eventKey = getCacheKey('EVENT_EXTERNAL_ID', externalId);
      const cacheRecord: LightweightEventRecord = {
        id: newRecord.id,
        entity_id: newRecord.entity_id,
        external_id: newRecord.external_id,
      };
      await this.redisService.client.set(
        eventKey,
        JSON.stringify(cacheRecord),
        'EX',
        86400,
      );

      const entityKey = getCacheKey('ENTITY', entityId);
      await this.redisService.client.del(entityKey);
    } catch (err) {
      this.logger.warn(
        `Redis failed to write caches after transaction: ${err}`,
      );
    }
  }

  private async handleDuplicateEventError(
    externalId: string,
    err: unknown,
  ): Promise<LightweightEventRecord & { is_duplicate: boolean }> {
    if (err instanceof Error && err.message === 'DUPLICATE_EVENT') {
      const duplicate = await this.getEventByExternalId(externalId);
      if (duplicate) {
        return {
          ...duplicate,
          is_duplicate: true,
        };
      }
    }
    throw err;
  }
}
