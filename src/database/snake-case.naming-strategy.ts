import { DefaultNamingStrategy, type NamingStrategyInterface } from "typeorm";

function toSnakeCase(value: string): string {
  return value.replace(/([A-Z])/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Every entity in this codebase is written with camelCase TypeScript
 * properties, but every migration writes snake_case SQL columns (the
 * convention this project's own migrations already follow). This bridges
 * the two without hand-writing a `name:` override on every single column.
 */
export class SnakeCaseNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  override columnName(
    propertyName: string,
    customName: string | undefined,
  ): string {
    return customName ?? toSnakeCase(propertyName);
  }

  relationColumnName(propertyName: string): string {
    return toSnakeCase(propertyName);
  }

  override joinColumnName(
    relationName: string,
    referencedColumnName: string,
  ): string {
    return toSnakeCase(`${relationName}_${referencedColumnName}`);
  }

  override joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return toSnakeCase(`${tableName}_${columnName ?? propertyName}`);
  }
}
