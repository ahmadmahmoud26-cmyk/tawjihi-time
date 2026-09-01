import { useEffect, useState } from 'react';
import apiClient from '../utils/api';
import '../styles/streak.css';

export default function StudentStreakPage() {
  const [streak, setStreak] = useState(0);
  const [lastLoginAt, setLastLoginAt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStreak = async () => {
      try {
        const response = await apiClient.get('/students/streak');
        setStreak(response.data.streak || 0);
        setLastLoginAt(response.data.lastLoginAt || null);
      } catch (error) {
        console.error('Error fetching streak:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStreak();
  }, []);

  if (loading) return <div className="dashboard-loading">جاري تحميل الستريك...</div>;

  return (
    <div className="streak-page">
      <section className="streak-card">
        <div className="streak-flame" aria-hidden="true">🔥</div>
        <p className="streak-eyebrow">الحضور اليومي</p>
        <h1>الستريك اليومي</h1>
        <div className="streak-number">{streak}</div>
        <p className="streak-days">{streak === 1 ? 'يوم متواصل' : 'أيام متواصلة'}</p>
        <p className="streak-message">
          {streak > 0 ? 'أحسنت، عد كل يوم وحافظ على تقدّمك.' : 'سجّل دخولك اليوم وابدأ أول ستريك لك.'}
        </p>
        {lastLoginAt && (
          <p className="streak-last-login">آخر تسجيل دخول: {new Date(`${lastLoginAt.replace(' ', 'T')}Z`).toLocaleString('ar-JO')}</p>
        )}
      </section>
    </div>
  );
}
