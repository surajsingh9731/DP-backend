import { allowedWebOrigin } from './web-origin.policy.js';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { NextFunction, Response } from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import 'reflect-metadata';
import { AppModule } from '../app.module.js';
import type { AuthRequest } from '../auth/models/auth-request.js';
import { SafeErrorFilter } from '../common/filters/safe-error.filter.js';
export async function createApp(quiet = false) {
  const app = await NestFactory.create(AppModule, {
    logger: quiet ? false : ['log', 'warn', 'error'],
  });
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.use((req: AuthRequest, res: Response, next: NextFunction) => {
    const candidate = req.headers['x-request-id'];
    req.requestId =
      typeof candidate === 'string' && /^[a-f0-9-]{36}$/i.test(candidate)
        ? candidate
        : randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    res.setHeader('Cache-Control', 'no-store');
    if (
      !allowedWebOrigin(
        req.headers.origin,
        config.getOrThrow<string>('webOrigin'),
        config.getOrThrow<string>('mode'),
      )
    ) {
      res
        .status(403)
        .json({ statusCode: 403, message: 'Origin is not allowed.', requestId: req.requestId });
      return;
    }
    if (req.headers['sec-fetch-site'] === 'cross-site') {
      res.status(403).json({
        statusCode: 403,
        message: 'Cross-site requests are not allowed.',
        requestId: req.requestId,
      });
      return;
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalFilters(new SafeErrorFilter());
  app.enableShutdownHooks();
  return app;
}
