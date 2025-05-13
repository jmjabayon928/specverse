// src/types/datasheetTypes.ts
export type TemplateField = {
    id: number;
    name: string;
    type: 'int' | 'decimal' | 'varchar';
    uom: string;
    options?: string[];
  };
  
  export type Subsheet = {
    id: number;
    name: string;
    templates: TemplateField[];
  };
  