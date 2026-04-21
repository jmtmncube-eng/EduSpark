export type Role = 'STUDENT' | 'TUTOR' | 'ADMIN';
export type Subject = 'MATHEMATICS' | 'PHYSICAL_SCIENCES';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type Visibility = 'ALL' | 'GR10' | 'GR11' | 'GR12' | 'NONE';

export interface User {
  id: string;
  name: string;
  role: Role;
  pin: string | null;
  grade: number | null;
  xp: number;
  active: boolean;
  photo: string | null;
  createdAt: string;
  teacherId?: string | null;
  teacher?: { id: string; name: string } | null;
  students?: { id: string; name: string; grade: number }[];
}

export interface Question {
  id: string;
  subject: Subject;
  grade: number;
  topic: string;
  difficulty: Difficulty;
  question: string;
  options: string[];
  answer: string;
  solution: string | null;
  explanation?: string | null;
  visibility: Visibility;
  imageData: string | null;
  createdAt: string;
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
  assignmentId: string;
  assignment?: { title: string; subject: Subject; topic: string; grade: number };
  details?: ResultDetail[];
}

export interface CalendarNote {
  id: string;
  date: string;
  title: string;
  content: string | null;
  color: string;
  createdAt: string;
}

export interface CalendarRequest {
  id: string;
  noteId: string;
  studentId: string;
  studentName: string;
  message: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
  note?: { title: string; date: string };
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
