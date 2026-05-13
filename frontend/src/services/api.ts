const BASE = '/api';

function getToken() {
  return localStorage.getItem('es_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// ─── Auth ─────────────────────────────────────────────────────────
export const auth = {
  login: (value: string, role: 'student' | 'tutor' | 'admin') =>
    request<{ token?: string; user?: object; needsGrade?: boolean; name?: string; returning?: boolean }>(
      '/auth/login', { method: 'POST', body: JSON.stringify({ value, role }) }
    ),
  register: (name: string, grade: number) =>
    request<{ token: string; user: object; isNew: boolean }>(
      '/auth/register', { method: 'POST', body: JSON.stringify({ name, grade }) }
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
  generate: (subject: string, grade: number, topic: string, count: number) =>
    request<{ created: object[]; count: number }>(
      '/questions/generate', { method: 'POST', body: JSON.stringify({ subject, grade, topic, count }) }
    ),
  create: (data: object) =>
    request<object>('/questions', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: object) =>
    request<object>(`/questions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  cycleVisibility: (id: string) =>
    request<object>(`/questions/${id}/visibility`, { method: 'PATCH' }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/questions/${id}`, { method: 'DELETE' }),
  import: (text: string) =>
    request<{ created: object[]; count: number }>(
      '/questions/import', { method: 'POST', body: JSON.stringify({ text }) }
    ),
};

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
  gradeSegments: () => request<{
    segments: { grade: number; students: { id: string; name: string; grade: number; xp: number; pin: string; teacher: { id: string; name: string } | null }[] }[];
  }>('/analytics/grade-segments'),
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
  /**
   * Trigger a branded PDF download. The browser handles the byte stream — we just
   * need to attach the auth token via a one-off fetch and force a blob download.
   */
  downloadPdf: async (id: string, mode: 'worksheet' | 'memo', filenameHint?: string) => {
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
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(filenameHint || 'pack').replace(/[^a-zA-Z0-9._-]/g, '_')}_${mode}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
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
  fileUrl: (id: string) => {
    const token = localStorage.getItem('es_token') || '';
    return `${BASE}/documents/${id}/file?token=${encodeURIComponent(token)}`;
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
