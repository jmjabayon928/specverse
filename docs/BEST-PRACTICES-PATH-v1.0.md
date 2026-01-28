# 🏗️ Calnetic & SpecVerse Engineering Standard  
## BEST-PRACTICES-GOLDEN-PATH-v1.0
_Last updated: 2025-10-14_

This document defines the **14 essential domains of full-stack engineering excellence** for projects built with **Next.js / React.js + Express.js + Node.js + SQL** (or equivalent stacks).  
It serves as the **shared engineering standard** across all Calnetic and independent projects (SpecVerse, PrairieMed, and derivatives).  
All items are **mandatory for new features** and should be continuously applied to legacy modules.

---

## 1️⃣ Architecture & Boundaries
- [ ] Favor **server-first rendering** (Next.js RSC, route handlers) for data-driven pages.  
- [ ] Keep clean layer separation: `UI → API/BFF → Services → Repository → DB`.  
- [ ] Design **contract-first APIs** using OpenAPI, tRPC, or GraphQL schemas.  
- [ ] Ensure all **writes are idempotent** (idempotency keys, replay-safe queues).  
- [ ] Use a **domain-driven structure** (feature folders, context isolation).  
- [ ] Enforce clear responsibility boundaries between client and backend.

---

## 2️⃣ TypeScript & Validation
- [ ] Enable `strict` and `noImplicitAny` in `tsconfig.json`.  
- [ ] Use **runtime validation** (`zod`, `class-validator`, or Yup) at all external boundaries (requests, env, config).  
- [ ] Define **typed error objects** with consistent JSON error shapes.  
- [ ] Validate all `process.env` vars at startup (e.g., `env.zod.ts`).  
- [ ] Never suppress types with `any`; prefer generics and type guards.  

---

## 3️⃣ Security
- [ ] Use **short-lived access tokens** and **rotating refresh tokens** stored in httpOnly, Secure cookies.  
- [ ] Implement **RBAC or ABAC** at service layer; optional RLS (Row-Level Security) in DB.  
- [ ] Use **parameterized queries** or ORM to avoid SQL injection.  
- [ ] Apply **CSRF protection** if using cookie-based auth; **lock CORS** to known origins.  
- [ ] Enforce strict **HTTP headers**:  
  - CSP (`nonce` or `strict-dynamic`),  
  - HSTS, X-Frame-Options, Referrer-Policy.  
- [ ] Secrets & keys managed via **Secrets Manager**, never plain `.env` in prod.  
- [ ] Add per-route **rate limits**, IP throttling, and abuse detection.  
- [ ] Maintain **audit logs** for login, privilege changes, exports, and destructive ops.

---

## 4️⃣ Data & SQL
- [ ] Use **versioned, reversible migrations** (Prisma, Drizzle, or Flyway).  
- [ ] Define primary keys as **UUID/ULID**, not sequential IDs.  
- [ ] Apply **indexes** proactively and review with `EXPLAIN ANALYZE`.  
- [ ] Use **transactions** for multi-step writes; **outbox pattern** for async work.  
- [ ] Centralize DB access via repository pattern; no inline SQL in controllers.  
- [ ] Decide early: tenant-per-row (`tenant_id` + RLS) or schema-per-tenant.  
- [ ] Enforce **UTC timestamps**; convert to local at presentation layer.  
- [ ] Use **connection pooling** (pgBouncer or equivalent).  

---

## 5️⃣ Backend (Express / Next.js API)
- [ ] Controllers only handle IO + validation; services handle business logic.  
- [ ] Implement **cursor-based pagination** with stable sort keys.  
- [ ] Layered caching: HTTP / Edge / Redis / DB; define TTLs and tags.  
- [ ] Queue heavy jobs (email, export, report) with **BullMQ** or similar.  
- [ ] File uploads go **direct to object storage** (S3, Azure Blob) via pre-signed URLs.  
- [ ] Uniform logging & error middleware; never leak stack traces to clients.  

---

## 6️⃣ Frontend (Next.js / React)
- [ ] Use **Server Components** for data rendering; **client components** only for interactivity.  
- [ ] Implement **ISR or tag-based revalidation** for cacheable pages.  
- [ ] Use **SWR / React Query** for client-side refetching & caching.  
- [ ] Optimize performance: code-split, lazy-load, memoize expensive components.  
- [ ] Use `next/image` with responsive sizes and placeholders.  
- [ ] Ensure full **accessibility (a11y)**: semantic HTML, keyboard nav, contrast ratios.  
- [ ] Centralize **i18n / l10n** using `next-intl` or `i18next`.  
- [ ] Use **design tokens** and consistent theming for rebranding.  

---

## 7️⃣ Performance & Caching
- [ ] Multi-layer caching:  
  - CDN & browser (SWR),  
  - Server (Next cache tags),  
  - Data (Redis),  
  - DB (materialized views).  
