import { plainToInstance } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from "class-validator";

class EnvironmentVariables {
  @IsIn(["development", "test", "production"])
  NODE_ENV!: "development" | "test" | "production";

  @IsString()
  DB_HOST!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT!: number;

  @IsString()
  DB_DATABASE!: string;

  /** Restricted, NOBYPASSRLS role the running app connects as — this is what actually makes tenant isolation real. */
  @IsString()
  DB_USERNAME!: string;

  @IsString()
  DB_PASSWORD!: string;

  /** Privileged role used only by the migration runner to create schema/roles/policies. Never used by request-serving code. */
  @IsString()
  DB_ADMIN_USERNAME!: string;

  @IsString()
  DB_ADMIN_PASSWORD!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT!: number;

  @IsString()
  WEB_ORIGIN!: string;

  /** Pepper mixed into every OTP/session-token hash. Never reused across environments. */
  @IsString()
  AUTH_PEPPER!: string;

  @IsString()
  SMTP_HOST!: string;

  @IsInt()
  SMTP_PORT!: number;

  @IsString()
  SMTP_USER!: string;

  @IsString()
  SMTP_PASS!: string;

  @IsString()
  MAIL_FROM!: string;

  @IsOptional()
  @IsString()
  WHATSAPP_ACCESS_TOKEN?: string;

  @IsOptional()
  @IsString()
  WHATSAPP_PHONE_NUMBER_ID?: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${errors
        .map(
          (e) =>
            `- ${e.property}: ${Object.values(e.constraints ?? {}).join(", ")}`,
        )
        .join("\n")}`,
    );
  }
  return validated;
}
