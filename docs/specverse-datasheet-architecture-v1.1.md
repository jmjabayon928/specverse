# SpecVerse Datasheet Architecture — v1.1

## 1. Overview
SpecVerse Datasheets follow a domain-driven modular architecture:

### Core modules:
- Templates
- Subsheet definitions
- InfoTemplate definitions
- Filled Sheets
- InformationValues
- Layout Builder
- Export engine (Excel/PDF)
- Multi-language label translation

## 2. Template Structure
A template consists of:
- Template metadata
- Subsheet structure
- Info template definitions
- Layout definitions

### Performance considerations:
- Cache template + subsheet + field metadata  
- Prepare view-models server-side  
- Minimize client hydration  

## 3. Filled Sheet Structure
Filled sheets combine:
- Template structure
- User-provided values
- Audit/Revision info

### Performance considerations:
- Load filled sheet with a single join query  
- Preload translations  
- Only hydrate what the UI needs  
- Avoid loading full InfoTemplates in filled sheet mode  

## 4. Layout Builder
The builder manages:
- Dynamic drag/drop positioning
- Column/row coordinates
- InfoTemplate slots

### Performance considerations:
- Run expensive layout logic on the server  
- Minimize client-side DOM manipulation  
- Persist layout in a normalized format  
- Avoid deep object copying inside builder  

## 5. Export Logic (PDF/Excel)
### Shared architecture:
- One unified data loader  
- Excel + PDF read from same normalized structure  
- Decouple rendering from data logic  

### Performance considerations:
- Preprocess heavy calculations in service  
- Avoid duplicate DB calls  
- Cache translations  
- Avoid PDF binary buffering inside loops  

