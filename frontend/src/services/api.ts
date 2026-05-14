import { enqueue as enqueueOffline, queueSize } from './offlineQueue';
import { emitDirty, type DirtyScope } from './events';

// Auto-emit data-dirty events after successful mutations so dashboards refresh
const DIRTY_RULES: { matches: (path: string, method: string) => boolean; scope: DirtyScope }[] = [
  { matches: (p, m) => m !== 'GET' && p.startsWith('/results'),         scope: 'results' },
  { matches: (p, m) => m !== 'GET' && p.startsWith('/assignments'),     scope: 'assignments' },
  { matches: (p, m) => m !== 'GET' && p.startsWith('/packs'),           scope: 'packs' },
  { matches: (p, m) => m !== 'GET' && p.startsWith('/calendar'),        scope: 'calendar' },
  { matches: (p, m) => m !== 'GET' && p.startsWith('/notifications'),   scope: 'notifications' },
  { matches: (p, m) => m !== 'GET' && p.startsWith('/tutor-requests'),  scope: 'tutors' },
  { matches: (p, m) => m !== 'GET' && p.startsWith('/students'),        scope: 'users' },
];

const BASE = '/api';

function getToken() {
  return localStorage.getItem('es_token');
}

/**
 * Detect a true network failure (offline, DNS, cors-network) — these throw a
 * TypeError before any response is received. HTTP error codes (4xx/5xx) reach
 * `res.ok === false` below, NOT this catch.
 */
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

const SAFE_TO_QUEUE = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const QUEUE_LABELS: Record<string, string> = {
  '/results': '📋 Quiz submission',
  '/results/practice': '📚 Practice session',
  '/calendar/requests': '📅 Calendar request',
  '/tutor-requests': '🙋 Tutor request',
  '/notifications': '🔔 Notification action',
};

