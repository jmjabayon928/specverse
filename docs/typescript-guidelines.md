# SpecVerse TypeScript Guidelines

This document contains the unified TypeScript best practices for the SpecVerse codebase,
inspired by:

- *TypeScript Deep Dive* by Basarat  
- Total TypeScript by Matt Pocock  
- *Effective TypeScript* by Dan Vanderkam  
- Node.js Best Practices  
- Clean Code principles  

All frontend and backend code MUST follow these conventions.

---

# 1. General TypeScript Philosophy

- **TypeScript first, JavaScript second.**
- Prefer **inference** wherever possible.
- Avoid `any` completely.
- Avoid `enum`; use union types.
- Prefer `undefined` over `null`.

---

# 2. Types & Domain Models

## 2.1 Use `type` not `interface` (unless extending)

```ts
export type Estimation = {
  id: number
  name: string
  projectId: number
}
2.2 Prefer exact types instead of loose shapes
❌ Avoid:

ts
Copy code
type Item = {
  [key: string]: any
}
✅ Use well-defined fields.

3. Discriminated Unions
Make invalid states impossible.

ts
Copy code
export type EstimationStatus =
  | { kind: 'draft' }
  | { kind: 'submitted' }
  | { kind: 'approved'; approvedBy: string }
  | { kind: 'rejected'; reason: string }
4. Exhaustive Checking with never
ts
Copy code
const statusLabel = (status: EstimationStatus): string => {
  switch (status.kind) {
    case 'draft':
      return 'Draft'
    case 'submitted':
      return 'Submitted'
    case 'approved':
      return 'Approved'
    case 'rejected':
      return 'Rejected'
    default: {
      const _exhaustiveCheck: never = status
      return _exhaustiveCheck
    }
  }
}
5. Function & Code Style
Arrow functions everywhere (90% usage)

No semicolons

2-space indentation

Single quotes

Prefer pure functions

Return early

No deeply nested logic

ts
Copy code
export const calculateTotal = (lines: EstimationLine[]): number =>
  lines.reduce((sum, line) => sum + line.amount, 0)
6. Zod for Runtime Validation
ts
Copy code
import { z } from 'zod'

export const CreateEstimationSchema = z.object({
  name: z.string().min(1),
  projectId: z.number().int()
})

export type CreateEstimationInput = z.infer<typeof CreateEstimationSchema>
7. Error Handling (Node.js Best Practices)
ts
Copy code
export class AppError extends Error {
  constructor(message: string, public readonly statusCode = 500) {
    super(message)
  }
}
ts
Copy code
export const errorMiddleware = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message })
  }

  return res.status(500).json({ error: 'Internal server error' })
}
8. Architecture Folder Structure
pgsql
Copy code
src/
  app/
    (admin)/
      datasheets/
      estimations/
  backend/
    routes/
    controllers/
    services/
    repositories/
    schemas/
    middleware/
    errors/
  domain/
    estimation/
      estimation.types.ts
      estimation.schema.ts
      estimation.mappers.ts
    datasheets/
    inventory/
  shared/
    types/
    utils/
    constants/
9. Repository / DB Access Rules
Repositories ONLY access the database.

Services NEVER talk to the database directly.

Controllers NEVER contain business logic.

Routes ONLY define endpoints.

10. Clean Code Rules
Small, composable functions

One responsibility per file

No magic numbers

Clear and meaningful names

DRY — avoid duplication

Prefer composition over inheritance

11. Testing Philosophy
Unit test services

Integration test controllers

Test validation schemas

Mock behaviors, not types

Avoid unnecessary test complexity

12. Summary
SpecVerse must reflect professional-grade, enterprise TypeScript:

Strong domain models

Safe runtime validation

Layered architecture

Predictable errors

High readability

Zero use of any

This standard ensures the codebase is scalable, maintainable, and professional for years to come.