export interface ReferenceOption {
  id: number;
  name: string;
  logo?: string;
}

export interface ReferenceOptions {
  areas: ReferenceOption[];
  users: ReferenceOption[];
  manufacturers: ReferenceOption[];
  suppliers: ReferenceOption[];
  categories: ReferenceOption[];
  clients: ReferenceOption[];
  projects: ReferenceOption[];
}
