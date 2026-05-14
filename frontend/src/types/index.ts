export type Role = 'STUDENT' | 'TUTOR' | 'ADMIN' | 'PARENT';
export type Subject = 'MATHEMATICS' | 'PHYSICAL_SCIENCES';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type Visibility = 'ALL' | 'GR10' | 'GR11' | 'GR12' | 'NONE';
export type Curriculum = 'CAPS' | 'IEB';

export interface User {
  id: string;
  name: string;
  role: Role;
  pin: string | null;
  grade: number | null;
  curriculum?: Curriculum | null;
  xp: number;
  active: boolean;
  photo: string | null;
  createdAt: string;
  teacherId?: string | null;
  teacher?: { id: string; name: string } | null;
  students?: { id: string; name: string; grade: number }[];
  subjects?: string[];
  teachGrades?: number[];
  examReadinessUnlocked?: boolean;
  // Parent session fields
  label?: string;
  studentId?: string;
  daysLeft?: number;
}

export type QuestionStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'RETIRED';

export interface Question {
  id: string;
  subject: Subject;
  grade: number;
  topic: string;
  curriculum?: Curriculum;
  difficulty: Difficulty;
  question: string;
  options: string[];
  answer: string;
  solution: string | null;
  explanation?: string | null;
  visibility: Visibility;
  imageData: string | null;
  createdAt: string;
  // v2.9 — quality & review pipeline
  status?: QuestionStatus;
  capsCode?: string | null;
  cognitiveLevel?: number | null;
  qualityFlag?: string | null;
  validationErrors?: string[];
  reviewedAt?: string | null;
}

export interface AssignmentDocument {
  id: string;
  title: string;
  content: string | null;
  imageData: string | null;
  documentType: string;
}

export interface Assignment {
  id: string;
  title: string;
  subject: Subject;
  grade: number;
  topic: string;
  dueDate: string;
  assignTo: string;
  maxAttempts: number;
  tutorId: string | null;
  createdAt: string;
  createdBy?: { id: string; name: string; role: Role };
  questions: { question: Question; order: number }[];
  documents: AssignmentDocument[];
  results?: QuizResult[];
  _count?: { results: number };
}

export interface ResultDetail {
  id: string;
  questionText: string;
  selectedAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  solution: string | null;
  difficulty: string;
  imageData: string | null;
  question?: { options: string[] } | null;
}

export type ResultType = 'ASSIGNMENT' | 'PRACTICE';

export interface QuizResult {
  id: string;
  score: number;
  correct: number;
  total: number;
  timeTaken: number;
  xpEarned: number;
  completedAt: string;
  attemptNumber?: number;
  userId?: string;
  resultType?: ResultType;
  assignmentId?: string | null;
  practiceTopic?: string | null;
  practiceSubject?: string | null;
  assignment?: { title: string; subject: Subject; topic: string; grade: number } | null;
  details?: ResultDetail[];
}

export interface CalendarNote {
  id: string;
  date: string;
  title: string;
  content: string | null;
  color: string;
  createdAt: string;
  // Phase 7
  kind?: string;
  tutorId?: string | null;
  studentId?: string | null;
  sharedWithAdmin?: boolean;
  tutor?: { id: string; name: string } | null;
  student?: { id: string; name: string } | null;
}

export interface CalendarRequest {
  id: string;
  noteId: string | null;
  studentId: string;
  studentName: string;
  message: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
  requestType?: 'move' | 'new' | 'cancel';
  proposedDate?: string | null;
  proposedTitle?: string | null;
  tutorId?: string | null;
  note?: { title: string; date: string } | null;
  student?: { id: string; name: string; grade: number };
}

export interface TutorRequest {
  id: string;
  tutorId: string;
  studentId: string;
  status: 'pending' | 'approved' | 'denied';
  note: string | null;
  createdAt: string;
  tutor?: { id: string; name: string; pin?: string | null };
  student?: { id: string; name: string; grade: number; xp?: number; pin?: string | null; teacherId?: string | null };
}

export interface AvailableStudent {
  id: string;
  name: string;
  grade: number;
  xp: number;
  active: boolean;
  createdAt: string;
  results: { score: number }[];
}

export interface Level {
  name: string;
  cl: string;
  ic: string;
  min: number;
  next: number;
}

// ─── Phase 1: Packs & Sharing ─────────────────────────────────────
export interface PdfDocument {
  id: string;
  title: string;
  description: string | null;
  filePath: string;
  fileSize: number;
  pageCount: number;
  documentKind: string;
  uploadedById: string;
  createdAt: string;
  uploadedBy?: { id: string; name: string };
}

export interface PackQuestionItem {
  questionId: string;
  order: number;
  question: Question;
}

export interface PackDocumentItem {
  documentId: string;
  order: number;
  document: PdfDocument;
}

export interface Pack {
  id: string;
  title: string;
  description: string | null;
  subject: Subject;
  grade: number;
  topic: string | null;
  coverEmoji: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  createdBy?: { id: string; name: string; role: Role };
  questions: PackQuestionItem[];
  documents: PackDocumentItem[];
  _count?: { shares: number; unlocks: number };
  sharedAt?: string;
  shareNote?: string | null;
  unlockedAt?: string;
  source?: 'own' | 'admin';
}

// ─── Phase 4: Notifications ───────────────────────────────────────
export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

// ─── Phase 5: Onboarding ──────────────────────────────────────────
export interface OnboardingState {
  completedSteps: string[];
  dismissed: boolean;
}
