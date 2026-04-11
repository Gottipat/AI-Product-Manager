import fs from 'fs';
import path from 'path';

// Resolve the root directory of the ai-backend
const BACKEND_ROOT = path.resolve(process.cwd());

// Storage directories
export const STORAGE_DIR = path.join(BACKEND_ROOT, 'uploads');
export const RECORDINGS_DIR = path.join(STORAGE_DIR, 'recordings');

/**
 * Initializes the storage directories if they do not exist
 */
export function initStorage() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
  }
}

/**
 * Gets the absolute filepath for a meeting recording
 */
export function getRecordingPath(meetingId: string): string {
  // Ensure the directory exists when we try to create an audio file
  initStorage();
  return path.join(RECORDINGS_DIR, `${meetingId}.webm`);
}
