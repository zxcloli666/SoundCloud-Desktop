import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { SoundcloudExceptionFilter } from './common/filters/soundcloud-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  app.enableCors({
    origin: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: '*',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new SoundcloudExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SoundCloud Desktop API')
    .setDescription(
      'Backend API for SoundCloud Desktop application. Proxies SoundCloud API with OAuth 2.1 + PKCE authentication.',
    )
    .setVersion('1.0.0')
    .addApiKey({ type: 'apiKey', name: 'x-session-id', in: 'header' }, 'session')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('api', app, document, {
    jsonDocumentUrl: '/openapi.json',
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Server running on http://localhost:${port}`);
  console.log(`OpenAPI spec: http://localhost:${port}/openapi.json`);
  console.log(`Swagger UI: http://localhost:${port}/api`);
}
bootstrap();
