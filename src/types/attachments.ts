export interface AttachmentDTO {
  AttachmentID: number;
  SheetID: number;
  FileName: string; 
  StoredName: string; 
  MimeType: string;
  SizeBytes: number;
  Url: string; 
  CreatedAt: string;
  CreatedBy?: number | null;
}
