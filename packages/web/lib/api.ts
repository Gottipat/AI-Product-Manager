/**
 * @fileoverview API Client
 * @description Centralized API client for backend communication
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';
export const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3002';

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Include cookies for auth
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
}

// Auth API
export const authApi = {
  signup: (email: string, password: string, displayName: string) =>
    apiFetch<{ user: User }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    }),

  signin: (email: string, password: string) =>
    apiFetch<{ user: User }>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    apiFetch<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    }),

  me: () => apiFetch<{ user: User }>('/auth/me'),
};

// Projects API
export const projectsApi = {
  list: () => apiFetch<{ projects: Project[] }>('/projects'),

  get: (id: string) =>
    apiFetch<{
      project: Project;
      accessRole: ProjectAccessRole;
      meetings: Meeting[];
      items: MeetingItem[];
      moms: Record<string, MoM>;
      collaborators: ProjectCollaborator[];
      stats: ProjectStats;
    }>(`/projects/${id}`),

  create: (data: CreateProjectInput) =>
    apiFetch<{ project: Project; isExisting?: boolean }>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Project>) =>
    apiFetch<{ project: Project }>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateLink: (id: string, googleMeetLink: string) =>
    apiFetch<{ project: Project }>(`/projects/${id}/link`, {
      method: 'POST',
      body: JSON.stringify({ googleMeetLink }),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/projects/${id}`, {
      method: 'DELETE',
    }),

  listCollaborators: (id: string) =>
    apiFetch<{ collaborators: ProjectCollaborator[] }>(`/projects/${id}/collaborators`),

  inviteCollaborator: (
    id: string,
    data: { email: string; role: Exclude<ProjectAccessRole, 'owner' | null> }
  ) =>
    apiFetch<{
      collaborator: ProjectCollaborator;
      activatedImmediately: boolean;
    }>(`/projects/${id}/collaborators`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const collaboratorsApi = {
  update: (
    collaboratorId: string,
    data: {
      role?: Exclude<ProjectAccessRole, 'owner' | null>;
      status?: ProjectCollaboratorStatus;
    }
  ) =>
    apiFetch<{ collaborator: ProjectCollaborator }>(`/collaborators/${collaboratorId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (collaboratorId: string) =>
    apiFetch<{ success: boolean }>(`/collaborators/${collaboratorId}`, {
      method: 'DELETE',
    }),
};

// Search/Chat API
export const ragApi = {
  search: (query: string, projectId?: string) =>
    apiFetch<{ results: SearchResult[] }>('/search', {
      method: 'POST',
      body: JSON.stringify({ query, meetingId: projectId }),
    }),

  getContext: (query: string, projectId?: string) =>
    apiFetch<{ context: string; sources: string[] }>('/context', {
      method: 'POST',
      body: JSON.stringify({ query, meetingId: projectId, maxTokens: 8000 }),
    }),
};

// Bot API
export const botApi = {
  join: (meetLink: string, meetingTitle?: string) =>
    apiFetch<{ sessionId: string; status: string; message: string }>('/bot/join', {
      method: 'POST',
      body: JSON.stringify({ meetLink, meetingTitle }),
    }),

  status: (sessionId: string) =>
    apiFetch<{
      sessionId: string;
      status: string;
      meetLink: string;
      startedAt: string;
      recentLogs: string[];
    }>(`/bot/status/${sessionId}`),

  stop: (sessionId: string) =>
    apiFetch<{ message: string; status: string }>(`/bot/stop/${sessionId}`, {
      method: 'POST',
    }),

  sessions: () =>
    apiFetch<{
      sessions: Array<{
        sessionId: string;
        status: string;
        meetLink: string;
        startedAt: string;
      }>;
    }>('/bot/sessions'),
};

// Transcript Upload API
export interface TranscriptUploadOptions {
  analysisMode?: 'general' | 'product_manager';
  contextNote?: string;
}

export const transcriptApi = {
  upload: (
    projectId: string,
    title: string,
    transcript: string,
    options: TranscriptUploadOptions = {}
  ) =>
    apiFetch<UploadResult>(`/projects/${projectId}/upload-transcript`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        transcript,
        analysisMode: options.analysisMode ?? 'product_manager',
        contextNote: options.contextNote,
      }),
    }),
};

// Meetings API
export const meetingsApi = {
  list: (organizationId: string) =>
    apiFetch<{ meetings: Meeting[] }>(`/organizations/${organizationId}/meetings`),

  get: (id: string) =>
    apiFetch<{ meeting: Meeting }>(`/meetings/${id}`),

  getTranscripts: (id: string) =>
    apiFetch<{ events: TranscriptEvent[] }>(`/meetings/${id}/transcripts`),

  getItems: (id: string) =>
    apiFetch<{ items: MeetingItem[] }>(`/meetings/${id}/items`),

  generateMom: (id: string) =>
    apiFetch<MoMGenerationResult>(`/meetings/${id}/generate-mom`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  extractItems: (id: string) =>
    apiFetch<ItemExtractionResult>(`/meetings/${id}/extract-items`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  getAiStatus: (id: string) =>
    apiFetch<AiStatus>(`/meetings/${id}/ai-status`),
};

export const meetingItemsApi = {
  updateStatus: (id: string, status: MeetingItemStatus, updatedBy?: string) =>
    apiFetch<{ item: MeetingItem }>(`/items/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, updatedBy }),
    }),

  update: (id: string, data: MeetingItemUpdateInput) =>
    apiFetch<{ item: MeetingItem }>(`/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// MoM API
export const momApi = {
  getByMeeting: (meetingId: string) =>
    apiFetch<{ mom: MoM }>(`/meetings/${meetingId}/mom`),

  getHighlights: (meetingId: string) =>
    apiFetch<{ highlights: Highlight[] }>(`/meetings/${meetingId}/highlights`),
};

// Types
export interface User {
  id: string;
  email: string;
  displayName: string;
  organizationId?: string;
  role: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  googleMeetLink?: string;
  isRecurring: boolean;
  status: string;
  accessRole?: ProjectAccessRole;
  meetingCount?: number;
  taskCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type ProjectAccessRole = 'owner' | 'editor' | 'viewer' | null;
export type ProjectCollaboratorStatus = 'pending' | 'active' | 'revoked';

export interface ProjectCollaborator {
  id: string;
  projectId: string;
  userId?: string | null;
  email: string;
  role: Exclude<ProjectAccessRole, null>;
  status: ProjectCollaboratorStatus;
  invitedBy?: string | null;
  invitedAt?: string | null;
  acceptedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  displayName?: string | null;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  googleMeetLink?: string;
  isRecurring?: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  projectId?: string | null;
  startTime?: string;
  endTime?: string;
  status: string;
  durationMinutes?: number;
  captureSource?: string;
  totalTranscriptEvents?: number;
  project?: {
    id: string;
    name: string;
  } | null;
}

export interface TranscriptEvent {
  id: string;
  speaker: string;
  content: string;
  sequenceNumber: number;
  isFinal: boolean;
  confidence?: number;
  capturedAt: string;
}

export interface AiStatus {
  status: 'idle' | 'pending' | 'fetching_transcript' | 'generating' | 'saving' | 'completed' | 'error';
  progress?: number;
  message: string;
}

export type MeetingItemStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'deferred'
  | 'cancelled';

export interface MeetingItem {
  id: string;
  meetingId: string;
  projectId?: string;
  itemType: string;
  title: string;
  description?: string;
  assignee?: string;
  assigneeEmail?: string;
  status: MeetingItemStatus;
  priority?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MeetingItemUpdateInput {
  title?: string;
  description?: string | null;
  assignee?: string | null;
  assigneeEmail?: string | null;
  dueDate?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'critical' | null;
}

export interface ProjectStats {
  totalMeetings: number;
  totalItems: number;
  pendingItems: number;
  completedItems: number;
}

export interface SearchResult {
  content: string;
  score: number;
  meetingId: string;
  type: string;
}

export interface MoM {
  id: string;
  meetingId: string;
  executiveSummary?: string;
  detailedSummary?: string;
  attendanceSummary?: Record<string, unknown>;
  aiModelVersion?: string;
  overallConfidence?: number;
  processingTimeMs?: number;
  generatedAt: string;
}

export interface MoMGenerationResult {
  success: boolean;
  momId: string | null;
  highlightsCreated: number;
  itemsCreated: number;
  processingTimeMs: number;
  error?: string;
}

export interface ItemExtractionResult {
  success: boolean;
  itemsCreated: number;
  stats: {
    total: number;
    byType: Record<string, number>;
    withAssignee: number;
    withDueDate: number;
  };
  processingTimeMs: number;
  error?: string;
}

export interface Highlight {
  id: string;
  meetingId: string;
  momId?: string;
  highlightType: string;
  content: string;
  speaker?: string;
  importance?: number;
  keywords?: string[];
}

export interface UploadResult {
  success: boolean;
  meetingId: string;
  transcriptEventsCreated: number;
  momGeneration: {
    success: boolean;
    momId: string | null;
    highlightsCreated: number;
    itemsCreated: number;
    processingTimeMs: number;
    error?: string;
  };
}
