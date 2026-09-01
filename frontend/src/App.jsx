import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from './utils/authStore';
import { useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';

// Pages
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminStudentPage from './pages/AdminStudentPage';
import AdminExamPage from './pages/AdminExamPage';
import AdminResultsPage from './pages/AdminResultsPage';
import AdminAuditPage from './pages/AdminAuditPage';
import AdminManagementPage from './pages/AdminManagementPage';
import AdminSubjectsPage from './pages/AdminSubjectsPage';
import AdminNotesPage from './pages/AdminNotesPage';
import AdminAnnouncementsPage from './pages/AdminAnnouncementsPage';
import ExamPage from './pages/ExamPage';
import ResultsPage from './pages/ResultsPage';
import CurriculumPage from './pages/CurriculumPage';
import StudentNotesPage from './pages/StudentNotesPage';
import StudentAnnouncementsPage from './pages/StudentAnnouncementsPage';
import StudentSubjectsPage from './pages/StudentSubjectsPage';
import PublicChatPage from './pages/PublicChatPage';
import ChatPage from './pages/ChatPage';
import CompleteProfilePage from './pages/CompleteProfilePage';
import Navigation from './components/Navigation';

function GlobalBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  const isLoginRoute = location.pathname === '/login' || location.pathname === '/';

  if (isLoginRoute) return null;

  const goBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
      return;
    }

    navigate(user?.role === 'student' ? '/dashboard' : '/admin/dashboard');
  };

  return (
    <div style={{ padding: '16px 20px 0' }}>
      <button
        type="button"
        onClick={goBack}
        style={{
          border: 'none',
          background: '#1f2937',
          color: '#fff',
          padding: '10px 16px',
          borderRadius: '10px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          boxShadow: '0 8px 20px rgba(15, 23, 42, 0.15)',
        }}
      >
        ← رجوع
      </button>
    </div>
  );
}

function AppRouter() {
  const { user, token } = useAuthStore();

  useEffect(() => {
    const error = useAuthStore.getState().error;
    if (error) {
      toast.error(error);
    }
  }, []);

  return (
    <>
      <Toaster position="top-right" />
      {token && <Navigation />}
      <GlobalBackButton />
      <Routes>
        {!token ? (
          <>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <>
            {user?.role === 'student' && (
              <>
                <Route path="/complete-profile" element={<CompleteProfilePage />} />
                <Route path="/dashboard" element={<StudentDashboard />} />
                <Route path="/exams" element={<ExamPage />} />
                <Route path="/results" element={<ResultsPage />} />
                <Route path="/curriculum" element={<CurriculumPage />} />
                <Route path="/notes" element={<StudentNotesPage />} />
                <Route path="/announcements" element={<StudentAnnouncementsPage />} />
                <Route path="/my-subjects" element={<StudentSubjectsPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/messages" element={<ChatPage />} />
                <Route path="/private-table" element={<ChatPage />} />
                <Route path="/public-chat" element={<PublicChatPage />} />
                <Route path="/public" element={<PublicChatPage />} />
                <Route path="/" element={<Navigate to={user?.grade_id == null ? '/complete-profile' : '/dashboard'} replace />} />
              </>
            )}

            {(user?.role === 'admin' || user?.role === 'super_admin') && (
              <>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/students" element={<AdminStudentPage />} />
                <Route path="/admin/subjects" element={<AdminSubjectsPage />} />
                <Route path="/admin/exams" element={<AdminExamPage />} />
                <Route path="/admin/results" element={<AdminResultsPage />} />
                <Route path="/admin/notes" element={<AdminNotesPage />} />
                <Route path="/admin/announcements" element={<AdminAnnouncementsPage />} />
                <Route path="/admin/audit" element={<AdminAuditPage />} />
                <Route path="/admin/management" element={user?.role === 'super_admin' && user?.email?.toLowerCase() === 'ahmad169qyp12q@gmail.com' ? <AdminManagementPage /> : <Navigate to="/admin/dashboard" replace />} />
                <Route path="/admin/messages" element={<ChatPage />} />
                <Route path="/admin/chat" element={<ChatPage />} />
                <Route path="/public-chat" element={<PublicChatPage />} />
                <Route path="/public" element={<PublicChatPage />} />
                <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
              </>
            )}

            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppRouter />
    </Router>
  );
}

export default App;
