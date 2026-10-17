import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { AppConfig } from "./config/app-config.service";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { correlationIdMiddleware } from "./bootstrap/correlation-id.middleware";
import { createOriginCheckMiddleware } from "./bootstrap/origin-check.middleware";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfig);

  app.use(helmet());
  app.use(cookieParser());
  app.use(correlationIdMiddleware);
  app.use(createOriginCheckMiddleware(config.webOrigin));

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  // No-store everywhere: this app never wants an intermediary or the
  // browser caching a response that may carry per-tenant/per-role data.
  app.use(
    (
      _req: unknown,
      res: { setHeader: (k: string, v: string) => void },
      next: () => void,
    ) => {
      res.setHeader("Cache-Control", "no-store");
      next();
    },
  );

  await app.listen(config.apiPort, "127.0.0.1");
  Logger.log(
    `Sahmati API listening on http://127.0.0.1:${config.apiPort}/api`,
    "Bootstrap",
  );
}

void bootstrap();
