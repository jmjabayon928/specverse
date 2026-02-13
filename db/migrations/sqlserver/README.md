# SpecVerse -- SQL Server Flyway Migrations

This directory contains all SQL Server schema migrations managed by
Flyway.

## 🔒 Migration Rules (Critical)

1.  Migrations are **immutable**.

    -   Once deployed to any environment, a `V*.sql` file must NEVER be
        modified.
    -   Changes must be implemented as a new versioned migration.

2.  All schema changes MUST go through Flyway.

    -   Do NOT manually alter tables in Stage or Production.
    -   Do NOT apply hotfixes directly in SQL Server.

3.  No database-level commands are allowed.

    -   ❌ No `CREATE DATABASE`
    -   ❌ No `ALTER DATABASE`
    -   ❌ No `USE [DatabaseName]`
    -   ❌ No file paths (e.g., `C:\...`)
    -   ❌ No login or server-level object creation

4.  Files must be UTF-8 encoded.

5.  Do not hardcode database names.

    -   No references to `SpecVerse_Stage` or `SpecVerse_Prod`.
    -   Flyway connects to the correct database via environment
        configuration.

------------------------------------------------------------------------

## 📌 Versioning Convention

Flyway versioned migrations must follow:

V####\_\_description.sql

Examples:

-   `V0001__initial_schema.sql`
-   `V0002__add_user_preferences.sql`
-   `V0003__add_index_to_inventory.sql`

### Guidelines

-   Use 4-digit zero-padded numbers.
-   Increment strictly.
-   Do NOT reuse or skip backward.
-   Do NOT edit previous migrations.

------------------------------------------------------------------------

## 🔁 Repeatable Migrations (Optional)

Repeatable migrations (if ever used) must follow:

R\_\_description.sql

These are re-applied when their checksum changes.

Use cautiously (typically for views or stored procedures).

------------------------------------------------------------------------

## 🌍 Environment Isolation

Flyway is configured separately per environment:

-   Stage → `SpecVerse_Stage`
-   Production → `SpecVerse_Prod`

Deployments are automated and:

-   Run migrations before application restart
-   Fail the deployment if migration fails
-   Never allow stage migrations to affect production

------------------------------------------------------------------------

## 🧪 Testing Migrations

Before merging:

1.  Create an empty test database.
2.  Run Flyway `migrate`.
3.  Confirm schema builds successfully.
4.  Confirm foreign keys and constraints are valid.

------------------------------------------------------------------------

## 🚫 What NOT To Do

-   Do not modify `V0001__initial_schema.sql`
-   Do not manually drop tables in production
-   Do not delete entries from `flyway_schema_history`
-   Do not bypass Flyway for quick fixes

------------------------------------------------------------------------

## 🏗 Current Baseline

-   `V0001__initial_schema.sql` Contains full initial schema for
    SpecVerse.

All future schema changes must start from `V0002`.
