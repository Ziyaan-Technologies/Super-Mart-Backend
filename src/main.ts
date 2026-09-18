import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    forbidUnknownValues: false,
  }));
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '10mb' });

  const whitelist = (process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  app.enableCors({
    origin: function (origin, callback) {
      if (!origin || whitelist.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  });

  await app.listen(process.env.APP_SERVER_PORT || 4000);
}
bootstrap();
