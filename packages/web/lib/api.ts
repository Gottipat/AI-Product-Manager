/**
 * @fileoverview API Client
 * @description Centralized API client for backend communication
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// Future: shared response wrapper
// interface ApiResponse<T> { success?: boolean; error?: string; data?: T; }

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
      meetings: Meeting[];
      items: MeetingItem[];
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
  meetingCount?: number;
  taskCount?: number;
  createdAt: string;
  updatedAt: string;
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
  startTime?: string;
  endTime?: string;
  status: string;
  durationMinutes?: number;
}

export interface MeetingItem {
  id: string;
  itemType: string;
  title: string;
  description?: string;
  assignee?: string;
  assigneeEmail?: string;
  status: string;
  priority?: string;
  dueDate?: string;
  createdAt: string;
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
