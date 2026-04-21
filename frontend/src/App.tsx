import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';
import Background from './components/Background';
import ToastContainer from './components/Toast';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminQuestions from './pages/admin/Questions';
import AdminAssignments from './pages/admin/Assignments';
import AdminStudents from './pages/admin/Students';
import AdminAnalytics from './pages/admin/Analytics';
import AdminCalendar from './pages/admin/Calendar';
import AdminStudentReport from './pages/admin/StudentReport';
import AdminParentPins from './pages/admin/ParentPins';
import AdminTutors from './pages/admin/Tutors';
import ParentView from './pages/ParentView';

// Student pages
import StudentDashboard from './pages/student/Dashboard';
import StudentQuestions from './pages/student/Questions';
import StudentProgress from './pages/student/Progress';
import StudentHistory from './pages/student/History';
import StudentCalendar from './pages/student/Calendar';
import QuizPage from './pages/student/Quiz';
import ResultsPage from './pages/student/Results';
import ExamReadiness from './pages/student/ExamReadiness';
import StudentMyWork from './pages/student/MyWork';

function AppShell() {
  const { user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pageTitle: Record<string, string> = {
    '/app/dashboard': user?.role === 'ADMIN' ? '📊 Dashboard' : '🏠 Dashboard',
    '/app/questions': user?.role === 'ADMIN' ? '📝 Question Bank' : '📚 Question Bank',
    '/app/assignments': '📋 Assignments',
    '/app/students': '👥 Students & PINs',
    '/app/analytics': '📈 Analytics',
    '/app/calendar': '📅 Calendar',
    '/app/parent-pins': '🔑 Parent Access',
    '/app/tutors': '📚 Tutors',
    '/app/my-work': '📋 My Work',
    '/app/progress': '📈 My Progress',
    '/app/history': '🗂 Quiz History',
    '/app/exam-readiness': '🎯 Exam Readiness',
    '/app/quiz': '📝 Quiz',
    '/app/results': '🏆 Results',
  };

  const reportMatch = location.pathname.match(/^\/app\/report\//);
  const title = pageTitle[location.pathname] || (reportMatch ? '📊 Student Report' : 'EduSpark');

  if (!user) return <Navigate to="/" replace />;

  const isAdmin = user.role === 'ADMIN';
  const isTutor = user.role === 'TUTOR';
  const isStaff = isAdmin || isTutor;

  return (
    <div id="app" style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 2 }}>
      <div className={`sov ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(false)} />

      <div className="main">
        <div className="topbar">
          <div className="flex ia g1">
            <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
            <div className="tb-t">{title}</div>
          </div>
          <div className="flex ia g2">
            {!isAdmin && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--p)' }}>⚡ {user.xp || 0} XP</span>}
          </div>
        </div>

        <div className="pg">
          <Routes>
            {isStaff ? (
              <>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="questions" element={<AdminQuestions />} />
                <Route path="assignments" element={<AdminAssignments />} />
                <Route path="students" element={<AdminStudents />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="calendar" element={<AdminCalendar />} />
                <Route path="report/:studentId" element={<AdminStudentReport />} />
                <Route path="parent-pins" element={<AdminParentPins />} />
                {isAdmin && <Route path="tutors" element={<AdminTutors />} />}
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </>
            ) : (
              <>
                <Route path="dashboard" element={<StudentDashboard />} />
                <Route path="questions" element={<StudentQuestions />} />
                <Route path="my-work" element={<StudentMyWork />} />
                <Route path="progress" element={<StudentProgress />} />
                <Route path="history" element={<StudentHistory />} />
                <Route path="calendar" element={<StudentCalendar />} />
                <Route path="exam-readiness" element={<ExamReadiness />} />
                <Route path="quiz/:assignmentId" element={<QuizPage />} />
                <Route path="results/:resultId" element={<ResultsPage />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </>
            )}
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();

  useEffect(() => {
    const saved = localStorage.getItem('es_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  return (
    <>
      <Background />
      <ToastContainer />
      <Routes>
        <Route path="/" element={user ? <Navigate to="/app/dashboard" replace /> : <Login />} />
        <Route path="/parent/:pin" element={<ParentView />} />
        <Route path="/app/*" element={<AppShell />} />
      </Routes>
    </>
  );
}
