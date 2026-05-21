import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { EntitiesModule } from './entities/entities.module';

@Module({
  imports: [DatabaseModule, EntitiesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
