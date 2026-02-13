# Database Migrations

SpecVerse uses Flyway for SQL Server schema migrations.

All SQL Server migrations must live in:

db/migrations/sqlserver/

Flyway in staging and production environments is configured to read from that path.

Do not move this directory without updating deployment configuration.
