import { plainToInstance } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from "class-validator";

/**
 * Validated shape of process.env. Fails fast at boot with a readable error
 * rather than letting a missing/malformed value surface later as a runtime
 * crash deep inside a request.
 */
class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DB_HOST!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT!: number;

  @IsString()
  @IsNotEmpty()
  DB_USERNAME!: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  DB_DATABASE!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT!: number;

  @IsString()
  @IsNotEmpty()
  WEB_ORIGIN!: string;

  @IsString()
  @IsNotEmpty()
  AUTH_PEPPER!: string;

  @IsOptional()
  @IsIn(["local-sink"])
  MAIL_TRANSPORT?: "local-sink";

  @IsOptional()
  @IsInt()
  @Min(100)
  WORKER_POLL_MS?: number;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map(
        (error) =>
          `${error.property}: ${Object.values(error.constraints ?? {}).join(", ")}`,
      )
      .join("\n  ");
    throw new Error(`Invalid environment configuration:\n  ${details}`);
  }
  return validated;
}
