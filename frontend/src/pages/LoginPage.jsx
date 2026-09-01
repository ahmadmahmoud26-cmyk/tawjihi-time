import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';
import '../styles/auth.css';

export default function LoginPage() {
  const [loginType, setLoginType] = useState(null); // 'admin' or 'student'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const adminLogin = useAuthStore(state => state.adminLogin);
  const studentLogin = useAuthStore(state => state.studentLogin);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = loginType === 'admin'
        ? await adminLogin(email, password)
        : await studentLogin(email, password);

      if (!success) {
        setError('خطأ في البريد الإلكتروني أو كلمة المرور. يرجى المحاولة مرة أخرى.');
        setLoading(false);
        return;
      }

      if (loginType === 'student') {
        const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
        navigate(storedUser?.grade_id == null ? '/complete-profile' : '/dashboard');
        return;
      }

      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message || 'فشل تسجيل الدخول');
      setLoading(false);
    }
  };

  // Role Selection Screen
  if (loginType === null) {
    return (
      <div className="login-container">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div className="login-header">
            <h1>🎓 توجيهي Time</h1>
            <p>منصة تعليمية شاملة للأردن</p>
          </div>

          <div style={{ marginTop: 40, marginBottom: 40 }}>
            <p style={{ fontSize: 18, marginBottom: 30, color: '#666' }}>
              اختر دورك لتسجيل الدخول:
            </p>

            <button
              type="button"
              onClick={() => setLoginType('admin')}
              style={{
                width: '100%',
                padding: '20px',
                marginBottom: 20,
                backgroundColor: '#2c3e50',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 18,
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'background-color 0.3s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#1a252f'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#2c3e50'}
            >
              👨‍💼 تسجيل دخول المشرف
            </button>

            <button
              type="button"
              onClick={() => setLoginType('student')}
              style={{
                width: '100%',
                padding: '20px',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 18,
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'background-color 0.3s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#2980b9'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#3498db'}
            >
              👨‍🎓 تسجيل دخول الطالب
            </button>
          </div>

          <div className="login-footer">
            <p>توجيهي Time © 2024 - منصة تعليمية آمنة وموثوقة</p>
          </div>
        </div>
      </div>
    );
  }

  // Login Form Screen
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>توجيهي Time</h1>
          <p>{loginType === 'admin' ? '🔐 بوابة المشرف' : '📚 بوابة الطالب'}</p>
        </div>

        <button
          type="button"
          onClick={() => setLoginType(null)}
          style={{
            marginBottom: 15,
            padding: '8px 12px',
            backgroundColor: '#ecf0f1',
            border: '1px solid #bdc3c7',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14,
            color: '#2c3e50'
          }}
        >
          ← العودة
        </button>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">البريد الإلكتروني</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={loginType === 'admin' ? 'البريد الإلكتروني للمشرف' : 'البريد الإلكتروني للطالب'}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">كلمة المرور</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="أدخل كلمة المرور"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>

        <div className="login-footer">
          <p>توجيهي Time © 2024 - منصة تعليمية لطلاب الأردن</p>
        </div>
      </div>
    </div>
  );
}
