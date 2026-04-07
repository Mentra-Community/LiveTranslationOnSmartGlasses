/**
 * Note-related type definitions
 */

export interface NoteI {
  id: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  sourceRecordingId?: string;
  tags: string[];
}

export interface CreateNoteRequestI {
  content: string;
  sourceRecordingId?: string;
  tags?: string[];
}

export interface UpdateNoteRequestI {
  content?: string;
  tags?: string[];
}