# SpecVerse Best-Practices Path — v1.1

## 1. Jeff‑Style Engineering Principles
- Strict TypeScript (no any, no implicit anys)
- No nested ternaries
- Early returns instead of complex branching
- Positive conditions (avoid negation logic)
- Pure functions in domain layer
- Domain-driven folder structure
- Separation of concerns: controllers → services → repositories
- Zod schemas for everything
- Centralized error handling (AppError)
- Frontend follows Next.js App Router + server-first principles

## 2. Performance & Optimization Best-Practices Path
### 2.1 Frontend (Next.js)
- Prefer **server components** over client components
- Fetch data **server-side** unless interactive
- Avoid unnecessary `"use client"`
- Break large pages into lazy-loaded components
- Use **React.memo**, **useMemo**, **useCallback** for heavy lists
- Avoid rendering hidden components (use `dynamic()` where needed)
- Use **Suspense boundaries** for split-loading
- Virtualize large tables or lists (inventory, estimation items)

### 2.2 Backend (Express + SQL Server)
- Prefer **single optimized queries** over multiple round trips
- Avoid SELECT *
- Always specify projections
- Use indexes for:
  - ItemID
  - TemplateID
  - SubsheetID
  - UserID
  - ClientID
  - ProjectID
- Avoid N+1 queries
- Move heavy logic (e.g. export formatting) to services
- Reuse database connections via poolPromise
- Cache constant reference data (units, roles, categories)
- Avoid JSON stringification inside tight loops

### 2.3 UI Rendering Performance
- Minimize client-side JavaScript
- Limit rerenders by stabilizing props
- Use shallow-equal objects
- Do not pass new inline objects to components repeatedly
- Avoid hydration mismatches

## 3. Security Best-Practices Path
- JWT with short-lived access tokens
- HTTP-only secure cookies
- MFA for risky operations
- Rate-limited authentication endpoints
- SQL injection safeguards (parameterized queries)
- Permission middleware for every protected route

## 4. Clean Architecture Best-Practices Path
```
src/
  domain/
  validation/
  backend/
    controllers/
    services/
    database/
    routes/
  app/
```

### Key principles:
- Controllers: No business logic
- Services: All logic, pure functions
- Database: Only queries
- Utils: Pure stateless helpers
- Types: Domain-safe interfaces

