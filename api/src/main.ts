import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Behind Railway's proxy — trust X-Forwarded-* so protocol/IP are correct.
  app.set('trust proxy', 1);

  // CORS_ORIGINS is a comma-separated allow-list (no wildcard in production).
  // Empty → allow all, which is only ever the case in local dev.
  const origins = config.get<string>('corsOrigins') ?? '';
  const allowedOrigins = origins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // OpenAPI is the single source of truth for the generated Flutter/Next clients.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Loop API')
    .setDescription('Cargo–driver geo-matching platform (Rwanda)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // Railway injects PORT; bind 0.0.0.0 so the container is reachable.
  const port = config.get<number>('port') ?? 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`Loop API listening on 0.0.0.0:${port}  (docs at /docs)`);
}

void bootstrap();
