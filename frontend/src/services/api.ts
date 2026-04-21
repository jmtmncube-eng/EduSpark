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
  list: () => request<object[]>('/results'),
  get: (id: string) => request<object>(`/results/${id}`),
  byAssignment: (assignmentId: string) => request<object[]>(`/results/assignment/${assignmentId}`),
};

// ─── Calendar ─────────────────────────────────────────────────────
export const calendar = {
  notes: () => request<object[]>('/calendar/notes'),
  createNote: (data: object) =>
    request<object>('/calendar/notes', { method: 'POST', body: JSON.stringify(data) }),
  updateNote: (id: string, data: object) =>
    request<object>(`/calendar/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteNote: (id: string) =>
    request<{ success: boolean }>(`/calendar/notes/${id}`, { method: 'DELETE' }),
  // Change requests
  createRequest: (noteId: string, message: string) =>
    request<object>('/calendar/requests', { method: 'POST', body: JSON.stringify({ noteId, message }) }),
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
};

// ─── Parent Access ────────────────────────────────────────────────
export const parent = {
  listPins: () => request<object[]>('/parent/pins'),
  createPin: (studentId: string, label?: string) =>
    request<object>('/parent/pins', { method: 'POST', body: JSON.stringify({ studentId, label }) }),
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
