import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { AppConfigService } from "./config/app-config.service";
import { correlationIdMiddleware } from "./bootstrap/correlation-id.middleware";
import { createOriginCheckMiddleware } from "./bootstrap/origin-check.middleware";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);

  app.use(helmet());
  app.use(cookieParser());
  app.use(correlationIdMiddleware);
  app.use(createOriginCheckMiddleware(config.webOrigin));
  app.use(
    (
      _req: unknown,
      res: { setHeader: (name: string, value: string) => void },
      next: () => void,
    ) => {
      res.setHeader("Cache-Control", "no-store");
      next();
    },
  );

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({ origin: config.webOrigin, credentials: true });

  await app.listen(config.apiPort, "127.0.0.1");
}

void bootstrap();
