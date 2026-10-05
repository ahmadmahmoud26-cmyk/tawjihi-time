import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    fetch('/api/auth/session', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.user || null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  return { user, loading, setUser, refresh };
}

function App() {
  const { user, loading, setUser, refresh } = useAuth();

  if (loading) {
    return <div className="container"><div className="card login-box">جارٍ تحميل النظام...</div></div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={user ? (user.role === 'student' ? <StudentHome user={user} setUser={setUser} refresh={refresh} /> : <Navigate to="/admin/dashboard" replace />) : <LoginPage />} />
        <Route path="/admin/login" element={user && ['admin', 'super_admin'].includes(user.role) ? <Navigate to="/admin/dashboard" replace /> : <AdminLogin setUser={setUser} />} />
        <Route path="/admin/dashboard" element={user && ['admin', 'super_admin'].includes(user.role) ? <AdminDashboard user={user} setUser={setUser} refresh={refresh} /> : <Navigate to="/admin/login" replace />} />
        <Route path="/student/dashboard" element={user && user.role === 'student' ? <StudentHome user={user} setUser={setUser} refresh={refresh} /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function LoginPage() {
  const [state, setState] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    fetch('/api/auth/google/status')
      .then((res) => (res.ok ? res.json() : { enabled: false }))
      .then((data) => setGoogleEnabled(Boolean(data.enabled)))
      .catch(() => setGoogleEnabled(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(state),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.message || 'فشل تسجيل الدخول');
      setLoading(false);
      return;
    }

    window.location.href = '/student/dashboard';
  }

  return (
    <div className="app-shell">
      <div className="container">
        <div className="card login-box">
          <h1 className="title">Tawjihi Time</h1>
          <p className="muted">تسجيل دخول الطالب</p>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>البريد الإلكتروني</label>
              <input value={state.email} onChange={(e) => setState({ ...state, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label>كلمة المرور</label>
              <input type="password" value={state.password} onChange={(e) => setState({ ...state, password: e.target.value })} />
            </div>
            {error && <p style={{ color: 'crimson' }}>{error}</p>}
            <button type="submit" disabled={loading}>{loading ? 'جارٍ...' : 'تسجيل الدخول'}</button>
          </form>
          {googleEnabled && <div style={{ marginTop: 18 }}>
            <a href="/api/auth/google"><button className="secondary" type="button">تسجيل الدخول عبر Google</button></a>
          </div>}
          <div style={{ marginTop: 18 }}>
            <a href="/admin/login">لوحة الإدارة</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminLogin({ setUser }) {
  const [state, setState] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(state),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || 'فشل تسجيل الدخول');
      setLoading(false);
      return;
    }
    setUser(data.user);
    window.location.href = '/admin/dashboard';
  }

  return (
    <div className="app-shell">
      <div className="container">
        <div className="card login-box">
          <h1 className="title">تسجيل دخول الإدارة</h1>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>البريد الإلكتروني</label>
              <input value={state.email} onChange={(e) => setState({ ...state, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label>كلمة المرور</label>
              <input type="password" value={state.password} onChange={(e) => setState({ ...state, password: e.target.value })} />
            </div>
            {error && <p style={{ color: 'crimson' }}>{error}</p>}
            <button type="submit" disabled={loading}>{loading ? 'جارٍ...' : 'تسجيل الدخول'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function StudentHome({ user, setUser, refresh }) {
  const [activePanel, setActivePanel] = useState('home');
  const [curriculum, setCurriculum] = useState([]);
  const [publicChatMessages, setPublicChatMessages] = useState([]);
  const [chatMuteStatus, setChatMuteStatus] = useState({ isMuted: false });
  const [newChatMessage, setNewChatMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [progress, setProgress] = useState({ predictedAverage: 0, streak: 0 });
  const [weeklySchedules, setWeeklySchedules] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState({ subjectId: '', note: '' });
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    // Load curriculum
    fetch('/api/student/curriculum', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCurriculum(data))
      .catch(() => setCurriculum([]));

    // Load public chat
    fetch('/api/public-chat/messages', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPublicChatMessages(data))
      .catch(() => setPublicChatMessages([]));

    // Load mute status
    fetch('/api/student/chat-mute-status', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { isMuted: false }))
      .then((data) => setChatMuteStatus(data))
      .catch(() => setChatMuteStatus({ isMuted: false }));

    fetch('/api/student/progress', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { predictedAverage: 0, streak: 0 }))
      .then((data) => setProgress(data));

    fetch('/api/student/weekly-schedules', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setWeeklySchedules(data))
      .catch(() => setWeeklySchedules([]));

    fetch('/api/notifications', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setNotifications(data))
      .catch(() => setNotifications([]));

    fetch('/api/announcements', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAnnouncements(data))
      .catch(() => setAnnouncements([]));

    fetch('/api/student/notes', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setNotes(data))
      .catch(() => setNotes([]));

    fetch('/api/messages', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setMessages(data))
      .catch(() => setMessages([]));
  }, []);

  async function markAllNotificationsRead() {
    await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' });
    setNotifications((current) => current.map((notification) => ({ ...notification, isRead: 1 })));
  }

  async function sendChatMessage(e) {
    e.preventDefault();
    if (!newChatMessage.trim()) return;
    if (chatMuteStatus.isMuted) {
      alert('تم كتم صوتك. لا يمكنك المشاركة في الشات العام حالياً.');
      return;
    }

    const res = await fetch('/api/public-chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message: newChatMessage }),
    });

    if (res.ok) {
      setNewChatMessage('');
      const updated = await fetch('/api/public-chat/messages', { credentials: 'include' });
      setPublicChatMessages(await updated.json());
    }
  }

  async function sendNote(e) {
    e.preventDefault();
    if (!newNote.note.trim()) return;

    const res = await fetch('/api/student/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(newNote),
    });

    if (res.ok) {
      setNewNote({ subjectId: '', note: '' });
      const updated = await fetch('/api/student/notes', { credentials: 'include' });
      setNotes(await updated.json());
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!messageText.trim()) return;
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message: messageText }),
    });
    if (res.ok) {
      setMessageText('');
      const updated = await fetch('/api/messages', { credentials: 'include' });
      setMessages(await updated.json());
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    window.location.href = '/';
  }

  return (
    <div className="app-shell">
      <div className="container">
        <div className="toolbar">
          <div>
            <h1 className="title">مرحبًا {user.name}</h1>
            <p className="muted">لوحة الطالب</p>
          </div>
          <div className="row">
            <button className="secondary" onClick={() => refresh()}>تحديث</button>
            <button className="danger" onClick={logout}>تسجيل الخروج</button>
          </div>
        </div>

        <div className="student-tiles">
          <button type="button" className={`student-tile ${activePanel === 'subjects' ? 'active' : ''}`} onClick={() => setActivePanel('subjects')}>
            <span className="tile-icon">📚</span><strong>المواد والدروس</strong><span className="muted">{curriculum.length} مواد</span>
          </button>
          <button type="button" className={`student-tile ${activePanel === 'tests' ? 'active' : ''}`} onClick={() => setActivePanel('tests')}>
            <span className="tile-icon">📝</span><strong>الاختبارات</strong><span className="muted">اختبارات متاحة</span>
          </button>
          <button type="button" className={`student-tile ${activePanel === 'files' ? 'active' : ''}`} onClick={() => setActivePanel('files')}>
            <span className="tile-icon">📁</span><strong>الملفات</strong><span className="muted">ملفات تعليمية</span>
          </button>
          <button type="button" className={`student-tile ${activePanel === 'chat' ? 'active' : ''}`} onClick={() => setActivePanel('chat')}>
            <span className="tile-icon">💬</span><strong>الشات العام</strong><span className="muted">محادثة مع الطلاب</span>
          </button>
          <button type="button" className={`student-tile ${activePanel === 'notes' ? 'active' : ''}`} onClick={() => setActivePanel('notes')}>
            <span className="tile-icon">📓</span><strong>ملاحظاتي</strong><span className="muted">تواصل مع الإدارة</span>
          </button>
          <button type="button" className={`student-tile ${activePanel === 'messages' ? 'active' : ''}`} onClick={() => setActivePanel('messages')}>
            <span className="tile-icon">✉️</span><strong>الرسائل</strong><span className="muted">محادثة مع الإدارة</span>
          </button>
          <button type="button" className={`student-tile ${activePanel === 'announcements' ? 'active' : ''}`} onClick={() => setActivePanel('announcements')}>
            <span className="tile-icon">📣</span><strong>الإعلانات</strong><span className="muted">{announcements.filter(a => !a.read).length} جديدة</span>
          </button>
          <button type="button" className={`student-tile ${activePanel === 'home' ? 'active' : ''}`} onClick={() => setActivePanel('home')}>
            <span className="tile-icon">🏠</span><strong>الرئيسية</strong><span className="muted">نظرة عامة</span>
          </button>
        </div>

        {activePanel === 'home' && (
          <>
            <div className="grid">
              <div className="card stat-card"><h3>المرحلة</h3><strong>{user.gradeName || 'غير محدد'}</strong></div>
              <div className="card stat-card"><h3>الإشعارات</h3><strong>{notifications.filter((notification) => !notification.isRead).length}</strong></div>
              <div className="card stat-card"><h3>المعدل المتوقع</h3><strong>{Number(progress.predictedAverage || 0).toFixed(1)}%</strong></div>
              <div className="card stat-card"><h3>الستريك</h3><strong>🔥 {progress.streak || 0}</strong></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>
              <div className="card" style={{ padding: 20 }}>
                <div className="toolbar">
                  <h3>الإشعارات</h3>
                  <button type="button" className="secondary" onClick={markAllNotificationsRead}>تعليم الكل كمقروء</button>
                </div>
                {notifications.length === 0 ? <div className="empty-state">لا توجد إشعارات.</div> : (
                  notifications.slice(0, 8).map((notification) => (
                    <div key={notification.id} style={{ padding: '10px 0', borderBottom: '1px solid #eee' }}>
                      <strong>{notification.title}</strong>
                      <p>{notification.message}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="card" style={{ padding: 20 }}>
                <h3>الإعلانات</h3>
                {announcements.length === 0 ? <div className="empty-state">لا توجد إعلانات حالياً.</div> : (
                  announcements.slice(0, 5).map((announcement) => (
                    <div key={announcement.id} style={{ padding: '10px 0', borderBottom: '1px solid #eee' }}>
                      <strong>{announcement.title}</strong>
                      <p>{announcement.content}</p>
                      {announcement.imageUrl && <img src={announcement.imageUrl} alt={announcement.title} style={{ maxWidth: '100%', maxHeight: 100, objectFit: 'cover' }} />}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {activePanel === 'subjects' && (
          <div className="card" style={{ padding: 20, marginTop: 24 }}>
            <h3>المواد والدروس</h3>
            {curriculum.length === 0 ? (
              <div className="empty-state">لم يتم إسناد أي مواد لك حالياً.</div>
            ) : (
              curriculum.map((subject) => (
                <div key={subject.id} style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #eee' }}>
                  <h4>{subject.name}</h4>
                  {subject.units.map((unit) => (
                    <div key={unit.id} style={{ marginLeft: 20, marginBottom: 12 }}>
                      <strong>📌 {unit.name}</strong>
                      {unit.lessons.map((lesson) => (
                        <div key={lesson.id} style={{ marginLeft: 20, marginBottom: 8, padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                          <div>📖 {lesson.name}</div>
                          {lesson.sections.length > 0 && (
                            <div style={{ marginTop: 8, fontSize: '0.9em' }}>
                              {lesson.sections.map((section) => (
                                <div key={section.id} style={{ marginLeft: 20, padding: '4px 0' }}>
                                  • {section.sectionType}: {section.title}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {activePanel === 'tests' && (
          <div className="card" style={{ padding: 20, marginTop: 24 }}>
            <h3>الاختبارات</h3>
            <p className="muted">اختبارات متاحة لك حسب مرحلتك وموادك</p>
            <p style={{ fontSize: '0.9em' }}>هذا القسم سيتم تحديثه قريباً بواجهة شاملة للاختبارات.</p>
          </div>
        )}

        {activePanel === 'files' && (
          <div className="card" style={{ padding: 20, marginTop: 24 }}>
            <h3>الملفات والموارد</h3>
            <p className="muted">ملفات وموارد تعليمية من الإدارة</p>
            <p style={{ fontSize: '0.9em' }}>هذا القسم سيتم تحديثه قريباً مع ملفات تعليمية شاملة.</p>
          </div>
        )}

        {activePanel === 'chat' && (
          <div className="card chat-shell" style={{ padding: 0, marginTop: 24 }}>
            <div className="chat-header">
              <div className="chat-avatar">◉</div>
              <div><strong>الشات العام</strong><span className="muted">تواصل مع جميع الطلاب</span></div>
            </div>
            <div className="chat-messages" style={{ minHeight: '300px', maxHeight: '400px', overflow: 'auto' }}>
              {publicChatMessages.length === 0 ? (
                <div className="empty-state">لا توجد رسائل بعد. كن أول من يرسل رسالة!</div>
              ) : (
                publicChatMessages.map((msg) => (
                  <div key={msg.id} className={`chat-message ${msg.studentId === user.id ? 'mine' : 'theirs'}`}>
                    <div className="chat-bubble">
                      <strong>{msg.studentName}</strong>
                      <p>{msg.message}</p>
                      {msg.imageUrl && <img className="chat-image" src={msg.imageUrl} alt="صورة" />}
                      <span className="chat-time">{msg.createdAt}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            {chatMuteStatus.isMuted ? (
              <div style={{ padding: 16, backgroundColor: '#ffebee', color: '#c62828', textAlign: 'center' }}>
                <strong>تم كتم صوتك</strong>
                <p className="muted">حتى {chatMuteStatus.mute?.mutedUntil}</p>
              </div>
            ) : (
              <form className="chat-composer" onSubmit={sendChatMessage}>
                <textarea rows="1" value={newChatMessage} onChange={(e) => setNewChatMessage(e.target.value)} placeholder="اكتب رسالة في الشات العام..." />
                <button type="submit" disabled={!newChatMessage.trim()}>إرسال</button>
              </form>
            )}
          </div>
        )}

        {activePanel === 'notes' && (
          <div className="card" style={{ padding: 20, marginTop: 24 }}>
            <h3>ملاحظاتي</h3>
            <form onSubmit={sendNote} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #eee' }}>
              <div className="form-group">
                <label>اكتب ملاحظة</label>
                <textarea rows="4" value={newNote.note} onChange={(e) => setNewNote({ ...newNote, note: e.target.value })} placeholder="اكتب ملاحظة عن دراستك أو درس معين..." />
              </div>
              <button type="submit">إرسال الملاحظة</button>
            </form>
            {notes.length === 0 ? (
              <div className="empty-state">لم تكتب أي ملاحظات حتى الآن.</div>
            ) : (
              notes.map((note) => (
                <div key={note.id} style={{ padding: 12, marginBottom: 12, backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{note.subjectName || 'ملاحظة عامة'}</strong>
                    <span className={`badge ${note.readStatus === 'read' ? '' : 'unread-badge'}`}>{note.readStatus === 'unread' ? 'غير مقروءة' : 'مقروءة'}</span>
                  </div>
                  <p style={{ margin: '8px 0' }}>{note.note}</p>
                  {note.adminReply && (
                    <div style={{ padding: 8, backgroundColor: '#e8f5e9', borderRadius: '4px', marginTop: 8 }}>
                      <strong>رد الإدارة:</strong>
                      <p>{note.adminReply}</p>
                    </div>
                  )}
                  <span className="muted" style={{ fontSize: '0.85em' }}>{note.createdAt}</span>
                </div>
              ))
            )}
          </div>
        )}

        {activePanel === 'messages' && (
          <div className="card chat-shell" style={{ padding: 0, marginTop: 24 }}>
            <div className="chat-header">
              <div className="chat-avatar">◉</div>
              <div><strong>الإدارة</strong><span className="muted">الدعم والمتابعة</span></div>
            </div>
            <div className="chat-messages">
              {messages.length === 0 && <div className="empty-state">ابدأ المحادثة مع الإدارة.</div>}
              {[...messages].reverse().map((message) => (
                <div key={message.id} className={`chat-message ${message.senderId === user.id ? 'mine' : 'theirs'}`}>
                  <div className="chat-bubble">
                    <p>{message.message}</p>
                    {message.imageUrl && <img className="chat-image" src={message.imageUrl} alt="مرفق من المحادثة" />}
                    <span className="chat-time">{message.senderId === user.id ? 'أنت' : message.senderName} · {message.createdAt}</span>
                  </div>
                </div>
              ))}
            </div>
            <form className="chat-composer" onSubmit={sendMessage}>
              <textarea rows="1" value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="اكتب رسالة..." />
              <button type="submit" disabled={!messageText.trim()}>إرسال</button>
            </form>
          </div>
        )}

        {activePanel === 'announcements' && (
          <div className="card" style={{ padding: 20, marginTop: 24 }}>
            <h3>الإعلانات</h3>
            {announcements.length === 0 ? (
              <div className="empty-state">لا توجد إعلانات حالياً.</div>
            ) : (
              announcements.map((announcement) => (
                <div key={announcement.id} style={{ padding: 16, marginBottom: 12, backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                  <h4>{announcement.title}</h4>
                  <p>{announcement.content}</p>
                  {announcement.imageUrl && <img src={announcement.imageUrl} alt={announcement.title} style={{ maxWidth: '100%', maxHeight: 250, objectFit: 'cover', marginTop: 8 }} />}
                  <span className="muted" style={{ fontSize: '0.85em' }}>{announcement.createdAt}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Placeholder for AdminDashboard - use the existing one from App.jsx
function AdminDashboard({ user, setUser, refresh }) {
  return <div style={{ padding: 20 }}>
    <h1>لوحة الإدارة - قيد التحديث</h1>
    <p>يرجى استخدام لوحة الإدارة الحالية</p>
  </div>;
}

export default App;
