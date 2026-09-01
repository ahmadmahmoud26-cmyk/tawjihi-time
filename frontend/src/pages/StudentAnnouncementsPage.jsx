import { useEffect, useState } from 'react';
import apiClient from '../utils/api';
import '../styles/dashboard.css';

export default function StudentAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const response = await apiClient.get('/announcements?perPage=100');
        setAnnouncements(response.data.announcements || []);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'فشل في تحميل الإعلانات');
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
  }, []);

  if (loading) return <div className="dashboard-loading">جاري تحميل الإعلانات...</div>;

  return (
    <div className="student-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>الإعلانات</h1>
          <p>الإعلانات والصور المرسلة من الإدارة</p>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      <section className="card full-width">
        {announcements.length === 0 ? (
          <p className="empty-state">لا توجد إعلانات حاليًا</p>
        ) : (
          <div className="announcements-list">
            {announcements.map(announcement => (
              <article key={announcement.id} className="announcement-item">
                <h2>{announcement.title}</h2>
                <p className="announcement-content">{announcement.content || 'إعلان من الإدارة'}</p>
                {announcement.image_url && (
                  <img
                    src={announcement.image_url}
                    alt={announcement.title}
                    style={{ width: '100%', maxHeight: '620px', objectFit: 'contain', marginTop: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff' }}
                  />
                )}
                <p className="announcement-date">{new Date(announcement.created_at).toLocaleString('ar-JO')}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
