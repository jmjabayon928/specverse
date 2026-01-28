# TypeScript Guidelines (Jeff‑Style) — v1.1

## 1. Core Rules
- No `any`
- No implicit `any`
- No nested ternaries
- Prefer early returns
- Prefer positive conditions
- Use explicit types on functions
- Use union types instead of booleans when relevant
- Use discriminated unions for complex states

## 2. Folder Structure Rules
```
src/
  app/
  backend/
    controllers/
    services/
    routes/
    database/
  domain/
  validation/
  utils/
```

- Controllers: no logic  
- Services: domain logic  
- Database: only parameterized SQL  
- Domain: pure types/interfaces  
- Validation: Zod only  

## 3. Naming Conventions
- Types: PascalCase  
- Variables: camelCase  
- Constants: UPPER_SNAKE_CASE  
- File names: kebab-case  

## 4. React Guidelines
- No inline objects for props  
- Stabilize handlers with useCallback  
- Memoize heavy lists  
- Prefer server components  
- Only add `"use client"` when strictly required  

## 5. Node.js Guidelines
- No logic in routes  
- No direct SQL in controllers  
- Always use async/await  
- Wrap errors in AppError  
- Validate request body with Zod  
- Use typed SQL results with result.recordset  
