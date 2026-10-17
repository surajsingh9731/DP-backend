/**
 * Loaded by Vitest's `setupFiles` — guaranteed to run before any test
 * file (and its imports) is evaluated. Setting these as plain
 * `process.env.X = ...` lines inside a spec file is NOT reliable: static
 * imports can resolve (and read process.env, e.g. via
 * ConfigModule.forRoot()) before top-level statements textually above
 * them actually execute, depending on the transform. This file exists
 * so integration tests always point at sahmati_test, never sahmati_local.
 */
process.env.NODE_ENV = "test";
process.env.DB_HOST = "127.0.0.1";
process.env.DB_PORT = "5432";
process.env.DB_DATABASE = "sahmati_test";
process.env.DB_ADMIN_USERNAME = "postgres";
process.env.DB_ADMIN_PASSWORD = "Suraj@123";
process.env.DB_USERNAME = "sahmati_app";
process.env.DB_PASSWORD = "sahmati_app_dev_password";
process.env.API_PORT = "4310";
process.env.WEB_ORIGIN = "http://127.0.0.1:4200";
process.env.AUTH_PEPPER = "test-pepper-not-for-production";
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = "2525";
process.env.SMTP_USER = "itpo_admin@example.com";
process.env.SMTP_PASS = "unused-in-tests";
process.env.MAIL_FROM = "itpo_admin@example.com";
