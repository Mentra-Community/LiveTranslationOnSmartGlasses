/**
 * Recording-related type definitions
 */

export enum RecordingStatusE {
  IDLE = 'idle',
  RECORDING = 'recording',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export interface RecordingI {
  id: string;
  title: string;
  duration: number;
  transcript: string;
  isRecording: boolean;
  status?: RecordingStatusE;
  fileUrl?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  relatedNoteIds?: string[];
}

export interface TranscriptUpdateI {
  recordingId: string;
  text: string;
  timestamp: number;
}