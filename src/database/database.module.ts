import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppConfigModule } from "../config/app-config.module";
import { AppConfig } from "../config/app-config.service";
import { SnakeCaseNamingStrategy } from "./snake-case.naming-strategy";

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        type: "postgres" as const,
        ...config.db,
        autoLoadEntities: true,
        namingStrategy: new SnakeCaseNamingStrategy(),
        synchronize: false,
        logging: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
