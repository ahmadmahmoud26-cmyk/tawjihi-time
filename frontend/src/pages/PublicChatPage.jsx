import { useEffect, useState } from 'react';
import { useAuthStore } from '../utils/authStore';
import apiClient from '../utils/api';
import '../styles/dashboard.css';
import '../styles/public-chat.css';

export default function PublicChatPage() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState([]);
  const [students, setStudents] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [mutedStudentIds, setMutedStudentIds] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);

  const fetchMessages = async () => {
    try {
      const response = await apiClient.get('/messages/public');
      const receivedMessages = response.data.messages || [];
      setMessages(receivedMessages);
      const viewedMessageIds = receivedMessages
        .filter(message => message.sender_id !== user?.id)
        .map(message => message.id);
      if (viewedMessageIds.length > 0) {
        await apiClient.patch('/notifications/read-related', {
          relatedEntityTypes: ['general_chat', 'public_chat'],
          relatedIds: viewedMessageIds
        });
          window.dispatchEvent(new Event('notifications-read'));
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في تحميل الشات العام');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (search = studentSearch) => {
    try {
      setStudentSearchLoading(true);
      const query = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '';
      const response = await apiClient.get(`/admin/students/list?perPage=100${query}`);
      setStudents(response.data.students || []);
    } catch (err) {
      console.error('Error loading students list:', err);
    } finally {
      setStudentSearchLoading(false);
    }
  };

  const fetchMutes = async () => {
    try {
      const response = await apiClient.get('/messages/public/mutes');
      const activeMutes = response.data.mutes || [];
      setMutedStudentIds(activeMutes.filter(item => item.is_active).map(item => item.student_id));
    } catch (err) {
      console.error('Error loading active mutes:', err);
    }
  };

  useEffect(() => {
    fetchMessages();
    if (user && ['admin', 'super_admin'].includes(user.role)) {
      fetchStudents();
      fetchMutes();
    }
    const interval = setInterval(() => {
      fetchMessages();
      if (user && ['admin', 'super_admin'].includes(user.role)) {
        fetchMutes();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [user?.id, user?.role]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    try {
      setSending(true);
      await apiClient.post('/messages/public', { message: input.trim() });
      setInput('');
      await fetchMessages();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId) => {
    try {
      await apiClient.delete(`/messages/public/${messageId}`);
      await fetchMessages();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في حذف الرسالة');
    }
  };

  const handleMuteStudent = async (studentId, minutes = 60) => {
    try {
      await apiClient.post('/messages/public/mute', { studentId, minutes, reason: 'ميوت من قبل المشرف' });
      await fetchMutes();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في إعطاء الميوت');
    }
  };

  const handleUnmuteStudent = async (studentId) => {
    try {
      await apiClient.post('/messages/public/unmute', { studentId });
      await fetchMutes();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'فشل في إزالة الميوت');
    }
  };

  if (loading) return <div className="dashboard-loading">جاري تحميل الشات العام...</div>;

  const isAdmin = user && ['admin', 'super_admin'].includes(user.role);

  return (
    <div className="public-chat-page">
      <div className={`public-chat-shell ${isAdmin ? 'has-sidebar' : 'single-column'}`}>

        {isAdmin && (
          <aside className="public-chat-sidebar">
            <h2>إدارة الميوت</h2>
            <p>ابحث عن طالب واختر مدة كتمه من الشات العام.</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                fetchStudents();
              }}
              className="public-chat-search"
            >
              <input
                type="search"
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="ابحث باسم الطالب أو بريده الإلكتروني"
                aria-label="البحث عن طالب بالاسم أو البريد الإلكتروني"
              />
              <button type="submit" disabled={studentSearchLoading}>
                {studentSearchLoading ? 'جارٍ البحث...' : 'بحث'}
              </button>
              {studentSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setStudentSearch('');
                    fetchStudents('');
                  }}
                  className="public-chat-clear"
                >
                  مسح
                </button>
              )}
            </form>
            <div className="public-chat-students">
              {students.length === 0 ? (
                <p className="empty-state">{studentSearch ? 'لا يوجد طالب مطابق للبحث' : 'لا يوجد طلاب'}</p>
              ) : (
                students.map(student => {
                  const muted = mutedStudentIds.includes(student.id);
                  return (
                    <div key={student.id} className="public-chat-student">
                      <div className="public-chat-student-info">
                        <strong>{student.name}</strong>
                        <span>{student.email}</span>
                      </div>
                      <div>
                        {!muted ? (
                          <button className="public-chat-mute-button" type="button" onClick={() => handleMuteStudent(student.id, 60)}>كتم 60 د</button>
                        ) : (
                          <button className="public-chat-mute-button is-muted" type="button" onClick={() => handleUnmuteStudent(student.id)}>إلغاء الكتم</button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}

        <main className="public-chat-main">
          <header className="public-chat-topbar">
            <div className="public-chat-brand">👥</div>
            <div>
              <h1>الشات العام</h1>
              <p>مساحة نقاش لجميع الطلاب والإدارة</p>
            </div>
          </header>

          {error && <div className="public-chat-error">{error}</div>}

          <div className="public-chat-messages">
          {messages.length > 0 ? (
            messages.map((message) => {
              const isOwn = message.sender_id === user?.id;
              const canDelete = isOwn || isAdmin;

              return (
                <div key={message.id} className={`public-message ${isOwn ? 'is-own' : ''}`}>
                  <div className="public-message-avatar">{(message.sender_name || 'م').charAt(0)}</div>
                  <div className="public-message-bubble">
                    <div className="public-message-meta">
                      <strong>{message.sender_name || 'مستخدم'}</strong>
                      <span>{message.sender_role === 'student' ? 'طالب' : 'مشرف'}</span>
                    </div>
                    <p className="public-message-text">{message.message}</p>
                    <div className="public-message-footer">
                      <span>{new Date(message.created_at).toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' })}</span>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(message.id)}
                        className="public-message-delete"
                      >
                        حذف
                      </button>
                    )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="public-chat-empty">لا توجد رسائل بعد. ابدأ المحادثة الآن.</div>
          )}
          </div>

        <form onSubmit={handleSend} className="public-chat-composer">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اكتب رسالة..."
          />
          <button className="public-chat-send" type="submit" disabled={sending} aria-label="إرسال الرسالة">
            {sending ? '…' : '➤'}
          </button>
        </form>
        </main>
      </div>
    </div>
  );
}
