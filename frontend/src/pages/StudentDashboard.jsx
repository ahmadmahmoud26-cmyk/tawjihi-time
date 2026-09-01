import { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/authStore';
import apiClient from '../utils/api';
import '../styles/dashboard.css';

export default function StudentDashboard() {
  const user = useAuthStore(state => state.user);
  const [dashboard, setDashboard] = useState(null);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboard();
    fetchStreak();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await apiClient.get('/students/dashboard');
      setDashboard(response.data.dashboard);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchStreak = async () => {
    try {
      const response = await apiClient.get('/students/streak');
      setDailyStreak(response.data.streak || 0);
    } catch (err) {
      console.error('Failed to load daily streak:', err);
    }
  };

  if (loading) return <div className="dashboard-loading">جاري تحميل لوحة الطالب...</div>;

  return (
    <div className="student-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>أهلاً {user?.name}</h1>
          <p className="grade-info">
            المرحلة الصفية: {dashboard?.student?.stage_name || 'غير محددة'}
            {dashboard?.student?.field_name ? ` - ${dashboard.student.field_name}` : ''}
          </p>
        </div>
      </header>

      <div className="dashboard-grid">
        <section className="card daily-streak-widget">
          <div className="daily-streak-flame" aria-hidden="true">🔥</div>
          <div>
            <p className="daily-streak-label">الستريك اليومي</p>
            <p className="daily-streak-value">{dailyStreak} <span>أيام</span></p>
            <p className="daily-streak-copy">سجّل دخولك يوميًا للمحافظة على ستريكك.</p>
          </div>
        </section>

      </div>
    </div>
  );
}
