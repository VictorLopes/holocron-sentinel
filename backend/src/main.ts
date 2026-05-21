import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FastifyAdapter } from '@nestjs/platform-fastify';

try {
  process.loadEnvFile();
} catch (error) {
  console.warn('.env is missing');
}

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
