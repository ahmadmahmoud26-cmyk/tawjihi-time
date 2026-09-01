import { useEffect, useState } from 'react';
import apiClient from '../utils/api';
import '../styles/dashboard.css';

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [title, setTitle] = useState('');
  const [imageData, setImageData] = useState('');
  const [imageName, setImageName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/announcements?perPage=100');
      setAnnouncements(response.data.announcements || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في تحميل الإعلانات');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageData(reader.result);
      setImageName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (trimmedTitle && trimmedTitle.length < 5) {
      setError('عنوان الإعلان يجب أن يكون 5 أحرف على الأقل');
      return;
    }

    if (!imageData) {
      setError('يرجى إرفاق صورة الإعلان');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await apiClient.post('/announcements', {
        title: trimmedTitle || 'إعلان جديد',
        content: 'تم نشر إعلان جديد لجميع الطلاب.',
        imageData
      });
      setTitle('');
      setImageData('');
      setImageName('');
      await fetchAnnouncements();
      alert('✅ تم نشر الإعلان لجميع الطلاب');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في نشر الإعلان');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (announcementId) => {
    if (!window.confirm('هل تريد حذف هذا الإعلان؟')) return;

    try {
      setDeletingId(announcementId);
      setError('');
      await apiClient.delete(`/announcements/${announcementId}`);
      setAnnouncements(current => current.filter(item => item.id !== announcementId));
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في حذف الإعلان');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>إضافة إعلان</h1>
          <p>انشر صورة مباشرة لجميع الطلاب وتحكم بالإعلانات المنشورة.</p>
        </div>
      </header>

      {error && <div className="error-message" style={{ marginBottom: '20px' }}>{error}</div>}

      <div className="dashboard-grid">
        <section className="card">
          <h2>إعلان جديد</h2>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="عنوان الإعلان (اختياري)"
              minLength={5}
            />
            <input type="file" accept="image/*" onChange={handleImageChange} required />
            {imageData && (
              <div>
                <p style={{ margin: '0 0 8px', color: '#64748b' }}>{imageName}</p>
                <img src={imageData} alt="معاينة الإعلان" style={{ width: '100%', maxHeight: '360px', objectFit: 'contain', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
              </div>
            )}
            <button className="btn-action" type="submit" disabled={submitting || !imageData}>
              {submitting ? 'جارٍ النشر...' : 'نشر الإعلان لجميع الطلاب'}
            </button>
          </form>
        </section>

        <section className="card">
          <h2>الإعلانات المنشورة</h2>
          {loading ? (
            <p className="empty-state">جاري تحميل الإعلانات...</p>
          ) : announcements.length === 0 ? (
            <p className="empty-state">لا توجد إعلانات منشورة</p>
          ) : (
            <div className="announcements-list">
              {announcements.map(announcement => (
                <article key={announcement.id} className="announcement-item" style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'start' }}>
                    <div>
                      <h4>{announcement.title}</h4>
                      <p className="announcement-date">{new Date(announcement.created_at).toLocaleString('ar-JO')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(announcement.id)}
                      disabled={deletingId === announcement.id}
                      style={{ padding: '7px 10px', border: 0, borderRadius: '8px', background: '#fee2e2', color: '#b91c1c', cursor: 'pointer', fontWeight: 700 }}
                    >
                      {deletingId === announcement.id ? 'جارٍ الحذف...' : 'حذف'}
                    </button>
                  </div>
                  {announcement.image_url && (
                    <img src={announcement.image_url} alt={announcement.title} style={{ width: '100%', maxHeight: '260px', objectFit: 'contain', marginTop: '10px', borderRadius: '8px' }} />
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
