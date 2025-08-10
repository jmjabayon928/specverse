export interface SheetNoteDTO {
  NoteID: number;
  SheetID: number;
  NoteTypeID: number;
  NoteType: string;
  NoteText: string;
  OrderIndex: number;
  CreatedAt: string;
  UpdatedAt: string | null;
}
