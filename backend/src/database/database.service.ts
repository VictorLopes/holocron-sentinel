import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import knex, { Knex } from 'knex';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private knexInstance!: Knex;

  onModuleInit() {
    this.logger.log('Initializing Knex database connection...');

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      this.logger.error('DATABASE_URL environment variable is not defined!');
      throw new Error('DATABASE_URL is missing');
    }

    this.knexInstance = knex({
      client: 'pg',
      connection: dbUrl,
      pool: {
        min: 2,
        max: 10,
      },
    });
  }

  async onModuleDestroy() {
    this.logger.log('Destroying Knex database connection...');
    if (this.knexInstance) {
      await this.knexInstance.destroy();
    }
  }

  get db(): Knex {
    return this.knexInstance;
  }
}
