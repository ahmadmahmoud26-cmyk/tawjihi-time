import { useEffect, useState } from 'react';
import { useAuthStore } from '../utils/authStore';
import apiClient from '../utils/api';
import '../styles/dashboard.css';

export default function StudentSubjectsPage() {
  const user = useAuthStore(state => state.user);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await apiClient.get(`/students/${user.id}/subjects`);
        setSubjects(response.data.subjects || []);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'فشل في تحميل المواد');
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) fetchSubjects();
  }, [user?.id]);

  if (loading) return <div className="dashboard-loading">جاري تحميل المواد...</div>;

  return (
    <div className="student-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>موادي</h1>
          <p>المواد التي اختارتها الإدارة لحسابك</p>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      <section className="card full-width">
        {subjects.length === 0 ? (
          <p className="empty-state">لم تُسجّل لك مواد بعد.</p>
        ) : (
          <div className="subject-list">
            {subjects.map(subject => (
              <article key={subject.id} className="subject-item">
                <h4>{subject.name}</h4>
                {subject.description && <p>{subject.description}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
