import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { join } from 'path';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: console,
  });

  // Serve /uploads folder
  // uploaded images are public assets, and the panels draw them into printed PDFs
  app.use('/uploads', express.static(join(process.cwd(), 'uploads'), {
    setHeaders(res) {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  }));

  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    forbidUnknownValues: false
  }));
  app.use(cookieParser());

  var whitelist = (process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  app.enableCors({
    origin: function (origin, callback) {
      if (!origin || whitelist.indexOf(origin) !== -1) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true
  });

  app.use(bodyParser.json({ limit: '100mb' }));
  app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));

  await app.listen(process.env.APP_SERVER_PORT);
}
bootstrap();
