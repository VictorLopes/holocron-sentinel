import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { CloudWatchLogger } from './common/logger/cloudwatch.logger';

try {
  process.loadEnvFile();
} catch {
  console.warn('.env is missing');
}

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    new FastifyAdapter({ logger: true }),
    {
      logger: new CloudWatchLogger(),
    },
  );
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