- [ ] Monitor **TTFB, LCP, INP, CLS** via Lighthouse & Web Vitals.  
- [ ] Profile Node event loop, GC pauses, and DB latency regularly.  
- [ ] Prevent N+1 queries (JOINs/CTEs, batched loaders).  
- [ ] Prefer selective column fetches and efficient payloads.  
- [ ] Benchmark key endpoints before production launches.  

---

## 8️⃣ Observability & Reliability
- [ ] Use **structured JSON logs** (pino/winston) with request-id, user-id, tenant-id.  
- [ ] Implement **OpenTelemetry tracing** from frontend → backend → DB.  
- [ ] Expose **Prometheus metrics** (latency, error rate, saturation).  
- [ ] Use **Sentry** for both frontend & backend with source maps.  
- [ ] Add **health endpoints** (liveness/readiness) checking DB, cache, queue.  
- [ ] Define **SLOs** and alert on thresholds (P95 latency, error ratios).  
- [ ] Capture trace IDs in error responses for debugging.  

---

## 9️⃣ Testing Strategy
- [ ] **Unit tests** for services/utils; **integration tests** for API + DB.  
- [ ] **E2E tests** (Playwright) for critical flows (auth, CRUD, exports).  
- [ ] Use **contract tests** for external APIs; snapshot schemas.  
- [ ] Seed test DBs with fixtures; isolate tests per tenant.  
- [ ] Run tests in CI using Testcontainers or ephemeral DBs.  
- [ ] Measure coverage and enforce thresholds.  
- [ ] Maintain test data generation scripts for repeatability.  

---

## 🔟 CI/CD & Environments
- [ ] CI pipeline: lint → typecheck → unit → integration → e2e → build → migrate → deploy.  
- [ ] Enforce **zero-downtime deploys**; feature flags for staged rollouts.  
- [ ] Run DB migrations with **auto-backup + rollback plan**.  
- [ ] Integrate **secret scanning** and dependency/license audits.  
- [ ] Preview environments per PR (Vercel/Render).  
- [ ] Protect `main` branch with required checks and reviews.  
- [ ] Store build artifacts; version your Docker images.  

---

## 11️⃣ Developer Experience (DX)
- [ ] One-command dev start (PowerShell / Makefile / npm script).  
- [ ] Precommit hooks (lint-staged, prettier, typecheck).  
- [ ] Auto-generate client types/hooks from API schema.  
- [ ] Consistent naming and folder structure across repos.  
- [ ] Local seed command for demo/test data.  
- [ ] Comprehensive **README** and `/docs-*` files in every project.  
- [ ] Include runbooks: local setup, deployment, rollback, debugging.  

---

## 12️⃣ Data Protection & Compliance
- [ ] Classify and tag all **PII** columns.  
- [ ] Use **encryption at rest** (DB/storage) and in transit (TLS).  
- [ ] Apply field-level encryption for sensitive data.  
- [ ] Define **data retention & purge policies**.  
- [ ] Support **right-to-erasure** requests.  
- [ ] Log and audit admin actions & data exports.  
- [ ] Maintain compliance documentation (GDPR/CCPA readiness).  

---

## 13️⃣ Scalability
- [ ] Scale reads via replicas and caches; writes via queues/outbox.  
- [ ] Use **asynchronous eventing** (Kafka, Redpanda, SQS) for cross-module sync.  
- [ ] Implement **idempotent consumers** and retry policies.  
- [ ] Add **timeouts**, **circuit breakers**, and exponential backoff to all external calls.  
- [ ] Decouple non-critical flows into workers or microservices only when necessary.  
- [ ] Plan DB partitioning/sharding early for large datasets.  

---

## 14️⃣ Commonly Missed Operational Practices
- [ ] **Backfill jobs** and migration runbooks documented.  
- [ ] **Versioned APIs** + deprecation strategy.  
- [ ] **Operational runbooks** for incidents, rollbacks, and scaling events.  
- [ ] **Cost observability** (DB, CDN, queues, compute).  
- [ ] **Performance budgets** enforced in CI.  
- [ ] Regular **security audits** and dependency updates.  
- [ ] Quarterly review of this Golden Path checklist.  

---

## ✅ Implementation Notes
- Each project must keep this same file for reference.  
- Updates originate in **Calnetic-Internal-Tools**; propagate new versions manually.  
- Version bumps follow semantic numbering: `v1.0`, `v1.1`, `v2.0`.  
- Project-specific trackers may extend this file or live beside it as  
  `BEST-PRACTICES-IMPLEMENTATION-TRACKER.md`.

---

**Maintainer:** _Jeff Martin Abayon_  
**Copyright © 2025_ Calnetic & SpecVerse Projects_
