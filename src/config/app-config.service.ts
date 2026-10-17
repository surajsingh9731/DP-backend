import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/** Typed, fail-fast access to environment configuration — nothing reads process.env directly outside this service. */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  private get<T extends string | number>(key: string): T {
    const value = this.config.get<T>(key);
    if (value === undefined || value === null || value === "") {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
  }

  get nodeEnv(): string {
    return this.get("NODE_ENV");
  }

  get isProduction(): boolean {
    return this.nodeEnv === "production";
  }

  get db() {
    return {
      host: this.get<string>("DB_HOST"),
      port: Number(this.get("DB_PORT")),
      database: this.get<string>("DB_DATABASE"),
      username: this.get<string>("DB_USERNAME"),
      password: this.get<string>("DB_PASSWORD"),
    };
  }

  get dbAdmin() {
    return {
      username: this.get<string>("DB_ADMIN_USERNAME"),
      password: this.get<string>("DB_ADMIN_PASSWORD"),
    };
  }

  get apiPort(): number {
    return Number(this.get("API_PORT"));
  }

  get webOrigin(): string {
    return this.get<string>("WEB_ORIGIN");
  }

  get authPepper(): string {
    return this.get<string>("AUTH_PEPPER");
  }

  get smtp() {
    return {
      host: this.get<string>("SMTP_HOST"),
      port: Number(this.get("SMTP_PORT")),
      user: this.get<string>("SMTP_USER"),
      pass: this.get<string>("SMTP_PASS"),
      from: this.get<string>("MAIL_FROM"),
    };
  }

  get whatsapp() {
    return {
      accessToken: this.config.get<string>("WHATSAPP_ACCESS_TOKEN") ?? null,
      phoneNumberId:
        this.config.get<string>("WHATSAPP_PHONE_NUMBER_ID") ?? null,
    };
  }

  /** WhatsApp Cloud API credentials aren't live yet (Meta template approval is pending) — email is the only real channel until this returns true. */
  get whatsappEnabled(): boolean {
    return Boolean(this.whatsapp.accessToken && this.whatsapp.phoneNumberId);
  }
}
