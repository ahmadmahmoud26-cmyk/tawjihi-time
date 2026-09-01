import { useEffect, useState } from 'react';
import apiClient from '../utils/api';
import '../styles/dashboard.css';

export default function AdminManagementPage() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', accountStatus: 'active', permissions: ['manage_students'] });
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);

  const fetchAdmins = async () => {
    try {
      const response = await apiClient.get('/admin/users/list?perPage=100');
      setAdmins(response.data.admins || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      await apiClient.post('/admin/create-admin', form);
      setForm({ name: '', email: '', password: '', accountStatus: 'active', permissions: ['manage_students'] });
      await fetchAdmins();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to create admin');
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (admin) => {
    const nextStatus = admin.account_status === 'active' ? 'inactive' : 'active';
    const label = nextStatus === 'inactive' ? 'تعطيل' : 'إعادة تفعيل';
    if (!window.confirm(`هل أنت متأكد من ${label} حساب ${admin.name}؟`)) return;
    try {
      setActionId(admin.id);
      setError('');
      await apiClient.patch(`/admin/users/${admin.id}/status`, { status: nextStatus });
      await fetchAdmins();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل تحديث حالة الأدمن');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (admin) => {
    if (!window.confirm(`هل أنت متأكد أنك تريد إزالة الأدمن ${admin.name} نهائيًا؟`)) return;
    try {
      setActionId(admin.id);
      setError('');
      await apiClient.delete(`/admin/users/${admin.id}`);
      setAdmins(current => current.filter(item => item.id !== admin.id));
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل إزالة الأدمن');
    } finally {
      setActionId(null);
    }
  };

  const togglePermission = (permission) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((item) => item !== permission)
        : [...prev.permissions, permission]
    }));
  };

  if (loading) return <div className="dashboard-loading">جاري تحميل إدارة الأدمن...</div>;

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>إضافة أدمن</h1>
          <p>إدارة حسابات الأدمن من حساب السوبر أدمن الرئيسي</p>
        </div>
      </header>

      <div className="dashboard-grid">
        <section className="card">
          <h2>إضافة أدمن جديد</h2>
          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleCreateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم الأدمن" style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e0' }} required />
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="البريد الإلكتروني" style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e0' }} required />
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="كلمة المرور (8 أحرف على الأقل)" minLength="8" style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e0' }} required />
            <select value={form.accountStatus} onChange={(e) => setForm({ ...form, accountStatus: e.target.value })}>
              <option value="active">نشط</option>
              <option value="inactive">معطل</option>
            </select>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {['manage_students', 'view_results', 'manage_notes', 'view_audit_logs'].map((permission) => (
                <button
                  key={permission}
                  type="button"
                  className={form.permissions.includes(permission) ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => togglePermission(permission)}
                  style={{ padding: '8px 12px' }}
                >
                  {permission}
                </button>
              ))}
            </div>

            <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'جارٍ الإنشاء...' : 'إنشاء حساب الأدمن'}</button>
          </form>
        </section>

        <section className="card">
          <h2>حسابات الأدمن الحالية</h2>
          <div className="activities-list">
            {admins.length > 0 ? (
              admins.map((admin) => (
                <div key={admin.id} className="activity-item">
                  <p><strong>{admin.name}</strong> · {admin.email}</p>
                  <p>{admin.role === 'super_admin' ? 'Super Admin' : 'Admin'} · {admin.account_status === 'active' ? 'نشط' : 'معطل'}</p>
                  <span className="activity-time">الصلاحيات: {admin.permission_count || 0}</span>
                  {admin.role === 'admin' && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button type="button" className="btn-secondary" disabled={actionId === admin.id} onClick={() => handleStatus(admin)}>
                        {admin.account_status === 'active' ? 'تعطيل' : 'تفعيل'}
                      </button>
                      <button type="button" className="btn-danger" disabled={actionId === admin.id} onClick={() => handleDelete(admin)}>
                        {actionId === admin.id ? 'جارٍ التنفيذ...' : 'إزالة'}
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="empty-state">لا توجد حسابات أدمن</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
