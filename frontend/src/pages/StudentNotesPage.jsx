import { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/dashboard.css';

export default function StudentNotesPage() {
  const [subjects, setSubjects] = useState([]);
  const [notes, setNotes] = useState([]);
  const [note, setNote] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const [subjectsRes, notesRes] = await Promise.all([
        axios.get('/api/subjects?perPage=100'),
        axios.get('/api/notes/student/my-notes?perPage=20')
      ]);

      const subjectList = subjectsRes.data.data || subjectsRes.data.subjects || [];
      setSubjects(subjectList);
      setNotes(notesRes.data.notes || []);
      if (subjectList[0]) setSubjectId(String(subjectList[0].id));
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في تحميل الملاحظات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    try {
      await axios.post('/api/notes', {
        note,
        subjectId: subjectId ? Number(subjectId) : null
      });
      setNote('');
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في حفظ المذكرة');
    }
  };

  if (loading) return <div className="dashboard-loading">جاري تحميل الملاحظات...</div>;

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>ملاحظات التقدم</h1>
          <p>اكتب ما وصلت إليه في كل مادة وتابع الرد من المشرف</p>
        </div>
      </header>

      <div className="dashboard-grid">
        <section className="card">
          <h2>كتابة ملاحظة</h2>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
            <textarea rows={6} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: وصلت إلى الوحدة الثانية في الرياضيات، وأحتاج إلى مراجعة الدرس الثاني." />
            <button className="btn-primary" type="submit">حفظ الملاحظة</button>
          </form>
        </section>

        <section className="card">
          <h2>ملاحظاتي السابقة</h2>
          {error && <div className="error-message">{error}</div>}
          {notes.length ? notes.map((item) => (
            <div key={item.id} className="activity-item" style={{ marginBottom: 12 }}>
              <p><strong>{item.subject_name || 'مادة'}</strong></p>
              <p>{item.note}</p>
              {item.admin_reply && (
                <div style={{ marginTop: 10, background: '#eef6ff', padding: 10, borderRadius: 8 }}>
                  <strong>رد المشرف:</strong>
                  <p>{item.admin_reply}</p>
                </div>
              )}
            </div>
          )) : <p className="empty-state">لا توجد ملاحظات حتى الآن</p>}
        </section>
      </div>
    </div>
  );
}
