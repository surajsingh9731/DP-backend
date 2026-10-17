ALTER TABLE workspace.outbox DROP COLUMN template_key,DROP COLUMN template_version,DROP COLUMN language;
ALTER TABLE delivery.login_jobs DROP COLUMN template_key,DROP COLUMN template_version,DROP COLUMN language;
ALTER TABLE delivery.mailbox DROP COLUMN template_key,DROP COLUMN template_version,DROP COLUMN language;
