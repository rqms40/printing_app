import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';
import { configureTrustedProxy } from './config/trusted-proxy';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureTrustedProxy(app);

  // Security headers — skip entirely in dev; plain HTTP on a remote IP is incompatible
  // with HSTS, COOP, and CSP upgrade-insecure-requests that helmet enables by default.
  if (process.env.NODE_ENV === 'production') {
    app.use(helmet());
  }

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS for Flutter app
  app.enableCors();

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger docs
  const config = new DocumentBuilder()
    .setTitle('GRIDGO API')
    .setDescription('GRIDGO Printing Service API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🟢 GRIDGO API running on http://0.0.0.0:${port}`);
  console.log(`📚 Swagger docs at http://0.0.0.0:${port}/docs`);
}
void bootstrap();
