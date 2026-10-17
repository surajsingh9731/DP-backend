import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Typed façade over ConfigService so the rest of the app never calls
 * `get<string>('SOME_ENV_KEY')` with a string literal scattered everywhere.
 * One place to see every config value the app actually reads.
 */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService) {}

  get db() {
    return {
      host: this.require("DB_HOST"),
      port: Number(this.require("DB_PORT")),
      username: this.require("DB_USERNAME"),
      password: this.require("DB_PASSWORD"),
      database: this.require("DB_DATABASE"),
    };
  }

  get apiPort(): number {
    return Number(this.require("API_PORT"));
  }

  get webOrigin(): string {
    return this.require("WEB_ORIGIN");
  }

  get authPepper(): string {
    return this.require("AUTH_PEPPER");
  }

  get workerPollMs(): number {
    return Number(this.config.get("WORKER_POLL_MS") ?? 1000);
  }

  private require(key: string): string {
    const value = this.config.get<string>(key);
    if (value === undefined || value === null || value === "") {
      throw new Error(`Missing required configuration value: ${key}`);
    }
    return value;
  }
}
