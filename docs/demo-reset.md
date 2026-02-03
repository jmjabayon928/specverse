# Demo Reset (Local / Dev Only)

This page describes how to **seed an admin user** and **reset the admin password** for local development or recruiter demos. These utilities are **disabled in production** and must be explicitly enabled.

---

## ⚠️ Warning

**Never enable demo reset in production.** The dev endpoints are only available when:

- `NODE_ENV` is **not** `production`, and  
- `DEV_ADMIN_UTILS=1` is set in the backend environment.

In production, these routes return **404 Not found** and are not exposed.

---

## Required environment

**Backend** (e.g. `.env` for the Express server):

- `NODE_ENV` — must **not** be `production` (e.g. `development` or unset).
- `DEV_ADMIN_UTILS=1` — must be set to `1` to enable the dev endpoints.

Example:

```env
NODE_ENV=development
DEV_ADMIN_UTILS=1
```

---

## Endpoints

| Action | Method | Path | Description |
|--------|--------|------|-------------|
| Seed admin | POST | `/api/backend/dev/seed-admin` | Create an admin user if none exists (idempotent). |
| Reset admin password | POST | `/api/backend/dev/reset-admin-password` | Reset password for the admin user (default email or body). |

Base URL is your backend (e.g. `http://localhost:4000`). You do **not** need to be logged in for these dev endpoints when the guard is satisfied.

---

## Seed admin

Creates an admin user with email `admin@specverse.local` (or the email you send). If the user already exists, returns a success message without changing the password.

**Optional body:**

- `email` — admin email (default: `admin@specverse.local`)
- `password` — if omitted, a temporary password is generated and returned in the response.

### cURL

```bash
# Create admin with default email and auto-generated password
curl -X POST http://localhost:4000/api/backend/dev/seed-admin \
  -H "Content-Type: application/json" \
  -d '{}'

# Create admin with custom email and password
curl -X POST http://localhost:4000/api/backend/dev/seed-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"YourSecurePassword123"}'
```

### PowerShell (Invoke-RestMethod)

```powershell
# Create admin with default email and auto-generated password
Invoke-RestMethod -Uri "http://localhost:4000/api/backend/dev/seed-admin" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{}'

# Create admin with custom email and password
Invoke-RestMethod -Uri "http://localhost:4000/api/backend/dev/seed-admin" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"email":"admin@example.com","password":"YourSecurePassword123"}'
```

**Example response (created):**

```json
{
  "message": "Admin user created successfully",
  "userId": 1,
  "email": "admin@specverse.local",
  "tempPassword": "abc123..."
}
```

**Example response (already exists):**

```json
{
  "message": "Admin user already exists",
  "userId": 1,
  "email": "admin@specverse.local"
}
```

---

## Reset admin password

Resets the password for the admin user with the given email (default `admin@specverse.local`). Returns a new temporary password in the response.

**Optional body:**

- `email` — admin user email (default: `admin@specverse.local`). The user must exist and have the Admin role.

### cURL

```bash
# Reset password for default admin (admin@specverse.local)
curl -X POST http://localhost:4000/api/backend/dev/reset-admin-password \
  -H "Content-Type: application/json" \
  -d '{}'

# Reset password for a specific email
curl -X POST http://localhost:4000/api/backend/dev/reset-admin-password \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@specverse.local"}'
```

### PowerShell (Invoke-RestMethod)

```powershell
# Reset password for default admin
Invoke-RestMethod -Uri "http://localhost:4000/api/backend/dev/reset-admin-password" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{}'

# Reset password for a specific email
Invoke-RestMethod -Uri "http://localhost:4000/api/backend/dev/reset-admin-password" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"email":"admin@specverse.local"}'
```

**Example response:**

```json
{
  "message": "Admin password reset successfully",
  "userId": 1,
  "email": "admin@specverse.local",
  "tempPassword": "xyz789..."
}
```

Copy `tempPassword` and use it to log in; it is not shown again.

---

## Recommended demo workflow

1. **Start backend** with `NODE_ENV=development` and `DEV_ADMIN_UTILS=1`.
2. **Seed admin** (once):  
   `POST /api/backend/dev/seed-admin` with body `{}`.  
   Save the returned `tempPassword` if you need it for the first login.
3. **Log in** in the app with `admin@specverse.local` and the password from step 2 (or the one you set).
4. **When you need to reset the demo password** (e.g. forgotten):  
   `POST /api/backend/dev/reset-admin-password` with body `{}`.  
   Use the new `tempPassword` to log in again.

For production-like demos, use the **Admin → Users** screen and the **Reset Password** button (admin-only) instead of the dev endpoints.