function labelFor(path: string): string {
  for (const [prefix, label] of Object.entries(QUEUE_LABELS)) {
    if (path.startsWith(prefix)) return label;
  }
  return 'Pending change';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const method = (options.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  try {
    const res = await fetch(`${BASE}${path}`, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Request failed');
    }
    const data = await res.json();
    // Auto-emit data-dirty so listening components refresh
    const rule = DIRTY_RULES.find((r) => r.matches(path, method));
    if (rule) emitDirty(rule.scope, { path });
    return data;
  } catch (err) {
    // Network/offline failure on a mutation → queue it and tell the caller
    if (isNetworkError(err) && SAFE_TO_QUEUE.has(method)) {
      enqueueOffline({
        url: `${BASE}${path}`,
        method,
        body: options.body as string | undefined,
        contentType: headers['Content-Type'],
        needsAuth: !!token,
        label: labelFor(path),
      });
      // Throw a special marker so the calling component can display
      // a "saved offline" message instead of a hard error.
      const queued = new Error(`Saved offline — will sync when you reconnect (${queueSize()} pending).`);
      (queued as Error & { offline?: boolean }).offline = true;
      throw queued;
    }
    throw err;
  }
}

// ─── Auth ─────────────────────────────────────────────────────────
export const auth = {
  login: (value: string, role: 'student' | 'tutor' | 'admin') =>
    request<{ token?: string; user?: object; needsGrade?: boolean; name?: string; returning?: boolean }>(
      '/auth/login', { method: 'POST', body: JSON.stringify({ value, role }) }
    ),
  register: (name: string, grade: number, curriculum: 'CAPS' | 'IEB' = 'CAPS') =>
    request<{ token: string; user: object; isNew: boolean }>(
      '/auth/register', { method: 'POST', body: JSON.stringify({ name, grade, curriculum }) }
    ),
  registerTutor: (name: string, subjects: string[], teachGrades: number[]) =>
    request<{ token: string; user: object; isNew: boolean }>(
      '/auth/register-tutor', { method: 'POST', body: JSON.stringify({ name, subjects, teachGrades }) }
    ),
  // ─── PIN recovery via security question ────────────────────────
  recoverLookup: (name: string, role: 'student' | 'tutor' | 'admin') =>
    request<{ ok: true; question: string }>(
      '/auth/recover/lookup', { method: 'POST', body: JSON.stringify({ name, role }) }
    ),
  recoverVerify: (name: string, role: 'student' | 'tutor' | 'admin', answer: string) =>
    request<{ ok: true; pin: string; name: string }>(
      '/auth/recover/verify', { method: 'POST', body: JSON.stringify({ name, role, answer }) }
    ),
  setSecurityQuestion: (question: string, answer: string) =>
    request<{ ok: true }>(
      '/auth/security-question', { method: 'POST', body: JSON.stringify({ question, answer }) }
    ),
  securityStatus: () => request<{ set: boolean; question: string | null }>('/auth/security-status'),
};

// ─── Questions ────────────────────────────────────────────────────
export const questions = {
  list: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<object[]>(`/questions${q}`);
  },
  topics: (subject: string, grade: number) =>
    request<string[]>(`/questions/topics?subject=${subject}&grade=${grade}`),
  generate: (subject: string, grade: number, topic: string, count: number, difficulty?: string, curriculum: 'CAPS' | 'IEB' = 'CAPS') =>
    request<{ created: object[]; count: number; batchId: string | null }>(
      '/questions/generate', { method: 'POST', body: JSON.stringify({ subject, grade, topic, count, difficulty, curriculum }) }
    ),
  stats: (ids: string[]) => {
    if (!ids.length) return Promise.resolve({} as Record<string, QuestionStat>);
    return request<Record<string, QuestionStat>>(
      `/questions/stats?ids=${encodeURIComponent(ids.join(','))}`
    );
  },
  listBatches: () => request<{
    id: string; subject: string; grade: number; topic: string; requestedCount: number;
    difficulty: string | null; status: string; createdAt: string; questionCount: number;
    publishedCount: number; reviewCount: number; flaggedCount: number;
  }[]>('/questions/batches'),
  getBatch: (id: string) => request<{
    id: string; subject: string; grade: number; topic: string; status: string;
    createdAt: string; createdBy: { name: string; role: string };
    questions: {
      id: string; question: string; difficulty: string; topic: string; subject: string;
      options: string[]; answer: string; expectedSeconds: number;
      status?: string; validationErrors?: string[]; qualityFlag?: string | null;
    }[];
  }>(`/questions/batches/${id}`),
  deleteBatch: (id: string) => request<{ success: boolean }>(`/questions/batches/${id}`, { method: 'DELETE' }),
  approveBatch: (id: string) =>
    request<{ approved: number; failed: number; failedQuestions: { id: string; errors: string[] }[] }>(
      `/questions/batches/${id}/approve`, { method: 'POST' }
    ),
  discardBatch: (id: string) =>
    request<{ deleted: number; keptBecausePacked: number }>(
      `/questions/batches/${id}/discard`, { method: 'POST' }
    ),
  setStatus: (id: string, status: string) =>
    request<object>(`/questions/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  qualityReport: () =>
    request<{
      total: number;
      counts: { broken: number; trivial: number; low_discrimination: number; no_attempts: number; healthy: number };
      flagged: {
        id: string; question: string; topic: string; subject: string; grade: number;
        status: string; difficulty: string; attempts: number; correctRate: number;
        discrimination: number; flag: string;
      }[];
    }>('/questions/quality-report'),
  recomputeFlags: () =>
    request<{ updated: number; total: number }>('/questions/recompute-flags', { method: 'POST' }),
  create: (data: object) =>
    request<object>('/questions', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: object) =>
    request<object>(`/questions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  cycleVisibility: (id: string) =>
    request<object>(`/questions/${id}/visibility`, { method: 'PATCH' }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/questions/${id}`, { method: 'DELETE' }),
  bulkDelete: (ids: string[]) =>
    request<{ deleted: number; requested: number }>(
      '/questions/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }
    ),
  import: (text: string) =>
    request<{ created: object[]; count: number }>(
      '/questions/import', { method: 'POST', body: JSON.stringify({ text }) }
    ),
};

export interface QuestionStat {
  used: number;
  packCount: number;
  attempts: number;
  correctRate: number;
  discrimination: number;
  qualityFlag: 'broken' | 'trivial' | 'low_discrimination' | 'no_attempts' | null;
}

// ─── Assignments ──────────────────────────────────────────────────
export const assignments = {
  list: () => request<object[]>('/assignments'),
  get: (id: string) => request<object>(`/assignments/${id}`),
  create: (data: object) =>
    request<object>('/assignments', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: object) =>
    request<object>(`/assignments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/assignments/${id}`, { method: 'DELETE' }),
  live: (id: string) => request<{
    eligible: number; submitted: number; avgScore: number;
    latest: { id: string; userId: string; userName: string; score: number; correct: number; total: number; completedAt: string }[];
  }>(`/assignments/${id}/live`),
  heatmap: (id: string) => request<{
    rows: { index: number; questionId: string; question: string; difficulty: string; attempts: number; correctRate: number }[];
  }>(`/assignments/${id}/heatmap`),
};

// ─── Students ─────────────────────────────────────────────────────
export const students = {
  list: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<object[]>(`/students${q}`);
  },
  get: (id: string) => request<object>(`/students/${id}`),
  me: () => request<object>('/students/me/profile'),
  toggleActive: (id: string) =>
    request<object>(`/students/${id}/toggle-active`, { method: 'PATCH' }),
  toggleExamReadiness: (id: string) =>
    request<{ examReadinessUnlocked: boolean }>(`/students/${id}/toggle-exam-readiness`, { method: 'PATCH' }),
  resetPin: (id: string, customSuffix?: string) =>
    request<{ pin: string; user: object }>(
      `/students/${id}/reset-pin`, { method: 'POST', body: JSON.stringify({ customSuffix }) }
    ),
  updatePhoto: (id: string, photo: string) =>
    request<object>(`/students/${id}/photo`, { method: 'PATCH', body: JSON.stringify({ photo }) }),
};

// ─── Results ─────────────────────────────────────────────────────
export const results = {
  submit: (data: { assignmentId: string; answers: { questionId: string; selectedAnswer: string }[] }) =>
    request<object>('/results', { method: 'POST', body: JSON.stringify(data) }),
  submitPractice: (data: { questionIds: string[]; answers: { questionId: string; selectedAnswer: string | null; timeSpent: number }[]; topic: string; subject: string }) =>
    request<{ xpEarned: number }>('/results/practice', { method: 'POST', body: JSON.stringify(data) }),
  list: () => request<object[]>('/results'),
  get: (id: string) => request<object>(`/results/${id}`),
  byAssignment: (assignmentId: string) => request<object[]>(`/results/assignment/${assignmentId}`),
};

// ─── Calendar ─────────────────────────────────────────────────────
export const calendar = {
  notes: () => request<object[]>('/calendar/notes'),
  createNote: (data: {
    date: string; title: string; content?: string; color?: string;
    studentId?: string | null; kind?: string; sharedWithAdmin?: boolean;
  }) =>
    request<object>('/calendar/notes', { method: 'POST', body: JSON.stringify(data) }),
  updateNote: (id: string, data: object) =>
    request<object>(`/calendar/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteNote: (id: string) =>
    request<{ success: boolean }>(`/calendar/notes/${id}`, { method: 'DELETE' }),

  // Change requests
  createRequest: (data: {
    noteId?: string; message: string;
    requestType?: 'move' | 'new' | 'cancel';
    proposedDate?: string; proposedTitle?: string;
  }) =>
    request<object>('/calendar/requests', { method: 'POST', body: JSON.stringify(data) }),
  getRequests: () => request<object[]>('/calendar/requests'),
  updateRequest: (id: string, status: 'approved' | 'denied') =>
    request<object>(`/calendar/requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

// ─── Analytics ───────────────────────────────────────────────────
export const analytics = {
  overview: () => request<object>('/analytics/overview'),
  subjectPerformance: () => request<object[]>('/analytics/subject-performance'),
  topicPerformance: () => request<object[]>('/analytics/topic-performance'),
  weeklyActivity: () => request<object[]>('/analytics/weekly-activity'),
  difficultyBreakdown: () => request<object>('/analytics/difficulty-breakdown'),
  studentReport: (id: string) => request<object>(`/analytics/student-report/${id}`),
  aStudentFactory: () => request<{
    totals: { students: number; withAttempts: number };
    tiers: { a: number; b: number; c: number; d: number; none: number };
    velocity: {
      avgSlope: number;
      risers: { id: string; name: string; grade: number; avg: number; slope: number }[];
      strugglers: { id: string; name: string; grade: number; avg: number; slope: number }[];
    };
    recovery: { rate: number; wins: number; total: number };
    activity: { practiceLast7: number; assignmentsLast7: number };
    gradeSegments: { grade: number; students: number; avgScore: number; activeLast7: number; activeRatio: number }[];
  }>('/analytics/a-student-factory'),
};

// ─── Parent Access ────────────────────────────────────────────────
export const parent = {
  listPins: () => request<object[]>('/parent/pins'),
  createPin: (studentId: string, label?: string, expiryDays?: number) =>
    request<object>('/parent/pins', { method: 'POST', body: JSON.stringify({ studentId, label, expiryDays }) }),
  deletePin: (id: string) =>
    request<{ success: boolean }>(`/parent/pins/${id}`, { method: 'DELETE' }),
  view: (pin: string) => request<object>(`/parent/view/${pin}`),
};

// ─── Student search ───────────────────────────────────────────────
export const studentSearch = (q: string) =>
  request<{ id: string; name: string; grade: number; pin: string }[]>(`/students/search?q=${encodeURIComponent(q)}`);

// ─── Tutor Requests ───────────────────────────────────────────────
export const tutorRequests = {
  list: () => request<object[]>('/tutor-requests'),
  create: (studentId: string, note?: string) =>
    request<object>('/tutor-requests', { method: 'POST', body: JSON.stringify({ studentId, note }) }),
  updateStatus: (id: string, status: 'approved' | 'denied') =>
    request<object>(`/tutor-requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  cancel: (id: string) =>
    request<{ success: boolean }>(`/tutor-requests/${id}`, { method: 'DELETE' }),
};

export const availableStudents = (grade?: string) => {
  const q = grade ? `?grade=${grade}` : '';
  return request<object[]>(`/students/available${q}`);
};

// ─── Tutors (admin only) ──────────────────────────────────────────
export const tutors = {
  list: () => request<object[]>('/students/tutors'),
  toggleActive: (id: string) =>
    request<object>(`/students/tutors/${id}/toggle-active`, { method: 'PATCH' }),
  assignStudent: (studentId: string, tutorId: string | null) =>
    request<object>(`/students/${studentId}/assign-tutor`, { method: 'PATCH', body: JSON.stringify({ tutorId }) }),
};

// ─── Packs (Phase 1: shared question/document bundles) ────────────
export const packs = {
  list: () => request<object[]>('/packs'),
  get: (id: string) => request<object>(`/packs/${id}`),
  create: (data: object) =>
    request<object>('/packs', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: object) =>
    request<object>(`/packs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/packs/${id}`, { method: 'DELETE' }),
  share: (id: string, tutorIds: string[], note?: string) =>
    request<{ shared: number }>(`/packs/${id}/share`, { method: 'POST', body: JSON.stringify({ tutorIds, note }) }),
  unshare: (id: string, tutorId: string) =>
    request<{ success: boolean }>(`/packs/${id}/share/${tutorId}`, { method: 'DELETE' }),
  unlock: (id: string, studentIds: string[]) =>
    request<{ unlocked: number }>(`/packs/${id}/unlock`, { method: 'POST', body: JSON.stringify({ studentIds }) }),
  revokeUnlock: (id: string, studentId: string) =>
    request<{ success: boolean }>(`/packs/${id}/unlock/${studentId}`, { method: 'DELETE' }),
  listUnlocks: (id: string) => request<object[]>(`/packs/${id}/unlocks`),
  templates: () => request<{ id: string; title: string; description: string; emoji: string; mix: { EASY: number; MEDIUM: number; HARD: number } }[]>('/packs/templates/list'),
  fromTemplate: (data: { templateId: string; subject: string; grade: number; topic: string; title?: string }) =>
    request<object>('/packs/from-template', { method: 'POST', body: JSON.stringify(data) }),
  /**
   * Open a branded PDF in a new browser tab.
   *
   * We fetch with the auth header (the endpoint requires Bearer auth), then
   * convert the byte stream to a blob URL and `window.open` it. The browser's
   * built-in PDF viewer renders the document and exposes its own "Download" /
   * "Print" buttons, which is what most users actually want.
   *
   * Pop-up-blocker fallback: if `window.open` returns null we trigger the
   * direct-download `<a download>` flow so the user still gets the file.
   */
  openPdf: async (id: string, mode: 'worksheet' | 'memo', filenameHint?: string) => {
    const token = localStorage.getItem('es_token');
    const res = await fetch(`${BASE}/packs/${id}/pdf?mode=${mode}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Could not export PDF');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const filename = `${(filenameHint || 'pack').replace(/[^a-zA-Z0-9._-]/g, '_')}_${mode}.pdf`;

    const win = window.open(url, '_blank', 'noopener');
    if (!win) {
      // Pop-up blocked — fall back to direct download
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
    }
    // Keep the blob alive long enough for the new tab to load it
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  // Keep `downloadPdf` as an alias for any caller that still expects the
  // forced-download behaviour. Both go through `openPdf` now.
  downloadPdf: async (id: string, mode: 'worksheet' | 'memo', filenameHint?: string) => {
    return packs.openPdf(id, mode, filenameHint);
  },
};

// ─── PDF Documents (Phase 2) ──────────────────────────────────────
export const documents = {
  list: () => request<object[]>('/documents'),
  upload: async (file: File, meta: { title?: string; description?: string; documentKind?: string } = {}) => {
    const token = localStorage.getItem('es_token');
    const fd = new FormData();
    fd.append('file', file);
    if (meta.title) fd.append('title', meta.title);
    if (meta.description) fd.append('description', meta.description);
    if (meta.documentKind) fd.append('documentKind', meta.documentKind);
    const res = await fetch(`${BASE}/documents/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  },
  /**
   * Streamed-file URL with the JWT in a `?token=` param. The backend's
   * authMiddleware accepts this for browser-native requests (new-tab links).
   * Prefer `fileBlob()` for embedding — it keeps the token out of the URL.
   */
  fileUrl: (id: string) => {
    const token = localStorage.getItem('es_token') || '';
    return `${BASE}/documents/${id}/file?token=${encodeURIComponent(token)}`;
  },
  /**
   * Fetch the PDF as a blob using the Authorization header (no token in URL),
   * returning an object-URL ready to drop into an <iframe>/<object>. The
   * caller is responsible for `URL.revokeObjectURL` when done.
   */
  fileBlob: async (id: string): Promise<string> => {
    const token = localStorage.getItem('es_token');
    const res = await fetch(`${BASE}/documents/${id}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Could not load PDF');
    }
    return URL.createObjectURL(await res.blob());
  },
  update: (id: string, data: object) =>
    request<object>(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/documents/${id}`, { method: 'DELETE' }),
};

// ─── Notifications (Phase 4) ──────────────────────────────────────
export const notifications = {
  list: () => request<{ list: object[]; unread: number }>('/notifications'),
  unreadCount: () => request<{ unread: number }>('/notifications/unread-count'),
  markRead: (id: string) =>
    request<object>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () =>
    request<{ success: boolean }>('/notifications/read-all', { method: 'PATCH' }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/notifications/${id}`, { method: 'DELETE' }),
};

// ─── Onboarding (Phase 5) ─────────────────────────────────────────
export const onboarding = {
  get: () => request<{ completedSteps: string[]; dismissed: boolean }>('/onboarding'),
  patch: (data: { step?: string; dismissed?: boolean }) =>
    request<object>('/onboarding', { method: 'PATCH', body: JSON.stringify(data) }),
};

// ─── Audit log (admin only) ───────────────────────────────────────
export const audit = {
  list: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{
      total: number; limit: number; offset: number;
      entries: {
        id: string; action: string; entityType: string; entityId: string | null;
        meta: Record<string, unknown> | null; ip: string | null; createdAt: string;
        actor: { id: string; name: string; role: string } | null;
      }[];
    }>(`/audit${qs ? '?' + qs : ''}`);
  },
  actions: () => request<string[]>('/audit/actions'),
  entities: () => request<string[]>('/audit/entities'),
  summary: () => request<{ total: number; last7d: number; today: number; topActions: { action: string; count: number }[] }>('/audit/summary'),
  /** Trigger a CSV download honouring the current filters. */
  downloadCsv: async (params: Record<string, string>) => {
    const token = localStorage.getItem('es_token');
    const qs = new URLSearchParams({ ...params, format: 'csv' }).toString();
    const res = await fetch(`/api/audit?${qs}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!res.ok) throw new Error('Could not export CSV');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eduspark-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

// ─── SmartCoach — A-Student Recommendations ───────────────────────
export const recommendations = {
  me: () => request<{
    weakTopics: { topic: string; subject: string; avgScore: number; trend: string; suggestedPack: { id: string; title: string; coverEmoji: string; topic: string } | null }[];
    strongTopics: { topic: string; avgScore: number }[];
    mastery: { topic: string; subject: string; avgScore: number; attempts: number; trend: string }[];
    dailyGoal: { target: number; done: number; minutesToday: number; complete: boolean };
    streak: number;
    nextPack: { id: string; title: string; coverEmoji: string; topic: string | null } | null;
    totalAttempts: number;
    avgScore: number;
  }>('/recommendations/me'),
  spotlight: () => request<{
    id: string; name: string; grade: number; xp: number;
    status: 'at_risk' | 'inactive' | 'on_track' | 'thriving' | 'new';
    reason: string; avg: number; attempts: number;
    lastAttempt: string | null; daysSince: number;
    weakestTopic: string | null;
  }[]>('/recommendations/spotlight'),
};
