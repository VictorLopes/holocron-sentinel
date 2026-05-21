import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redisClient!: Redis;

  onModuleInit() {
    this.logger.log('Initializing Redis client...');

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.redisClient.on('connect', () => {
      this.logger.log('Redis client successfully connected');
    });

    this.redisClient.on('error', (err) => {
      this.logger.error('Redis error occurred:', err);
    });
  }

  async onModuleDestroy() {
    this.logger.log('Closing Redis client...');
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }

  get client(): Redis {
    return this.redisClient;
  }

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fallback: () => Promise<T | null>,
  ): Promise<T | null> {
    try {
      const cached = await this.redisClient.get(key);
      if (cached !== null) {
        this.logger.debug(`Cache hit for key: ${key}`);
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      this.logger.warn(`Redis get failed for key ${key}: ${err}`);
    }

    const data = await fallback();
    if (data !== null && data !== undefined) {
      try {
        await this.redisClient.set(key, JSON.stringify(data), 'EX', ttlSeconds);
      } catch (err) {
        this.logger.warn(`Redis set failed for key ${key}: ${err}`);
      }
    }

    return data;
  }
}
