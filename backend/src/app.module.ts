import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { EntitiesModule } from './entities/entities.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [DatabaseModule, EntitiesModule, EventsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
