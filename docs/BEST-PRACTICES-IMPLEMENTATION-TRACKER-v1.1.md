# Best Practices Implementation Tracker — v1.1

## 1. Frontend Optimization Checklist
### Rendering
[ ] Convert unnecessary client components to server components  
[ ] Remove redundant `"use client"`  
[ ] Add dynamic imports for heavy non-critical components  
[ ] Add memoization for expensive components  
[ ] Virtualize large tables  

### Data Fetching
[ ] Convert duplicate client fetches → server fetch  
[ ] Consolidate pagination for list pages  
[ ] Add caching where safe  
[ ] Remove unnecessary API calls on mount  

## 2. Backend Optimization Checklist
### Queries
[ ] Replace SELECT * in large tables  
[ ] Add missing indexes  
[ ] Eliminate N+1 patterns  
[ ] Consolidate multiple queries into fat queries  
[ ] Ensure database fields match domain types  

### Services
[ ] Move heavy logic out of controllers  
[ ] Add caching for constant reference tables  
[ ] Split large service files by domain  

### Middleware
[ ] Ensure verifyToken is early in the chain  
[ ] Enforce permission middleware for datasheet operations  

## 3. Datasheets Module Checklist
[ ] Unified Template + Filled Sheet loader  
[ ] Validate with Zod before saving  
[ ] Ensure layout builder reads normalized schema  
[ ] Ensure preview uses optimized projection  
[ ] Ensure exports use shared service logic  

## 4. Testing Checklist
### API tests
[ ] Templates CRUD  
[ ] Filled Sheets CRUD  
[ ] Notes + Attachments  
[ ] Verify/Approve/Reject flows  
[ ] Cloning  

### UI tests
[ ] Create template form  
[ ] Layout builder interactions  
[ ] Filled sheet editor  
[ ] Estimation list + items  
[ ] Inventory list  

### Schema tests
[ ] unifiedSheetSchema  
[ ] fullTemplateSchema  
[ ] verification schemas  

## 5. DevOps Checklist
[ ] Add build-time logging  
[ ] Add error-level logging for failed SQL queries  
[ ] Add server startup health check endpoint  

