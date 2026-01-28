// src/domain/projects/projectTypes.ts

// Basic project record
export interface Project {
  ProjectID: number
  ProjCode: string
  ProjName: string
  ProjNum?: string        // e.g. P-001
  ClientID?: number
  Description?: string
  StartDate?: string      // ISO string
  EndDate?: string        // ISO string
  Status?: 'Planned' | 'In Progress' | 'Completed' | 'On Hold'
}
