import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';
import apiClient from '../utils/api';
import '../styles/dashboard.css';

export default function AdminDashboard() {
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementImage, setAnnouncementImage] = useState('');
  const [announcementImageName, setAnnouncementImageName] = useState('');
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const isPrimarySuperAdmin = user?.role === 'super_admin' && user?.email?.toLowerCase() === 'ahmad169qyp12q@gmail.com';

  useEffect(() => {
    fetchAdminStats();
  }, []);

  const fetchAdminStats = async () => {
    try {
      const response = await apiClient.get('/admin/dashboard');
      const data = response.data;

      setStats({
        totalStudents: data.stats?.totalStudents || 0,
        activeStudents: data.stats?.activeStudents || 0,
        newStudents: data.stats?.newStudents || 0,
        totalSubjects: data.stats?.totalSubjects || 0,
        totalUnits: data.stats?.totalUnits || 0,
        totalLessons: data.stats?.totalLessons || 0,
        totalExams: data.stats?.totalExams || 0,
        totalExamAttempts: data.stats?.totalExamAttempts || 0,
        unreadNotes: data.stats?.unreadNotes || 0,
        unreadMessages: data.stats?.unreadMessages || 0,
        recentRegistrations: data.stats?.recentRegistrations || 0,
        recentActivities: (data.recentActivity || []).map(log => ({
          description: `${log.actor_name || 'System'} • ${log.action}`,
          time: new Date(log.created_at).toLocaleString()
        }))
      });
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleAnnouncementImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setAnnouncementImage(reader.result);
      setAnnouncementImageName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateAnnouncement = async (event) => {
    event.preventDefault();
    setError('');

    if (!announcementImage) {
      setError('يرجى إرفاق صورة الإعلان');
      return;
    }

    try {
      setAnnouncementLoading(true);
      await apiClient.post('/announcements', {
        title: announcementTitle.trim() || 'إعلان جديد',
        content: 'تم نشر إعلان جديد لجميع الطلاب.',
        imageData: announcementImage
      });
      setAnnouncementTitle('');
      setAnnouncementImage('');
      setAnnouncementImageName('');
      setShowAnnouncementForm(false);
      alert('✅ تم نشر الإعلان لجميع الطلاب');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في نشر الإعلان');
    } finally {
      setAnnouncementLoading(false);
    }
  };

  if (loading) return <div className="dashboard-loading">جاري تحميل لوحة الإدارة...</div>;

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>لوحة الإدارة</h1>
          <p>مرحباً بعودتك، {user?.name}</p>
        </div>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-value">{stats?.totalStudents || 0}</span>
            <span className="stat-label">إجمالي الطلاب</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats?.activeStudents || 0}</span>
            <span className="stat-label">الطلاب النشطون</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats?.totalExams || 0}</span>
            <span className="stat-label">الاختبارات</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats?.unreadNotes || 0}</span>
            <span className="stat-label">ملاحظات غير مقروءة</span>
          </div>
        </div>
      </header>

      <div className="admin-tabs">
        <button 
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          نظرة عامة
        </button>
        <button 
          className={`tab ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          الطلاب
        </button>
        <button 
          className={`tab ${activeTab === 'exams' ? 'active' : ''}`}
          onClick={() => setActiveTab('exams')}
        >
          الاختبارات
        </button>
        <button 
          className={`tab ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
        >
          النتائج
        </button>
      </div>

      <div className="dashboard-grid">
        {activeTab === 'overview' && (
          <>
            <section className="card">
              <h2>إجراءات سريعة</h2>
              <div className="action-buttons">
                <button className="btn-action" onClick={() => navigate('/admin/exams')}>إدارة الاختبارات</button>
                <button className="btn-action" onClick={() => navigate('/admin/students')}>جداول الطلاب</button>
                {isPrimarySuperAdmin && <button className="btn-action" onClick={() => navigate('/admin/management')}>👤 إضافة أدمن</button>}
                <button className="btn-action" onClick={() => setShowAnnouncementForm(!showAnnouncementForm)}>إضافة إعلان</button>
                <button className="btn-action" onClick={() => navigate('/admin/results')}>عرض النتائج</button>
                <button className="btn-action" onClick={() => navigate('/admin/audit')}>سجل النشاط</button>
              </div>
            </section>

            {showAnnouncementForm && (
              <section className="card full-width">
                <h2>إضافة إعلان</h2>
                {error && <div className="error-message">{error}</div>}
                <form onSubmit={handleCreateAnnouncement} style={{ display: 'grid', gap: '14px' }}>
                  <input
                    type="text"
                    value={announcementTitle}
                    onChange={(event) => setAnnouncementTitle(event.target.value)}
                    placeholder="عنوان الإعلان (اختياري)"
                    style={{ padding: '12px', border: '1px solid #cbd5e0', borderRadius: '8px' }}
                  />
                  <input type="file" accept="image/*" onChange={handleAnnouncementImage} required />
                  {announcementImage && (
                    <div>
                      <p style={{ margin: '0 0 8px', color: '#4a5568' }}>{announcementImageName}</p>
                      <img
                        src={announcementImage}
                        alt="معاينة الإعلان"
                        style={{ width: '100%', maxHeight: '360px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      />
                    </div>
                  )}
                  <button className="btn-action" type="submit" disabled={announcementLoading || !announcementImage}>
                    {announcementLoading ? 'جارٍ النشر...' : 'نشر الإعلان لجميع الطلاب'}
                  </button>
                </form>
              </section>
            )}

            <section className="card chat-widget-card">
              <h2>الرسائل</h2>
              <div className="chat-widget-box">
                <div className="chat-widget-icon">💬</div>
                <p>إدارة محادثات الطلاب مباشرة من داخل اللوحة</p>
                <button className="btn-action" onClick={() => navigate('/admin/messages')}>
                  فتح الشات
                </button>
              </div>
            </section>

            <section className="card">
              <h2>النشاط الأخير</h2>
              {stats?.recentActivities?.length > 0 ? (
                <div className="activities-list">
                  {stats.recentActivities.map((activity, idx) => (
                    <div key={idx} className="activity-item">
                      <p>{activity.description}</p>
                      <span className="activity-time">{activity.time}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">لا توجد أنشطة حديثة</p>
              )}
            </section>
          </>
        )}

        {activeTab === 'students' && (
          <section className="card full-width">
            <h2>إدارة الطلاب</h2>
            <div className="action-buttons">
              <button className="btn-action" onClick={() => navigate('/admin/students')}>فتح مدير الطلاب</button>
            </div>
          </section>
        )}

        {activeTab === 'exams' && (
          <section className="card full-width">
            <h2>إدارة الاختبارات</h2>
            <div className="action-buttons">
              <button className="btn-action" onClick={() => navigate('/admin/exams')}>فتح مدير الاختبارات</button>
            </div>
          </section>
        )}

        {activeTab === 'results' && (
          <section className="card full-width">
            <h2>عرض النتائج</h2>
            <div className="action-buttons">
              <button className="btn-action" onClick={() => navigate('/admin/results')}>فتح ملخص النتائج</button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
