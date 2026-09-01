import { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/dashboard.css';

export default function AdminNotesPage() {
  const [groups, setGroups] = useState([]);
  const [replyMap, setReplyMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchNotes = async () => {
    try {
      const response = await axios.get('/api/notes/admin/unread');
      setGroups(response.data.notes || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في تحميل الملاحظات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleReply = async (noteId) => {
    const reply = replyMap[noteId]?.trim();
    if (!reply) return;
    try {
      await axios.post(`/api/notes/admin/${noteId}/reply`, { reply });
      setReplyMap((prev) => ({ ...prev, [noteId]: '' }));
      await fetchNotes();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في إرسال الرد');
    }
  };

  if (loading) return <div className="dashboard-loading">جاري تحميل ملاحظات الطلاب...</div>;

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>ملاحظات الطلاب</h1>
          <p>مراجعة الملاحظات غير المقروءة والرد عليها</p>
        </div>
      </header>

      <div className="dashboard-grid">
        {error && <div className="error-message">{error}</div>}
        {groups.length ? groups.map((group) => (
          <div key={group.subject_id} className="card" style={{ width: '100%' }}>
            <h2>{group.subject_name} <span className="badge badge-danger">{group.unread_count}</span></h2>
            {group.notes && group.notes.map((note) => (
              <div key={note.id} className="activity-item" style={{ marginBottom: 12 }}>
                <p><strong>{note.studentName}</strong></p>
                <p>{note.preview}</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <textarea
                    rows={3}
                    placeholder="اكتب ردك هنا"
                    value={replyMap[note.id] || ''}
                    onChange={(e) => setReplyMap({ ...replyMap, [note.id]: e.target.value })}
                  />
                </div>
                <button className="btn-primary" style={{ marginTop: 10 }} onClick={() => handleReply(note.id)}>إرسال الرد</button>
              </div>
            ))}
          </div>
        )) : <div className="card"><p className="empty-state">لا توجد ملاحظات غير مقروءة</p></div>}
      </div>
    </div>
  );
}
