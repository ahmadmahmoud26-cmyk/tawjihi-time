import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';
import apiClient from '../utils/api';
import '../styles/auth.css';

export default function CompleteProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const completeProfile = useAuthStore((state) => state.completeProfile);
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchGrades();
  }, []);

  const fetchGrades = async () => {
    try {
      const response = await apiClient.get('/subjects/grades/all');
      const gradeList = response.data.grades || [];
      setGrades(gradeList);
      if (gradeList[0]) {
        setSelectedGrade(String(gradeList[0].id));
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'تعذّر تحميل المراحل');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedGrade) return;
    loadSubjectsForGrade(selectedGrade);
  }, [selectedGrade]);

  const loadSubjectsForGrade = async (gradeId) => {
    try {
      const response = await apiClient.get('/subjects', { params: { grade: gradeId, perPage: 100 } });
      const list = response.data.data || response.data.subjects || [];
      setSubjects(list);
      setSelectedSubjects([]);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'تعذّر تحميل المواد');
    }
  };

  const toggleSubject = (subjectId) => {
    setSelectedSubjects((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedGrade) {
      setError('اختر المرحلة أولاً');
      return;
    }

    setSaving(true);
    setError('');

    const success = await completeProfile(Number(selectedGrade), selectedSubjects.map(Number));

    setSaving(false);
    if (success) {
      navigate('/dashboard');
    } else {
      setError('تعذّر حفظ ملفك الشخصي، حاول مرة أخرى');
    }
  };

  if (loading) {
    return <div className="dashboard-loading">جاري تجهيز حسابك...</div>;
  }

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: 760 }}>
        <div className="login-header">
          <h1>إكمال الملف الشخصي</h1>
          <p>مرحباً {user?.name || 'طالب'}، اختر المرحلة والمواد الخاصة بك</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="grade">المرحلة الدراسية</label>
            <select
              id="grade"
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              required
            >
              <option value="">اختر المرحلة</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>{grade.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>اختيار المواد</label>
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              {subjects.length > 0 ? (
                subjects.map((subject) => (
                  <label key={subject.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#f8fafc', borderRadius: 8 }}>
                    <input
                      type="checkbox"
                      checked={selectedSubjects.includes(subject.id)}
                      onChange={() => toggleSubject(subject.id)}
                    />
                    <span>{subject.name}</span>
                  </label>
                ))
              ) : (
                <p className="empty-state">لا توجد مواد متاحة لهذه المرحلة حالياً</p>
              )}
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'جاري الحفظ...' : 'حفظ الملف الشخصي'}
          </button>
        </form>
      </div>
    </div>
  );
}
