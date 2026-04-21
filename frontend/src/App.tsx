import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { getLvl } from './utils/helpers';
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
import ParentSession from './pages/ParentSession';

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
  if (user.role === 'PARENT') return <ParentSession />;

  const isAdmin = user.role === 'ADMIN';
  const isTutor = user.role === 'TUTOR';
  const isStaff = isAdmin || isTutor;

  return (
    <div id="app" style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 2 }}>
      <div className={`sov ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(false)} />

      <div className="main">
        <div className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>

          {/* Centre identity strip */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isStaff ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 17 }}>🔬</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--p)', fontFamily: 'var(--fh)', letterSpacing: '.01em' }}>EduSpark</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: isAdmin ? 'rgba(14,165,233,.14)' : 'rgba(20,184,166,.14)', color: isAdmin ? '#0ea5e9' : 'var(--p)', border: `1px solid ${isAdmin ? 'rgba(14,165,233,.3)' : 'rgba(20,184,166,.3)'}` }}>
                  {isAdmin ? 'Admin' : 'Tutor'}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 13, color: 'var(--t3)' }}>👋</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t)' }}>{user.name.split(' ')[0]}</span>
                {(() => { const lv = getLvl(user.xp || 0); return (
                  <span className={`lvl ${lv.cl}`} style={{ fontSize: 10, padding: '2px 8px' }}>{lv.ic} {lv.name}</span>
                ); })()}
              </div>
            )}
          </div>

          <div className="flex ia g2">
            {!isAdmin && (user.xp || 0) > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--p)' }}>⚡ {user.xp} XP</span>}
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
