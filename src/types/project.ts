export type Project = {
  ProjectID: number;
  ProjCode: string;
  ProjName: string;
  ProjNum?: string; // Optional: used if you have project numbers like "P-001"
  ClientID?: number;
  Description?: string;
  StartDate?: string;  // ISO date string
  EndDate?: string;    // ISO date string
  Status?: 'Planned' | 'In Progress' | 'Completed' | 'On Hold';
};
