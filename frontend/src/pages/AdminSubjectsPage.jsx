import { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/dashboard.css';

export default function AdminSubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subjectForm, setSubjectForm] = useState({ name: '', description: '', gradeId: 1 });
  const [unitForm, setUnitForm] = useState({});
  const [lessonForm, setLessonForm] = useState({});

  const fetchSubjects = async () => {
    try {
      const response = await axios.get('/api/subjects?perPage=100');
      const items = response.data.data || response.data.subjects || [];

      const enriched = await Promise.all(items.map(async (subject) => {
        const unitsRes = await axios.get(`/api/subjects/${subject.id}/units`);
        const units = unitsRes.data.units || [];

        const lessonMap = {};
        for (const unit of units) {
          const lessonsRes = await axios.get(`/api/subjects/${subject.id}/units/${unit.id}/lessons`);
          lessonMap[`${subject.id}-${unit.id}`] = lessonsRes.data.lessons || [];
        }

        return {
          ...subject,
          units,
          lessonMap,
        };
      }));

      setSubjects(enriched);
      setUnitForm((prev) => ({ ...prev, ...Object.fromEntries(enriched.map((s) => [s.id, ''])) }));
      setLessonForm((prev) => ({
        ...prev,
        ...Object.fromEntries(
          enriched.flatMap((s) => ((s.units || []).map((u) => [`${s.id}-${u.id}`, ''])))
        )
      }));
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في تحميل المواد');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/subjects', subjectForm);
      setSubjectForm({ name: '', description: '', gradeId: 1 });
      await fetchSubjects();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في إنشاء المادة');
    }
  };

  const handleCreateUnit = async (subjectId) => {
    const name = unitForm[subjectId];
    if (!name?.trim()) return;
    try {
      await axios.post(`/api/subjects/${subjectId}/units`, { name, description: 'وحدة جديدة' });
      setUnitForm((prev) => ({ ...prev, [subjectId]: '' }));
      await fetchSubjects();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في إنشاء الوحدة');
    }
  };

  const handleCreateLesson = async (subjectId, unitId) => {
    const name = lessonForm[`${subjectId}-${unitId}`];
    if (!name?.trim()) return;
    try {
      await axios.post(`/api/subjects/${subjectId}/units/${unitId}/lessons`, { name, description: 'درس جديد' });
      setLessonForm((prev) => ({ ...prev, [`${subjectId}-${unitId}`]: '' }));
      await fetchSubjects();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في إنشاء الدرس');
    }
  };

  if (loading) return <div className="dashboard-loading">جاري تحميل إدارة المواد...</div>;

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>إدارة المواد</h1>
          <p>إضافة المواد والوحدات والدروس بشكل ديناميكي</p>
        </div>
      </header>

      <div className="card">
        <h2>إضافة مادة جديدة</h2>
        <form onSubmit={handleCreateSubject} style={{ display: 'grid', gap: 12 }}>
          <input
            placeholder="اسم المادة"
            value={subjectForm.name}
            onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
          />
          <textarea
            placeholder="وصف المادة"
            rows={3}
            value={subjectForm.description}
            onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })}
          />
          <input
            type="number"
            min="1"
            placeholder="معرّف المرحلة"
            value={subjectForm.gradeId}
            onChange={(e) => setSubjectForm({ ...subjectForm, gradeId: Number(e.target.value) })}
          />
          <button className="btn-primary" type="submit">إضافة المادة</button>
        </form>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="dashboard-grid">
        {subjects.map((subject) => (
          <div key={subject.id} className="card" style={{ width: '100%' }}>
            <h2>{subject.name}</h2>
            <p>{subject.description || 'لا يوجد وصف'}</p>

            <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  placeholder="اسم الوحدة"
                  value={unitForm[subject.id] || ''}
                  onChange={(e) => setUnitForm({ ...unitForm, [subject.id]: e.target.value })}
                />
                <button className="btn-primary" onClick={() => handleCreateUnit(subject.id)}>إضافة وحدة</button>
              </div>

              {(subject.units || []).length > 0 ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {subject.units.map((unit) => (
                    <div key={unit.id} className="card" style={{ background: '#f8fafc', padding: 14 }}>
                      <strong>{unit.name}</strong>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <input
                          placeholder="اسم الدرس"
                          value={lessonForm[`${subject.id}-${unit.id}`] || ''}
                          onChange={(e) => setLessonForm({ ...lessonForm, [`${subject.id}-${unit.id}`]: e.target.value })}
                        />
                        <button className="btn-secondary" onClick={() => handleCreateLesson(subject.id, unit.id)}>إضافة درس</button>
                      </div>

                      {(subject.lessonMap?.[`${subject.id}-${unit.id}`] || []).length > 0 && (
                        <ul style={{ marginTop: 10, paddingRight: 18 }}>
                          {(subject.lessonMap?.[`${subject.id}-${unit.id}`] || []).map((lesson) => (
                            <li key={lesson.id}>{lesson.name}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">لا توجد وحدات بعد</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
