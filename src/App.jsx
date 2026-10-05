import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

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
    return <>
      <BackgroundEffects />
      <div className="container"><div className="card login-box">جارٍ تحميل النظام...</div></div>
    </>;
  }

  return (
    <>
      <BackgroundEffects />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={user ? (user.role === 'student' ? <StudentHome user={user} setUser={setUser} refresh={refresh} /> : <Navigate to="/admin/dashboard" replace />) : <LoginPage />} />
          <Route path="/admin/login" element={user && ['admin', 'super_admin'].includes(user.role) ? <Navigate to="/admin/dashboard" replace /> : <AdminLogin setUser={setUser} />} />
          <Route path="/admin/dashboard" element={user && ['admin', 'super_admin'].includes(user.role) ? <AdminDashboard user={user} setUser={setUser} refresh={refresh} /> : <Navigate to="/admin/login" replace />} />
          <Route path="/student/dashboard" element={user && user.role === 'student' ? <StudentHome user={user} setUser={setUser} refresh={refresh} /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

function BackgroundEffects() {
  const particles = Array.from({ length: 14 }, (_, index) => {
    const seed = index + 1;
    return {
      left: `${(seed * 37 + 11) % 100}%`,
      top: `${(seed * 61 + 7) % 100}%`,
      size: `${2 + (seed % 3)}px`,
      duration: `${24 + ((seed * 7) % 20)}s`,
      delay: `${-((seed * 5) % 35)}s`,
      driftX: `${((seed * 17) % 50) - 25}px`,
      driftY: `${((seed * 23) % 60) - 30}px`,
    };
  });

  return (
    <div className="visual-background" aria-hidden="true">
      <div className="visual-background__gradient" />
      <div className="visual-background__orbs">
        <span className="visual-orb visual-orb--one" />
        <span className="visual-orb visual-orb--two" />
        <span className="visual-orb visual-orb--three" />
      </div>
      <div className="visual-background__particles">
        {particles.map((particle, index) => (
          <span
            key={index}
            className="visual-particle"
            style={{
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
              animationDuration: particle.duration,
              animationDelay: particle.delay,
              '--particle-drift-x': particle.driftX,
              '--particle-drift-y': particle.driftY,
            }}
          />
        ))}
      </div>
    </div>
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

    window.location.href = `${import.meta.env.BASE_URL}student/dashboard`;
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
            <Link to="/admin/login">لوحة الإدارة</Link>
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
    window.location.href = `${import.meta.env.BASE_URL}admin/dashboard`;
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
  const studentPanelContentRef = useRef(null);
  const previousStudentPanelRef = useRef('home');
  const [curriculum, setCurriculum] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [isSavingSubjects, setIsSavingSubjects] = useState(false);
  const [subjectSaveMessage, setSubjectSaveMessage] = useState('');
  const [publicChatMessages, setPublicChatMessages] = useState([]);
  const [learningResources, setLearningResources] = useState([]);
  const [learningResourceSearch, setLearningResourceSearch] = useState('');
  const publicChatContainerRef = useRef(null);
  const followPublicChatRef = useRef(true);
  const [chatMuteStatus, setChatMuteStatus] = useState({ isMuted: false });
  const [newChatMessage, setNewChatMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const studentPrivateChatRef = useRef(null);
  const [availableAdmins, setAvailableAdmins] = useState([]);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [progress, setProgress] = useState({ predictedAverage: 0, streak: 0 });
  const [weeklySchedules, setWeeklySchedules] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedAnnouncementImage, setSelectedAnnouncementImage] = useState(null);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState({ subjectId: '', note: '' });
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    if (previousStudentPanelRef.current === activePanel) return;
    previousStudentPanelRef.current = activePanel;
    requestAnimationFrame(() => studentPanelContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [activePanel]);

  useEffect(() => {
    fetch('/api/student/subjects', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setAvailableSubjects(data.availableSubjects || []);
          setSelectedSubjectIds(data.selectedSubjectIds || []);
        }
      })
      .catch(() => {});

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

    fetch('/api/student/learning-resources', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setLearningResources(data))
      .catch(() => setLearningResources([]));

    fetch('/api/student/notes', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setNotes(data))
      .catch(() => setNotes([]));

    fetch('/api/messages', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setMessages(data))
      .catch(() => setMessages([]));

    fetch('/api/student/admins', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setAvailableAdmins(data);
        if (data.length) setSelectedAdminId(String(data[0].id));
      })
      .catch(() => setAvailableAdmins([]));
  }, []);

  const selectedAdmin = availableAdmins.find((admin) => Number(admin.id) === Number(selectedAdminId));
  const selectedAdminMessages = messages.filter((message) => (
    selectedAdminId
    && ((Number(message.senderId) === user.id && Number(message.recipientId) === Number(selectedAdminId))
      || (Number(message.senderId) === Number(selectedAdminId) && Number(message.recipientId) === user.id))
  ));
  const latestSelectedAdminMessageId = selectedAdminMessages[0]?.id;
  const learningResourceSearchTerm = learningResourceSearch.trim().toLocaleLowerCase();
  const filteredLearningResources = learningResources.filter((resource) => (
    `${resource.description || ''} ${resource.resourceType === 'image' ? 'صورة image' : 'رابط link'} ${resource.resourceUrl || ''} ${resource.creatorName || ''}`
      .toLocaleLowerCase()
      .includes(learningResourceSearchTerm)
  ));

  useEffect(() => {
    if (activePanel !== 'messages' || !selectedAdminId || !selectedAdmin) return;
    fetch(`/api/student/messages/read-conversation/${selectedAdminId}`, { method: 'POST', credentials: 'include' })
      .then((response) => {
        if (!response.ok) return;
        setMessages((current) => current.map((message) => (
          Number(message.senderId) === Number(selectedAdminId) && Number(message.recipientId) === user.id
            ? { ...message, readStatus: 'read' }
            : message
        )));
      })
      .catch(() => {});
  }, [activePanel, selectedAdminId, selectedAdmin, user.id]);

  async function saveSelectedSubjects(e) {
    e.preventDefault();
    setIsSavingSubjects(true);
    setSubjectSaveMessage('');
    try {
      const res = await fetch('/api/student/subjects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subjectIds: selectedSubjectIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubjectSaveMessage(data.message || 'تعذر حفظ المواد المختارة. حاول مرة أخرى.');
        return;
      }

      const [curriculumResponse, sessionResponse] = await Promise.all([
        fetch('/api/student/curriculum', { credentials: 'include' }),
        fetch('/api/auth/session', { credentials: 'include' }),
      ]);
      if (curriculumResponse.ok) setCurriculum(await curriculumResponse.json());
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        setUser(sessionData.user);
      }
      setSubjectSaveMessage(data.message || 'تم حفظ المواد المختارة.');
    } catch {
      setSubjectSaveMessage('تعذر الاتصال بالخادم. حاول مرة أخرى.');
    } finally {
      setIsSavingSubjects(false);
    }
  }

  useEffect(() => {
    if (!selectedAnnouncementImage) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') setSelectedAnnouncementImage(null);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAnnouncementImage]);

  useEffect(() => {
    if (activePanel !== 'chat') return undefined;
    followPublicChatRef.current = true;
    requestAnimationFrame(() => {
      const chatContainer = publicChatContainerRef.current;
      if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    });
    const loadPublicChat = () => {
      fetch('/api/public-chat/messages', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setPublicChatMessages(data))
        .catch(() => {});
      fetch('/api/student/chat-mute-status', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : { isMuted: false }))
        .then((data) => setChatMuteStatus(data))
        .catch(() => {});
    };
    loadPublicChat();
    const intervalId = window.setInterval(loadPublicChat, 5000);
    return () => window.clearInterval(intervalId);
  }, [activePanel]);

  useEffect(() => {
    if (activePanel !== 'chat' || !followPublicChatRef.current) return;
    const chatContainer = publicChatContainerRef.current;
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
  }, [activePanel, publicChatMessages.length]);

  useEffect(() => {
    if (activePanel !== 'messages') return undefined;
    const scrollToLatestMessage = () => {
      const chatContainer = studentPrivateChatRef.current;
      if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    };
    requestAnimationFrame(scrollToLatestMessage);
    const intervalId = window.setInterval(() => {
      fetch('/api/messages', { credentials: 'include' })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (data) setMessages(data);
        })
        .catch(() => {});
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [activePanel]);

  useEffect(() => {
    if (activePanel !== 'content-exams') return undefined;
    const loadLearningResources = () => {
      fetch('/api/student/learning-resources', { credentials: 'include' })
        .then((response) => (response.ok ? response.json() : []))
        .then((data) => setLearningResources(data))
        .catch(() => {});
    };
    loadLearningResources();
    const intervalId = window.setInterval(loadLearningResources, 15000);
    return () => window.clearInterval(intervalId);
  }, [activePanel]);

  useEffect(() => {
    if (activePanel !== 'messages') return;
    const chatContainer = studentPrivateChatRef.current;
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
  }, [activePanel, selectedAdminId, selectedAdminMessages.length, latestSelectedAdminMessageId]);

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

    try {
      const res = await fetch('/api/public-chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: newChatMessage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          alert('انتهت جلسة الدخول. سجّل الدخول مجدداً لإرسال الرسائل.');
          setUser(null);
          window.location.href = import.meta.env.BASE_URL;
          return;
        }
        alert(data.message || 'تعذر إرسال الرسالة إلى الشات العام.');
        return;
      }

      setNewChatMessage('');
      const updated = await fetch('/api/public-chat/messages', { credentials: 'include' });
      if (updated.ok) setPublicChatMessages(await updated.json());
    } catch {
      alert('تعذر الاتصال بالخادم. تحقق من اتصالك وحاول مجدداً.');
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
    if (!messageText.trim() || !selectedAdminId) return;
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: messageText, recipientId: Number(selectedAdminId) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          alert('انتهت جلسة الدخول. سجّل الدخول مجدداً لإرسال الرسائل.');
          setUser(null);
          window.location.href = import.meta.env.BASE_URL;
          return;
        }
        alert(data.message || 'تعذر إرسال الرسالة إلى الإدارة.');
        return;
      }

      setMessageText('');
      const updated = await fetch('/api/messages', { credentials: 'include' });
      if (updated.ok) setMessages(await updated.json());
    } catch {
      alert('تعذر الاتصال بالخادم. تحقق من اتصالك وحاول مجدداً.');
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    window.location.href = import.meta.env.BASE_URL;
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
          <button type="button" className={`student-tile ${activePanel === 'content-exams' ? 'active' : ''}`} onClick={() => setActivePanel('content-exams')}>
            <span className="tile-icon">📖</span><strong>المحتوى والاختبارات</strong><span className="muted">{learningResources.length} مواد تعليمية</span>
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
          <button type="button" className={`student-tile ${activePanel === 'schedule' ? 'active' : ''}`} onClick={() => setActivePanel('schedule')}>
            <span className="tile-icon">📅</span><strong>الجدول الأسبوعي</strong><span className="muted">جدولك المرسل من الإدارة</span>
          </button>
          <button type="button" className={`student-tile ${activePanel === 'progress' ? 'active' : ''}`} onClick={() => setActivePanel('progress')}>
            <span className="tile-icon">📈</span><strong>توقع المعدل</strong><span className="muted">المعدل المتوقع حالياً</span>
          </button>
          <button type="button" className={`student-tile ${activePanel === 'home' ? 'active' : ''}`} onClick={() => setActivePanel('home')}>
            <span className="tile-icon">🏠</span><strong>الرئيسية</strong><span className="muted">نظرة عامة</span>
          </button>
        </div>

        <div ref={studentPanelContentRef} className="student-panel-content">
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
                      {announcement.imageUrl && <button type="button" className="announcement-image-button" onClick={() => setSelectedAnnouncementImage({ src: announcement.imageUrl, alt: announcement.title })} aria-label={`تكبير صورة الإعلان: ${announcement.title}`}><img src={announcement.imageUrl} alt={announcement.title} style={{ maxWidth: '100%', maxHeight: 100, objectFit: 'cover' }} /></button>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {activePanel === 'subjects' && (
          <div className="card" style={{ padding: 20, marginTop: 24 }}>
            <h3>اختر المواد التي تريد دراستها</h3>
            <p className="muted">حدد المواد التي تريدها، ثم اضغط حفظ. يمكنك تغيير اختيارك لاحقاً.</p>
            <form onSubmit={saveSelectedSubjects}>
              <div className="subject-choice-grid">
                {availableSubjects.map((subject) => (
                  <label key={subject.id} className={`subject-choice ${selectedSubjectIds.includes(subject.id) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedSubjectIds.includes(subject.id)}
                      onChange={(event) => setSelectedSubjectIds((current) => (
                        event.target.checked
                          ? [...current, subject.id]
                          : current.filter((id) => id !== subject.id)
                      ))}
                    />
                    <span>{subject.name}</span>
                  </label>
                ))}
              </div>
              {subjectSaveMessage && <p className={subjectSaveMessage.startsWith('تم') ? 'form-success' : 'form-error'} role="status">{subjectSaveMessage}</p>}
              <button type="submit" disabled={isSavingSubjects}>{isSavingSubjects ? 'جارٍ الحفظ...' : 'حفظ المواد المختارة'}</button>
            </form>

            <h3 style={{ marginTop: 28 }}>موادي ودروسي</h3>
            {curriculum.length === 0 ? (
              <div className="empty-state">لم تختر أي مواد بعد، أو لا يوجد محتوى دراسي منشور لها.</div>
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

        {activePanel === 'content-exams' && (
          <section className="card learning-resources-panel" aria-labelledby="learning-resources-heading">
            <div className="learning-resources-heading">
              <h2 id="learning-resources-heading">المحتوى والاختبارات</h2>
              <span className="muted">{filteredLearningResources.length} من {learningResources.length}</span>
            </div>
            <input
              className="learning-resource-search"
              type="search"
              value={learningResourceSearch}
              onChange={(event) => setLearningResourceSearch(event.target.value)}
              placeholder="ابحث في المحتوى والاختبارات..."
              aria-label="ابحث في المحتوى والاختبارات"
            />
            {learningResources.length === 0 ? (
              <div className="empty-state">لا يوجد محتوى تعليمي منشور حالياً.</div>
            ) : filteredLearningResources.length === 0 ? (
              <div className="empty-state">لا يوجد محتوى يطابق بحثك.</div>
            ) : (
              <div className="learning-resource-grid">
                {filteredLearningResources.map((resource) => (
                  <article key={resource.id} className="learning-resource-card">
                    <div className="learning-resource-card-heading">
                      <span className="badge">{resource.resourceType === 'image' ? 'صورة تعليمية' : 'رابط تعليمي'}</span>
                      <time className="muted">{resource.createdAt}</time>
                    </div>
                    <p>{resource.description}</p>
                    {resource.resourceType === 'image' && resource.imageUrl && (
                      <button type="button" className="announcement-image-button learning-resource-image-button" onClick={() => setSelectedAnnouncementImage({ src: resource.imageUrl, alt: resource.description })} aria-label="تكبير الصورة التعليمية">
                        <img src={resource.imageUrl} alt={resource.description} />
                      </button>
                    )}
                    {resource.resourceType === 'link' && resource.resourceUrl && (
                      <a className="learning-resource-link" href={resource.resourceUrl} target="_blank" rel="noopener noreferrer">فتح الرابط التعليمي ↗</a>
                    )}
                    <small className="muted">من {resource.creatorName || 'الإدارة'}</small>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activePanel === 'chat' && (
          <div className="card chat-shell" style={{ padding: 0, marginTop: 24 }}>
            <div className="chat-header">
              <div className="chat-avatar">◉</div>
              <div><strong>الشات العام</strong><span className="muted">تواصل مع جميع الطلاب</span></div>
            </div>
            <div ref={publicChatContainerRef} onScroll={(event) => {
              const element = event.currentTarget;
              followPublicChatRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
            }} className="chat-messages" style={{ minHeight: '300px', maxHeight: '400px', overflow: 'auto' }}>
              {publicChatMessages.length === 0 ? (
                <div className="empty-state">لا توجد رسائل بعد. كن أول من يرسل رسالة!</div>
              ) : (
                publicChatMessages.map((msg) => (
                  <div key={msg.id} className={`chat-message ${msg.studentId === user.id ? 'mine' : 'theirs'}`}>
                    <div className="chat-bubble">
                      <strong>{msg.studentName}{msg.authorRole !== 'student' ? ' · الإدارة' : ''}</strong>
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
                <p className="muted">{chatMuteStatus.isPermanent ? 'الحظر دائم حتى ترفعه الإدارة.' : `حتى ${chatMuteStatus.mute?.mutedUntil}`}</p>
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
              <div><strong>{selectedAdmin?.name || 'محادثة مع الإدارة'}</strong><span className="muted">{selectedAdmin?.role === 'super_admin' ? 'المدير العام' : 'الأدمن'} · الدعم والمتابعة</span></div>
            </div>
            <div className="admin-recipient-picker">
              <label htmlFor="student-admin-recipient">اختر الأدمن الذي تريد مراسلته</label>
              <select id="student-admin-recipient" value={selectedAdminId} onChange={(event) => setSelectedAdminId(event.target.value)} disabled={!availableAdmins.length}>
                {availableAdmins.length === 0 ? <option value="">لا يوجد أدمن متاح حالياً</option> : availableAdmins.map((admin) => (
                  <option key={admin.id} value={admin.id}>{admin.name} — {admin.role === 'super_admin' ? 'المدير العام' : 'أدمن'}</option>
                ))}
              </select>
            </div>
            <div ref={studentPrivateChatRef} className="chat-messages">
              {selectedAdminMessages.length === 0 && <div className="empty-state">{selectedAdmin ? `ابدأ محادثتك مع ${selectedAdmin.name}.` : 'لا يوجد أدمن متاح للمراسلة حالياً.'}</div>}
              {[...selectedAdminMessages].reverse().map((message) => (
                <div key={message.id} className={`chat-message ${message.senderId === user.id ? 'mine' : 'theirs'}`}>
                  <div className="chat-bubble">
                    <p>{message.message}</p>
                    {message.imageUrl && <button type="button" className="announcement-image-button" onClick={() => setSelectedAnnouncementImage({ src: message.imageUrl, alt: 'صورة مرفقة من الإدارة' })} aria-label="تكبير الصورة المرفقة من الإدارة"><img className="chat-image" src={message.imageUrl} alt="صورة مرفقة من الإدارة — اضغط للتكبير" /></button>}
                    <span className="chat-time">{message.senderId === user.id ? 'أنت' : message.senderName} · {message.createdAt}</span>
                  </div>
                </div>
              ))}
            </div>
            <form className="chat-composer" onSubmit={sendMessage}>
              <textarea rows="1" value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder={selectedAdmin ? `اكتب رسالة إلى ${selectedAdmin.name}...` : 'اختر أدمن لإرسال رسالة'} disabled={!selectedAdminId} />
              <button type="submit" disabled={!messageText.trim() || !selectedAdminId}>إرسال</button>
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
                  {announcement.imageUrl && <button type="button" className="announcement-image-button" onClick={() => setSelectedAnnouncementImage({ src: announcement.imageUrl, alt: announcement.title })} aria-label={`تكبير صورة الإعلان: ${announcement.title}`}><img src={announcement.imageUrl} alt={announcement.title} style={{ maxWidth: '100%', maxHeight: 250, objectFit: 'cover', marginTop: 8 }} /></button>}
                  <span className="muted" style={{ fontSize: '0.85em' }}>{announcement.createdAt}</span>
                </div>
              ))
            )}
          </div>
        )}

        <div className={`card ${activePanel !== 'schedule' ? 'student-panel-hidden' : ''}`} style={{ marginTop: 24, padding: 20 }}>
          <h3>الجدول الأسبوعي</h3>
          {weeklySchedules.length === 0 ? <div className="empty-state">لم يرسل الأدمن جدولاً أسبوعياً بعد.</div> : weeklySchedules.map((schedule) => (
            <div key={schedule.id} style={{ marginBottom: 18 }}>
              <strong>{schedule.title}</strong>
              <img className="weekly-schedule-image" src={schedule.imageUrl} alt={schedule.title} />
              <div className="muted">آخر تحديث: {schedule.updatedAt}</div>
            </div>
          ))}
        </div>

        <div className={`card ${activePanel !== 'progress' ? 'student-panel-hidden' : ''}`} style={{ marginTop: 24, padding: 20 }}>
          <h3>توقع معدل التوجيهي</h3>
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 48, fontWeight: 700, color: '#0b7dff' }}>{Number(progress.predictedAverage || 0).toFixed(1)}%</div>
            <p className="muted">التوقع يحدده الأدمن حسب مستوى إنجازك.</p>
          </div>
        </div>

        {selectedAnnouncementImage && (
          <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="الصورة المكبرة" onClick={() => setSelectedAnnouncementImage(null)}>
            <button type="button" className="image-lightbox-close" onClick={() => setSelectedAnnouncementImage(null)} aria-label="إغلاق الصورة">×</button>
            <img src={selectedAnnouncementImage.src} alt={selectedAnnouncementImage.alt} onClick={(event) => event.stopPropagation()} />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

async function compressPrivateChatImage(file) {
  const maxDataUrlLength = 1600000;
  const objectUrl = URL.createObjectURL(file);
  const image = await new Promise((resolve, reject) => {
    const loadedImage = new Image();
    loadedImage.onload = () => resolve(loadedImage);
    loadedImage.onerror = () => reject(new Error('تعذر فتح الصورة. اختر صورة أخرى.'));
    loadedImage.src = objectUrl;
  }).finally(() => URL.revokeObjectURL(objectUrl));

  let scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
  let quality = 0.86;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('تعذر تجهيز الصورة على هذا المتصفح.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const compressed = canvas.toDataURL('image/jpeg', quality);
    if (compressed.length <= maxDataUrlLength) return compressed;
    if (quality > 0.56) quality -= 0.1;
    else scale *= 0.82;
  }

  throw new Error('حجم الصورة كبير جداً حتى بعد ضغطها. اختر صورة أصغر.');
}

async function prepareWeeklyScheduleImage(file) {
  const maxDataUrlLength = 1950000;
  const imageUrl = await new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('تعذر فتح الصورة. اختر صورة أخرى.'));
    };
    image.src = objectUrl;
  });

  let scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
  let quality = 0.88;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const compressed = canvas.toDataURL('image/jpeg', quality);
    if (compressed.length <= maxDataUrlLength) return compressed;
    if (quality > 0.5) quality -= 0.1;
    else scale *= 0.8;
  }

  throw new Error('تعذر ضغط الصورة بالحجم المناسب. جرّب صورة أصغر.');
}

function AdminDashboard({ user, setUser, refresh }) {
  const [adminPanel, setAdminPanel] = useState('students');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [selectedStudentDetailsId, setSelectedStudentDetailsId] = useState('');
  const [studentManagementSearch, setStudentManagementSearch] = useState('');
  const [selectedChatStudentId, setSelectedChatStudentId] = useState('');
  const [chatStudentSearch, setChatStudentSearch] = useState('');
  const [stats, setStats] = useState({});
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [units, setUnits] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [deletingStudentId, setDeletingStudentId] = useState(null);
  const [weeklySchedules, setWeeklySchedules] = useState([]);
  const [scheduleUploadError, setScheduleUploadError] = useState('');
  const [scheduleUploadSuccess, setScheduleUploadSuccess] = useState('');
  const [isSendingSchedule, setIsSendingSchedule] = useState(false);
  const [scheduleHistoryStudentId, setScheduleHistoryStudentId] = useState('');
  const [scheduleHistorySearch, setScheduleHistorySearch] = useState('');
  const [deletingWeeklyScheduleId, setDeletingWeeklyScheduleId] = useState(null);
  const [activeStudents, setActiveStudents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [adminLearningResources, setAdminLearningResources] = useState([]);
  const [adminLearningResourceSearch, setAdminLearningResourceSearch] = useState('');
  const [learningResourceForm, setLearningResourceForm] = useState({ resourceType: 'image', description: '', resourceUrl: '' });
  const [learningResourceImage, setLearningResourceImage] = useState('');
  const [learningResourceError, setLearningResourceError] = useState('');
  const [learningResourceSuccess, setLearningResourceSuccess] = useState('');
  const [isProcessingLearningImage, setIsProcessingLearningImage] = useState(false);
  const [isPublishingLearningResource, setIsPublishingLearningResource] = useState(false);
  const [deletingLearningResourceId, setDeletingLearningResourceId] = useState(null);
  const [adminPublicChatMessages, setAdminPublicChatMessages] = useState([]);
  const adminPublicChatContainerRef = useRef(null);
  const followAdminPublicChatRef = useRef(true);
  const adminPrivateChatRef = useRef(null);
  const [publicChatMutes, setPublicChatMutes] = useState([]);
  const [adminPublicChatDraft, setAdminPublicChatDraft] = useState('');
  const [publicChatNotice, setPublicChatNotice] = useState('');
  const [isSendingPublicChatMessage, setIsSendingPublicChatMessage] = useState(false);
  const [chatMessageText, setChatMessageText] = useState('');
  const [chatImageUrl, setChatImageUrl] = useState('');
  const [chatImageError, setChatImageError] = useState('');
  const [isProcessingChatImage, setIsProcessingChatImage] = useState(false);
  const [privateChatError, setPrivateChatError] = useState('');
  const [isSendingPrivateMessage, setIsSendingPrivateMessage] = useState(false);
  const [results, setResults] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [progressDrafts, setProgressDrafts] = useState({});
  const [adminPermissions, setAdminPermissions] = useState({ permissions: [], admins: [] });
  const [subjectForm, setSubjectForm] = useState({ name: '', gradeId: 1, description: '' });
  const [unitForm, setUnitForm] = useState({ subjectId: 1, name: '', description: '' });
  const [lessonForm, setLessonForm] = useState({ unitId: 1, name: '', description: '' });
  const [sectionForm, setSectionForm] = useState({ lessonId: '', sectionType: 'text', title: '', content: '' });
  const [examForm, setExamForm] = useState({ title: '', description: '', imageUrl: '', resourceUrl: '', gradeId: 1, subjectId: 1, unitId: '', lessonId: '', totalMarks: 10 });
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', imageUrl: '', targetGrade: '' });
  const [enrollmentForm, setEnrollmentForm] = useState({ studentId: '', subjectId: '' });
  const [studentForm, setStudentForm] = useState({ name: '', email: '', password: '', gradeId: '' });
  const [questionForm, setQuestionForm] = useState({ examId: '', questionText: '', marks: 1, answers: ['', '', '', ''], correctIndex: 0 });
  const [scheduleForm, setScheduleForm] = useState({ studentIds: [], imageUrl: '', title: 'الجدول الأسبوعي' });
  const [scheduleStudentSearch, setScheduleStudentSearch] = useState('');
  const searchTerm = chatStudentSearch.trim().toLocaleLowerCase();
  const unreadIncomingMessages = messages.filter((message) => Number(message.recipientId) === Number(user.id)
    && message.senderRole === 'student' && message.readStatus === 'unread');
  const unreadStudentIds = new Set(unreadIncomingMessages.map((message) => Number(message.senderId)));
  const latestUnreadByStudent = new Map();
  unreadIncomingMessages.forEach((message) => {
    const studentId = Number(message.senderId);
    if (!latestUnreadByStudent.has(studentId) || message.createdAt > latestUnreadByStudent.get(studentId)) {
      latestUnreadByStudent.set(studentId, message.createdAt);
    }
  });
  const chatStudents = students.filter((student) => student.role === 'student'
    && `${student.name || ''} ${student.email || ''}`.toLocaleLowerCase().includes(searchTerm))
    .sort((first, second) => {
      const firstUnreadAt = latestUnreadByStudent.get(Number(first.id));
      const secondUnreadAt = latestUnreadByStudent.get(Number(second.id));
      if (firstUnreadAt && secondUnreadAt) return secondUnreadAt.localeCompare(firstUnreadAt);
      if (firstUnreadAt) return -1;
      if (secondUnreadAt) return 1;
      return (first.name || '').localeCompare(second.name || '', 'ar');
    });
  const scheduleSearchTerm = scheduleStudentSearch.trim().toLocaleLowerCase();
  const scheduleStudents = students.filter((student) => student.role === 'student'
    && `${student.name || ''} ${student.email || ''}`.toLocaleLowerCase().includes(scheduleSearchTerm));
  const scheduleHistorySearchTerm = scheduleHistorySearch.trim().toLocaleLowerCase();
  const scheduleHistoryStudents = students.filter((student) => student.role === 'student'
    && `${student.name || ''} ${student.email || ''}`.toLocaleLowerCase().includes(scheduleHistorySearchTerm));
  const selectedScheduleStudent = students.find((student) => student.id === Number(scheduleHistoryStudentId));
  const studentManagementSearchTerm = studentManagementSearch.trim().toLocaleLowerCase();
  const filteredManagementStudents = students.filter((student) => (
    `${student.name || ''} ${student.email || ''} ${student.role || ''} ${student.gradeName || ''}`
      .toLocaleLowerCase()
      .includes(studentManagementSearchTerm)
  ));
  const visibleWeeklySchedules = weeklySchedules.filter((schedule) => (
    scheduleHistoryStudentId && schedule.studentId === Number(scheduleHistoryStudentId)
  ));
  const selectedPrivateMessages = messages.filter((message) => selectedChatStudentId
    && (Number(message.senderId) === Number(selectedChatStudentId) || Number(message.recipientId) === Number(selectedChatStudentId)));
  const latestPrivateMessageId = selectedPrivateMessages[0]?.id;
  const adminLearningResourceSearchTerm = adminLearningResourceSearch.trim().toLocaleLowerCase();
  const filteredAdminLearningResources = adminLearningResources.filter((resource) => (
    `${resource.description || ''} ${resource.resourceType === 'image' ? 'صورة image' : 'رابط link'} ${resource.resourceUrl || ''} ${resource.creatorName || ''}`
      .toLocaleLowerCase()
      .includes(adminLearningResourceSearchTerm)
  ));

  useEffect(() => {
    fetch('/api/grades', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setGrades(data));

    fetch('/api/admin/dashboard', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setStats(data.stats || {});
          setSubjects(data.subjects || []);
        }
      });

    fetch('/api/admin/students', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setStudents(data));

    fetch('/api/admin/weekly-schedules', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setWeeklySchedules(data));

    fetch('/api/admin/active-students', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setActiveStudents(data));

    fetch('/api/messages', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setMessages(data));

    fetch('/api/admin/results', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setResults(data));

    fetch('/api/admin/subjects', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSubjects(data));

    fetch('/api/admin/units', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setUnits(data));

    fetch('/api/admin/lessons', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setLessons(data));

    fetch('/api/admin/exams', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setExams(data));

    fetch('/api/admin/announcements', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAnnouncements(data));

    fetch('/api/admin/audit-logs', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAuditLogs(data));

    fetch('/api/admin/enrollments', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setEnrollments(data));

    fetch('/api/admin/permissions', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { permissions: [], admins: [] }))
      .then((data) => setAdminPermissions(data));
  }, []);

  useEffect(() => {
    const refreshDirectMessages = () => {
      fetch('/api/messages', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setMessages(data);
        })
        .catch(() => {});
    };
    const intervalId = window.setInterval(refreshDirectMessages, 5000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (adminPanel !== 'notes') return;
    const chatContainer = adminPrivateChatRef.current;
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
  }, [adminPanel, selectedChatStudentId, selectedPrivateMessages.length, latestPrivateMessageId]);

  useEffect(() => {
    if (adminPanel !== 'public-chat') return undefined;
    followAdminPublicChatRef.current = true;
    requestAnimationFrame(() => {
      const chatContainer = adminPublicChatContainerRef.current;
      if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    });
    const loadPublicChatAdminData = () => {
      fetch('/api/public-chat/messages', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setAdminPublicChatMessages(data))
        .catch(() => {});
      fetch('/api/admin/chat/mutes', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setPublicChatMutes(data))
        .catch(() => {});
    };
    loadPublicChatAdminData();
    const intervalId = window.setInterval(loadPublicChatAdminData, 5000);
    return () => window.clearInterval(intervalId);
  }, [adminPanel]);

  useEffect(() => {
    if (adminPanel !== 'learning-resources') return undefined;
    const loadLearningResources = () => {
      fetch('/api/admin/learning-resources', { credentials: 'include' })
        .then((response) => (response.ok ? response.json() : []))
        .then((data) => setAdminLearningResources(data))
        .catch(() => {});
    };
    loadLearningResources();
    const intervalId = window.setInterval(loadLearningResources, 15000);
    return () => window.clearInterval(intervalId);
  }, [adminPanel]);

  useEffect(() => {
    if (adminPanel !== 'public-chat' || !followAdminPublicChatRef.current) return;
    const chatContainer = adminPublicChatContainerRef.current;
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
  }, [adminPanel, adminPublicChatMessages.length]);

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    window.location.href = `${import.meta.env.BASE_URL}admin/login`;
  }

  async function changeAdminPassword(event) {
    event.preventDefault();
    setPasswordMessage('');
    setPasswordError('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('كلمتا المرور الجديدتان غير متطابقتين.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch('/api/admin/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'تعذر تغيير كلمة المرور.');
      setPasswordMessage(data.message);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordError(error.message || 'تعذر تغيير كلمة المرور.');
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleLearningResourceImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setLearningResourceError('');
    setLearningResourceSuccess('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLearningResourceError('اختر ملف صورة صالحاً.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setLearningResourceError('يجب ألا يتجاوز حجم الصورة الأصلية 12 ميغابايت.');
      return;
    }

    setIsProcessingLearningImage(true);
    try {
      const compressedImage = await compressPrivateChatImage(file);
      setLearningResourceImage(compressedImage);
    } catch (error) {
      setLearningResourceError(error.message || 'تعذر تجهيز الصورة.');
    } finally {
      setIsProcessingLearningImage(false);
    }
  }

  async function publishLearningResource(event) {
    event.preventDefault();
    setLearningResourceError('');
    setLearningResourceSuccess('');
    if (!learningResourceForm.description.trim()) {
      setLearningResourceError('أضف شرحاً للصورة أو الرابط.');
      return;
    }
    if (learningResourceForm.resourceType === 'image' && !learningResourceImage) {
      setLearningResourceError('اختر الصورة التي تريد إرسالها.');
      return;
    }
    if (learningResourceForm.resourceType === 'link' && !learningResourceForm.resourceUrl.trim()) {
      setLearningResourceError('أدخل الرابط الذي تريد إرساله.');
      return;
    }

    setIsPublishingLearningResource(true);
    try {
      const response = await fetch('/api/admin/learning-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          resourceType: learningResourceForm.resourceType,
          description: learningResourceForm.description,
          imageUrl: learningResourceForm.resourceType === 'image' ? learningResourceImage : null,
          resourceUrl: learningResourceForm.resourceType === 'link' ? learningResourceForm.resourceUrl : null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'تعذر نشر المحتوى.');
      setAdminLearningResources((current) => [data, ...current]);
      setLearningResourceForm({ resourceType: 'image', description: '', resourceUrl: '' });
      setLearningResourceImage('');
      setLearningResourceSuccess('تم نشر المحتوى للطلاب.');
    } catch (error) {
      setLearningResourceError(error.message || 'تعذر نشر المحتوى.');
    } finally {
      setIsPublishingLearningResource(false);
    }
  }

  async function deleteLearningResource(resource) {
    const resourceLabel = resource.resourceType === 'image' ? 'الصورة' : 'الرابط';
    if (!window.confirm(`هل تريد حذف ${resourceLabel} وشرحها من واجهة الطلاب نهائياً؟`)) return;
    setDeletingLearningResourceId(resource.id);
    try {
      const response = await fetch(`/api/admin/learning-resources/${resource.id}`, { method: 'DELETE', credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'تعذر حذف المحتوى.');
      setAdminLearningResources((current) => current.filter((item) => item.id !== resource.id));
      setLearningResourceSuccess('تم حذف المحتوى.');
    } catch (error) {
      setLearningResourceError(error.message || 'تعذر حذف المحتوى.');
    } finally {
      setDeletingLearningResourceId(null);
    }
  }

  async function sendAdminPublicChatMessage(event) {
    event.preventDefault();
    const message = adminPublicChatDraft.trim();
    if (!message) return;
    setPublicChatNotice('');
    setIsSendingPublicChatMessage(true);
    try {
      const response = await fetch('/api/public-chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'تعذر إرسال الرسالة.');
      setAdminPublicChatDraft('');
      setPublicChatNotice('تم إرسال رسالتك إلى الشات العام.');
      const updated = await fetch('/api/public-chat/messages', { credentials: 'include' });
      if (updated.ok) setAdminPublicChatMessages(await updated.json());
    } catch (error) {
      setPublicChatNotice(error.message || 'تعذر إرسال الرسالة.');
    } finally {
      setIsSendingPublicChatMessage(false);
    }
  }

  async function deletePublicChatMessage(message) {
    if (!window.confirm(`هل تريد حذف رسالة ${message.studentName} نهائياً؟`)) return;
    const response = await fetch(`/api/admin/public-chat/messages/${message.id}`, { method: 'DELETE', credentials: 'include' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setPublicChatNotice(data.message || 'تعذر حذف الرسالة.');
      return;
    }
    setAdminPublicChatMessages((current) => current.filter((item) => item.id !== message.id));
    setPublicChatNotice('تم حذف الرسالة.');
  }

  async function togglePublicChatBan(studentId, isBanned) {
    const reason = isBanned ? '' : window.prompt('سبب الحظر من الشات العام:') || '';
    if (!isBanned && !reason.trim()) return;
    const response = await fetch(`/api/admin/chat/${isBanned ? 'unmute' : 'mute'}/${studentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ durationMinutes: -1, reason }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setPublicChatNotice(data.message || 'تعذر تحديث الحظر.');
      return;
    }
    setPublicChatNotice(data.message || 'تم تحديث الحظر.');
    const updated = await fetch('/api/admin/chat/mutes', { credentials: 'include' });
    if (updated.ok) setPublicChatMutes(await updated.json());
  }

  async function addSubject(e) {
    e.preventDefault();
    const res = await fetch('/api/admin/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(subjectForm),
    });
    if (res.ok) {
      setSubjectForm({ name: '', gradeId: 1, description: '' });
      const data = await fetch('/api/admin/subjects', { credentials: 'include' });
      setSubjects(await data.json());
      const statsRes = await fetch('/api/admin/dashboard', { credentials: 'include' });
      const payload = await statsRes.json();
      setStats(payload.stats || {});
    }
  }

  async function addUnit(e) {
    e.preventDefault();
    const res = await fetch('/api/admin/units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(unitForm),
    });
    if (res.ok) {
      setUnitForm({ subjectId: 1, name: '', description: '' });
      const data = await fetch('/api/admin/units', { credentials: 'include' });
      setUnits(await data.json());
    }
  }

  async function addLesson(e) {
    e.preventDefault();
    const res = await fetch('/api/admin/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(lessonForm),
    });
    if (res.ok) {
      setLessonForm({ unitId: 1, name: '', description: '' });
      const data = await fetch('/api/admin/lessons', { credentials: 'include' });
      setLessons(await data.json());
    }
  }

  async function addSection(e) {
    e.preventDefault();
    const res = await fetch('/api/admin/sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(sectionForm),
    });
    if (res.ok) {
      setSectionForm({ lessonId: sectionForm.lessonId, sectionType: 'text', title: '', content: '' });
    }
  }

  async function addExam(e) {
    e.preventDefault();
    const res = await fetch('/api/admin/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(examForm),
    });
    if (res.ok) {
      setExamForm({ title: '', description: '', imageUrl: '', resourceUrl: '', gradeId: 1, subjectId: 1, unitId: '', lessonId: '', totalMarks: 10 });
      const data = await fetch('/api/admin/exams', { credentials: 'include' });
      setExams(await data.json());
    }
  }

  function selectExamImage(e) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/') || file.size > 1500000) return;
    const reader = new FileReader();
    reader.onload = () => setExamForm((current) => ({ ...current, imageUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  async function addAnnouncement(e) {
    e.preventDefault();
    const res = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(announcementForm),
    });
    if (res.ok) {
      setAnnouncementForm({ title: '', content: '', imageUrl: '', targetGrade: '' });
      const data = await fetch('/api/admin/announcements', { credentials: 'include' });
      setAnnouncements(await data.json());
      const logs = await fetch('/api/admin/audit-logs', { credentials: 'include' });
      setAuditLogs(await logs.json());
    }
  }

  async function deleteAnnouncement(announcement) {
    if (!window.confirm(`هل أنت متأكد من حذف الإعلان «${announcement.title}»؟`)) return;

    setDeletingAnnouncementId(announcement.id);
    try {
      const res = await fetch(`/api/admin/announcements/${announcement.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(data.message || 'تعذر حذف الإعلان. حاول مرة أخرى.');
        return;
      }

      setAnnouncements((current) => current.filter((item) => item.id !== announcement.id));
      const logsRes = await fetch('/api/admin/audit-logs', { credentials: 'include' });
      if (logsRes.ok) setAuditLogs(await logsRes.json());
    } catch {
      window.alert('تعذر الاتصال بالخادم لحذف الإعلان.');
    } finally {
      setDeletingAnnouncementId(null);
    }
  }

  function selectAnnouncementImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 1500000) return;
    const reader = new FileReader();
    reader.onload = () => setAnnouncementForm((current) => ({ ...current, imageUrl: reader.result }));
    reader.readAsDataURL(file);
  }

  async function selectScheduleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScheduleUploadError('');
    setScheduleUploadSuccess('');
    if (!file.type.startsWith('image/')) {
      setScheduleUploadError('الملف المختار ليس صورة. اختر صورة بصيغة مدعومة.');
      e.target.value = '';
      return;
    }
    if (file.size > 12000000) {
      setScheduleUploadError('حجم الصورة كبير جداً (الحد الأقصى 12MB).');
      e.target.value = '';
      return;
    }

    try {
      const imageUrl = file.size <= 1400000
        ? await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('تعذرت قراءة الصورة. اخترها مرة أخرى.'));
          reader.readAsDataURL(file);
        })
        : await prepareWeeklyScheduleImage(file);
      setScheduleForm((current) => ({ ...current, imageUrl }));
    } catch (error) {
      setScheduleForm((current) => ({ ...current, imageUrl: '' }));
      setScheduleUploadError(error.message || 'تعذرت معالجة الصورة.');
      e.target.value = '';
    }
  }

  async function addWeeklySchedule(e) {
    e.preventDefault();
    setScheduleUploadError('');
    setScheduleUploadSuccess('');
    setIsSendingSchedule(true);
    try {
      const res = await fetch('/api/admin/weekly-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(scheduleForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          setScheduleUploadError('انتهت جلسة الدخول. سجّل الدخول مجدداً ثم أعد إرسال الجدول.');
          setUser(null);
          window.location.href = `${import.meta.env.BASE_URL}admin/login`;
          return;
        }
        setScheduleUploadError(data.message || (res.status === 413
          ? 'حجم الطلب كبير جداً. جرّب صورة أصغر.'
          : 'تعذر إرسال الجدول. تحقق من اتصالك وحاول مرة أخرى.'));
        return;
      }

      setScheduleForm({ studentIds: [], imageUrl: '', title: 'الجدول الأسبوعي' });
      const updated = await fetch('/api/admin/weekly-schedules', { credentials: 'include' });
      if (updated.ok) setWeeklySchedules(await updated.json());
      setScheduleUploadSuccess(data.message || 'تم إرسال الجدول بنجاح.');
    } catch {
      setScheduleUploadError('تعذر الاتصال بالخادم. تحقق من اتصالك وحاول مرة أخرى.');
    } finally {
      setIsSendingSchedule(false);
    }
  }

  async function deleteWeeklySchedule(schedule) {
    if (!window.confirm(`هل تريد حذف جدول «${schedule.title}» المرسل إلى ${schedule.studentName}؟`)) return;

    setDeletingWeeklyScheduleId(schedule.id);
    try {
      const res = await fetch(`/api/admin/weekly-schedules/${schedule.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(data.message || 'تعذر حذف الجدول. حاول مرة أخرى.');
        return;
      }
      setWeeklySchedules((current) => current.filter((item) => item.id !== schedule.id));
    } catch {
      window.alert('تعذر الاتصال بالخادم لحذف الجدول.');
    } finally {
      setDeletingWeeklyScheduleId(null);
    }
  }

  async function addEnrollment(e) {
    e.preventDefault();
    const res = await fetch('/api/admin/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(enrollmentForm),
    });
    if (res.ok) {
      setEnrollmentForm({ studentId: '', subjectId: '' });
      const updated = await fetch('/api/admin/enrollments', { credentials: 'include' });
      setEnrollments(await updated.json());
    }
  }

  async function addStudent(e) {
    e.preventDefault();
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(studentForm),
    });
    if (res.ok) {
      setStudentForm({ name: '', email: '', password: '', gradeId: '' });
      const updated = await fetch('/api/admin/students', { credentials: 'include' });
      setStudents(await updated.json());
    }
  }

  async function updateStudentProgress(studentId) {
    const predictedAverage = progressDrafts[studentId];
    const res = await fetch(`/api/admin/students/${studentId}/progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ predictedAverage }),
    });
    if (res.ok) {
      setProgressDrafts((current) => ({ ...current, [studentId]: '' }));
    }
  }

  async function toggleStudentBan(studentId, banned) {
    const reason = banned ? window.prompt('سبب التبنيد') || 'قرار إداري' : '';
    if (banned && !reason.trim()) return;
    const res = await fetch(`/api/admin/students/${studentId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ banned, reason }),
    });
    if (res.ok) {
      const updated = await fetch('/api/admin/students', { credentials: 'include' });
      setStudents(await updated.json());
    }
  }

  async function permanentlyDeleteStudent(student) {
    const confirmation = window.prompt(`هذا الإجراء نهائي ويحذف سجل الطالب وبياناته ورسائله. للتأكيد، اكتب البريد الإلكتروني التالي:\n${student.email}`);
    if (confirmation?.trim().toLocaleLowerCase() !== String(student.email).trim().toLocaleLowerCase()) return;

    setDeletingStudentId(student.id);
    try {
      const response = await fetch(`/api/admin/students/${student.id}`, { method: 'DELETE', credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        window.alert(data.message || 'تعذر حذف حساب الطالب.');
        return;
      }

      setStudents((current) => current.filter((item) => Number(item.id) !== Number(student.id)));
      setMessages((current) => current.filter((message) => Number(message.senderId) !== Number(student.id) && Number(message.recipientId) !== Number(student.id)));
      setActiveStudents((current) => current.filter((item) => Number(item.id) !== Number(student.id)));
      setSelectedStudentDetailsId((current) => Number(current) === Number(student.id) ? '' : current);
      setSelectedChatStudentId((current) => Number(current) === Number(student.id) ? '' : current);
      setScheduleForm((current) => ({ ...current, studentIds: current.studentIds.filter((id) => Number(id) !== Number(student.id)) }));
      window.alert(data.message || 'تم حذف حساب الطالب نهائياً.');
    } catch {
      window.alert('تعذر الاتصال بالخادم لحذف حساب الطالب.');
    } finally {
      setDeletingStudentId(null);
    }
  }

  async function addQuestion(e) {
    e.preventDefault();
    const answers = questionForm.answers.map((answer, index) => ({
      answerText: answer,
      isCorrect: index === Number(questionForm.correctIndex),
    }));
    const res = await fetch(`/api/admin/exams/${questionForm.examId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ questionText: questionForm.questionText, marks: questionForm.marks, answers }),
    });
    if (res.ok) {
      setQuestionForm({ examId: questionForm.examId, questionText: '', marks: 1, answers: ['', '', '', ''], correctIndex: 0 });
    }
  }

  async function promoteUser(id) {
    const res = await fetch(`/api/admin/promote/${id}`, { method: 'POST', credentials: 'include' });
    if (res.ok) {
      const studentsRes = await fetch('/api/admin/students', { credentials: 'include' });
      setStudents(await studentsRes.json());
    }
  }

  async function demoteAdmin(admin) {
    if (!window.confirm(`هل تريد إزالة صلاحيات الإدارة عن ${admin.name} وتحويل حسابه إلى طالب؟`)) return;
    const response = await fetch(`/api/admin/demote/${admin.id}`, { method: 'POST', credentials: 'include' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      window.alert(data.message || 'تعذر إزالة صلاحيات الأدمن.');
      return;
    }

    const [permissionsResponse, studentsResponse] = await Promise.all([
      fetch('/api/admin/permissions', { credentials: 'include' }),
      fetch('/api/admin/students', { credentials: 'include' }),
    ]);
    if (permissionsResponse.ok) setAdminPermissions(await permissionsResponse.json());
    if (studentsResponse.ok) setStudents(await studentsResponse.json());
    window.alert(data.message || 'تم تحويل الحساب إلى طالب.');
  }

  async function togglePermission(userId, permission, granted) {
    const res = await fetch(`/api/admin/permissions/${userId}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission, granted }),
    });
    if (res.ok) {
      const next = await fetch('/api/admin/permissions', { credentials: 'include' });
      setAdminPermissions(await next.json());
    }
  }

  async function replyToMessage(recipientId) {
    const message = window.prompt('اكتب رد الإدارة');
    if (!message || !message.trim()) return;
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ recipientId, message }),
    });
    if (res.ok) {
      const updated = await fetch('/api/messages', { credentials: 'include' });
      setMessages(await updated.json());
    }
  }

  async function selectAdminChatStudent(studentId) {
    setSelectedChatStudentId(String(studentId));
    if (!unreadStudentIds.has(Number(studentId))) return;
    const response = await fetch(`/api/admin/messages/read-conversation/${studentId}`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) return;
    setMessages((current) => current.map((message) => (
      Number(message.senderId) === Number(studentId)
      && Number(message.recipientId) === Number(user.id)
      ? { ...message, readStatus: 'read' }
      : message
    )));
  }

  function selectChatImage(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setChatImageError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setChatImageError('اختر ملف صورة صالحاً.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setChatImageError('حجم الصورة الأصلية يجب ألا يتجاوز 12 ميغابايت.');
      return;
    }

    setIsProcessingChatImage(true);
    compressPrivateChatImage(file)
      .then((imageUrl) => {
        setChatImageUrl(imageUrl);
        setChatImageError('');
      })
      .catch((error) => setChatImageError(error.message || 'تعذر تجهيز الصورة للإرسال.'))
      .finally(() => setIsProcessingChatImage(false));
  }

  async function sendAdminMessage(e) {
    e.preventDefault();
    if (isProcessingChatImage || isSendingPrivateMessage || (!chatMessageText.trim() && !chatImageUrl)) return;
    const recipients = messages.filter((message) => message.senderId !== user.id);
    const recipientId = Number(selectedChatStudentId) || recipients[0]?.senderId;
    if (!recipientId) return;
    setPrivateChatError('');
    setIsSendingPrivateMessage(true);
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ recipientId, message: chatMessageText, imageUrl: chatImageUrl || null }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `تعذر إرسال الرسالة (HTTP ${response.status}).`);
      setChatMessageText('');
      setChatImageUrl('');
      setChatImageError('');
      const updated = await fetch('/api/messages', { credentials: 'include' });
      if (updated.ok) setMessages(await updated.json());
    } catch (error) {
      setPrivateChatError(error.message || 'تعذر إرسال الرسالة أو الصورة. حاول مجدداً.');
    } finally {
      setIsSendingPrivateMessage(false);
    }
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-topbar">
        <div>
          <h1>Tawjihi Time</h1>
          <p>لوحة الإدارة · مرحباً {user.name}</p>
        </div>
        <div className="admin-topbar-actions">
          <span className="badge">{user.role}</span>
          <button className="danger" onClick={logout}>تسجيل الخروج</button>
        </div>
      </header>

      <nav className="admin-navigation" aria-label="أقسام لوحة الإدارة">
        {[
          ['students', '👥', 'الطلاب'],
          ['active', '●', 'النشطون الآن'],
          ['notes', '💬', 'الشات مع الطلاب'],
          ['public-chat', '🌐', 'الشات العام'],
          ['announcements', '📣', 'الإعلانات'],
          ['schedule', '📅', 'الجدول الأسبوعي'],
          ['learning-resources', '📝', 'المحتوى والاختبارات'],
          ['reports', '📊', 'النتائج والسجل'],
          ...(user.role === 'super_admin' ? [['permissions', '🔐', 'الصلاحيات']] : []),
          ['account', '🔑', 'أمان الحساب'],
        ].map(([panel, icon, label]) => (
          <button key={panel} type="button" className={`admin-nav-button ${adminPanel === panel ? 'active' : ''}`} aria-current={adminPanel === panel ? 'page' : undefined} onClick={() => setAdminPanel(panel)}>
            <span aria-hidden="true">{icon}</span>{label}
            {panel === 'notes' && unreadIncomingMessages.length > 0 && <span className="message-unread-count" aria-label={`${unreadIncomingMessages.length} رسالة غير مقروءة`}>{unreadIncomingMessages.length}</span>}
          </button>
        ))}
      </nav>

      <main className="admin-main">

        <section className={`card ${adminPanel === 'public-chat' ? '' : 'student-panel-hidden'}`} style={{ padding: 20, marginTop: 24 }}>
          <div className="chat-header">
            <div className="chat-avatar">◉</div>
            <div><strong>الشات العام</strong><span className="muted">متابعة رسائل الطلاب والإدارة وإدارتها</span></div>
          </div>
          <div ref={adminPublicChatContainerRef} onScroll={(event) => {
            const element = event.currentTarget;
            followAdminPublicChatRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
          }} className="chat-messages" style={{ minHeight: 280, maxHeight: 480, overflowY: 'auto', padding: 16 }}>
            {adminPublicChatMessages.length === 0 ? <div className="empty-state">لا توجد رسائل في الشات العام بعد.</div> : adminPublicChatMessages.map((message) => (
              <div key={message.id} className={`chat-message ${message.studentId === user.id ? 'mine' : 'theirs'}`}>
                <div className="chat-bubble">
                  <strong>{message.studentName}{message.authorRole !== 'student' ? ' · الإدارة' : ''}</strong>
                  <p>{message.message}</p>
                  {message.imageUrl && <img className="chat-image" src={message.imageUrl} alt="مرفق في الشات العام" />}
                  <span className="chat-time">{message.createdAt}</span>
                  <button type="button" className="danger" style={{ marginTop: 8, padding: '6px 10px' }} onClick={() => deletePublicChatMessage(message)}>حذف الرسالة</button>
                </div>
              </div>
            ))}
          </div>
          <form className="chat-composer" onSubmit={sendAdminPublicChatMessage}>
            <textarea rows="1" maxLength={4000} value={adminPublicChatDraft} onChange={(event) => setAdminPublicChatDraft(event.target.value)} placeholder="اكتب رسالة بصفتك الإدارة..." />
            <button type="submit" disabled={!adminPublicChatDraft.trim() || isSendingPublicChatMessage}>{isSendingPublicChatMessage ? 'جارٍ الإرسال...' : 'إرسال'}</button>
          </form>
          {publicChatNotice && <p role="status" className="muted" style={{ padding: '0 16px' }}>{publicChatNotice}</p>}
          <div style={{ padding: 16, borderTop: '1px solid #e6edf7' }}>
            <h3>حظر الطلاب من الشات العام</h3>
            {(() => {
              const activeMutes = publicChatMutes.filter((mute) => Date.parse(String(mute.mutedUntil).replace(' ', 'T') + (String(mute.mutedUntil).includes('Z') ? '' : 'Z')) > Date.now());
              const bannedIds = new Set(activeMutes.map((mute) => Number(mute.studentId)));
              const studentsById = new Map(adminPublicChatMessages.filter((message) => message.authorRole === 'student').map((message) => [Number(message.studentId), message]));
              activeMutes.forEach((mute) => {
                if (!studentsById.has(Number(mute.studentId))) studentsById.set(Number(mute.studentId), { studentId: mute.studentId, studentName: mute.studentName });
              });
              const studentsWithChat = [...studentsById.values()];
              return studentsWithChat.length ? studentsWithChat.map((student) => (
                <div key={student.studentId} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                  <span><strong>{student.studentName}</strong> {bannedIds.has(Number(student.studentId)) && <small className="muted">(محظور)</small>}</span>
                  <button type="button" className={bannedIds.has(Number(student.studentId)) ? 'secondary' : 'danger'} onClick={() => togglePublicChatBan(student.studentId, bannedIds.has(Number(student.studentId)))}>
                    {bannedIds.has(Number(student.studentId)) ? 'إلغاء الحظر' : 'حظر دائم من الشات'}
                  </button>
                </div>
              )) : <div className="empty-state">سيظهر الطلاب هنا بعد إرسالهم رسالة في الشات.</div>;
            })()}
          </div>
        </section>

        <section className={`learning-admin-panel ${adminPanel === 'learning-resources' ? '' : 'student-panel-hidden'}`}>
          <div className="card learning-resource-form-card">
            <h2>إرسال محتوى واختبارات للطلاب</h2>
            <p className="muted">أرفق صورة تعليمية أو أضف رابطاً، ثم اكتب شرحاً ليظهر للطلاب في قسم المحتوى والاختبارات.</p>
            <form onSubmit={publishLearningResource}>
              <div className="form-group">
                <label htmlFor="learning-resource-type">نوع المحتوى</label>
                <select id="learning-resource-type" value={learningResourceForm.resourceType} onChange={(event) => {
                  setLearningResourceForm((current) => ({ ...current, resourceType: event.target.value, resourceUrl: '' }));
                  setLearningResourceImage('');
                  setLearningResourceError('');
                  setLearningResourceSuccess('');
                }}>
                  <option value="image">إرسال صورة</option>
                  <option value="link">إرسال رابط</option>
                </select>
              </div>
              {learningResourceForm.resourceType === 'image' ? (
                <div className="form-group">
                  <label htmlFor="learning-resource-image">الصورة</label>
                  <input id="learning-resource-image" type="file" accept="image/*" onChange={handleLearningResourceImage} disabled={isProcessingLearningImage || isPublishingLearningResource} />
                  {isProcessingLearningImage && <p className="muted">جارٍ ضغط الصورة وتجهيزها...</p>}
                  {learningResourceImage && <img className="learning-resource-preview" src={learningResourceImage} alt="معاينة الصورة التعليمية" />}
                  {learningResourceImage && <button type="button" className="secondary" onClick={() => setLearningResourceImage('')}>إزالة الصورة</button>}
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="learning-resource-url">الرابط</label>
                  <input id="learning-resource-url" type="url" value={learningResourceForm.resourceUrl} onChange={(event) => setLearningResourceForm((current) => ({ ...current, resourceUrl: event.target.value }))} placeholder="https://..." />
                </div>
              )}
              <div className="form-group">
                <label htmlFor="learning-resource-description">شرح الصورة أو الرابط</label>
                <textarea id="learning-resource-description" rows="4" maxLength={2000} value={learningResourceForm.description} onChange={(event) => setLearningResourceForm((current) => ({ ...current, description: event.target.value }))} placeholder="اكتب شرحاً يساعد الطلاب على فهم هذا المحتوى..." />
              </div>
              {learningResourceError && <p className="form-error" role="alert">{learningResourceError}</p>}
              {learningResourceSuccess && <p className="form-success" role="status">{learningResourceSuccess}</p>}
              <button type="submit" disabled={isProcessingLearningImage || isPublishingLearningResource}>{isPublishingLearningResource ? 'جارٍ النشر...' : 'إرسال للطلاب'}</button>
            </form>
          </div>

          <div className="card learning-resource-list-card">
            <div className="learning-resources-heading">
              <h3>المحتوى المنشور للطلاب</h3>
              <span className="muted">{filteredAdminLearningResources.length} من {adminLearningResources.length}</span>
            </div>
            <input
              className="learning-resource-search"
              type="search"
              value={adminLearningResourceSearch}
              onChange={(event) => setAdminLearningResourceSearch(event.target.value)}
              placeholder="ابحث بالشرح أو الرابط أو النوع..."
              aria-label="البحث في المحتوى المنشور"
            />
            {adminLearningResources.length === 0 ? <div className="empty-state">لم يتم نشر أي محتوى بعد.</div> : (
              filteredAdminLearningResources.length === 0 ? <div className="empty-state">لا يوجد محتوى يطابق بحثك.</div> : <div className="learning-resource-grid">
                {filteredAdminLearningResources.map((resource) => (
                  <article key={resource.id} className="learning-resource-card">
                    <div className="learning-resource-card-heading">
                      <span className="badge">{resource.resourceType === 'image' ? 'صورة تعليمية' : 'رابط تعليمي'}</span>
                      <time className="muted">{resource.createdAt}</time>
                    </div>
                    <p>{resource.description}</p>
                    {resource.imageUrl && <img className="learning-resource-image" src={resource.imageUrl} alt={resource.description} />}
                    {resource.resourceUrl && <a className="learning-resource-link" href={resource.resourceUrl} target="_blank" rel="noopener noreferrer">معاينة الرابط ↗</a>}
                    <button type="button" className="danger" disabled={deletingLearningResourceId === resource.id} onClick={() => deleteLearningResource(resource)}>{deletingLearningResourceId === resource.id ? 'جارٍ الحذف...' : resource.resourceType === 'image' ? 'حذف الصورة للطلاب' : 'حذف الرابط للطلاب'}</button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className={`card ${adminPanel === 'account' ? '' : 'student-panel-hidden'}`} style={{ padding: 20, marginTop: 24 }}>
          <h3>تغيير كلمة مرور الإدارة</h3>
          <p className="muted">استخدم كلمة مرور فريدة لا تقل عن 14 حرفاً قبل مشاركة رابط الموقع.</p>
          <form onSubmit={changeAdminPassword} className="form-grid">
            <div className="form-group">
              <label htmlFor="current-admin-password">كلمة المرور الحالية</label>
              <input id="current-admin-password" type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} required />
            </div>
            <div className="form-group">
              <label htmlFor="new-admin-password">كلمة المرور الجديدة</label>
              <input id="new-admin-password" type="password" autoComplete="new-password" minLength={14} value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} required />
            </div>
            <div className="form-group">
              <label htmlFor="confirm-admin-password">تأكيد كلمة المرور الجديدة</label>
              <input id="confirm-admin-password" type="password" autoComplete="new-password" minLength={14} value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} required />
            </div>
            {passwordError && <p role="alert" className="error-message">{passwordError}</p>}
            {passwordMessage && <p role="status" className="success-message">{passwordMessage}</p>}
            <button type="submit" disabled={isChangingPassword}>{isChangingPassword ? 'جارٍ الحفظ...' : 'تغيير كلمة المرور'}</button>
          </form>
        </section>

        <div className={adminPanel !== 'schedule' ? 'student-panel-hidden' : 'schedule-admin-panel'}>
          <section className="schedule-browser">
            {!selectedScheduleStudent ? (
              <div className="card schedule-history-browser">
                <div className="schedule-directory-header">
                  <div>
                    <h3>اختر طالباً</h3>
                    <p className="muted">اضغط على الطالب لعرض جميع الجداول الأسبوعية التي أُرسلت إليه.</p>
                  </div>
                </div>
                <input
                  type="search"
                  value={scheduleHistorySearch}
                  onChange={(event) => setScheduleHistorySearch(event.target.value)}
                  placeholder="ابحث عن طالب بالاسم أو البريد الإلكتروني..."
                  aria-label="البحث عن طالب لعرض جداوله الأسبوعية"
                />
                {scheduleHistoryStudents.length === 0 ? (
                  <div className="empty-state">{scheduleHistorySearchTerm ? 'لا يوجد طالب مطابق للبحث.' : 'لا يوجد طلاب مسجلون.'}</div>
                ) : (
                  <div className="schedule-student-directory">
                    {scheduleHistoryStudents.map((student) => {
                      const scheduleCount = weeklySchedules.filter((schedule) => schedule.studentId === student.id).length;
                      return (
                        <button key={student.id} type="button" className="schedule-student-card" onClick={() => setScheduleHistoryStudentId(String(student.id))}>
                          <span className="schedule-student-avatar">{student.name?.charAt(0) || 'ط'}</span>
                          <span className="schedule-student-details"><strong>{student.name}</strong><small>{student.email}</small></span>
                          <span className="schedule-student-count">{scheduleCount} جدول</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <section className="card schedule-history-browser">
                <div className="schedule-directory-header">
                  <div>
                    <h3>جداول {selectedScheduleStudent.name}</h3>
                    <p className="muted">{selectedScheduleStudent.email}</p>
                  </div>
                  <button type="button" className="secondary" onClick={() => setScheduleHistoryStudentId('')}>العودة إلى قائمة الطلاب</button>
                </div>
                {visibleWeeklySchedules.length === 0 ? (
                  <div className="empty-state">لم تُرسل جداول لهذا الطالب بعد.</div>
                ) : (
                  <div className="schedule-history-list">
                    {visibleWeeklySchedules.map((schedule) => (
                      <article key={schedule.id} className="schedule-history-card">
                        <div className="schedule-history-heading">
                          <div>
                            <strong>{schedule.title}</strong>
                            <div className="muted">تاريخ الإرسال: {schedule.createdAt}</div>
                          </div>
                          <button type="button" className="danger" disabled={deletingWeeklyScheduleId === schedule.id} onClick={() => deleteWeeklySchedule(schedule)}>
                            {deletingWeeklyScheduleId === schedule.id ? 'جارٍ الحذف...' : 'حذف الجدول'}
                          </button>
                        </div>
                        <img className="admin-weekly-schedule-image" src={schedule.imageUrl} alt={`${schedule.title} للطالب ${selectedScheduleStudent.name}`} />
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </section>

          <section className="card schedule-upload-panel">
            <h3>إرسال جدول أسبوعي جديد</h3>
            <form onSubmit={addWeeklySchedule}>
              <div className="form-group">
                <label>عنوان الجدول</label>
                <input value={scheduleForm.title} onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label>اختر الطلاب</label>
                <div className="schedule-student-tools">
                  <input
                    type="search"
                    value={scheduleStudentSearch}
                    onChange={(event) => setScheduleStudentSearch(event.target.value)}
                    placeholder="ابحث عن طالب بالاسم أو البريد الإلكتروني..."
                    aria-label="البحث عن طالب لإرسال الجدول الأسبوعي"
                  />
                  <span className="muted">تم اختيار {scheduleForm.studentIds.length} طالب</span>
                </div>
                <div className="student-check-list">
                  {scheduleStudents.length === 0 ? (
                    <div className="empty-state">{scheduleSearchTerm ? 'لا يوجد طالب مطابق للبحث.' : 'لا يوجد طلاب مسجلون.'}</div>
                  ) : scheduleStudents.map((student) => (
                    <label key={student.id} className="student-check-item">
                      <input
                        type="checkbox"
                        checked={scheduleForm.studentIds.includes(student.id)}
                        onChange={(e) => setScheduleForm((current) => ({
                          ...current,
                          studentIds: e.target.checked ? [...current.studentIds, student.id] : current.studentIds.filter((id) => id !== student.id),
                        }))}
                      />
                      <span>{student.name} <small>{student.email}</small></span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>صورة الجدول</label>
                <input required type="file" accept="image/*" onChange={selectScheduleImage} />
              </div>
              {scheduleForm.imageUrl && <img className="weekly-schedule-preview" src={scheduleForm.imageUrl} alt="معاينة الجدول الأسبوعي" />}
              {scheduleUploadError && <p className="form-error" role="alert">{scheduleUploadError}</p>}
              {scheduleUploadSuccess && <p className="form-success" role="status">{scheduleUploadSuccess}</p>}
              <button type="submit" disabled={isSendingSchedule || !scheduleForm.studentIds.length || !scheduleForm.imageUrl}>{isSendingSchedule ? 'جارٍ إرسال الجدول...' : 'إرسال الجدول للطلاب المحددين'}</button>
            </form>
          </section>
        </div>

        <div className={adminPanel === 'students' ? 'grid' : 'student-panel-hidden'}>
          <div className="card stat-card"><h3>إجمالي الطلاب</h3><strong>{stats.totalStudents || 0}</strong></div>
          <div className="card stat-card"><h3>الطلاب النشطون</h3><strong>{stats.activeStudents || 0}</strong></div>
          <div className="card stat-card"><h3>المواد</h3><strong>{stats.totalSubjects || 0}</strong></div>
          <div className="card stat-card"><h3>الاختبارات</h3><strong>{stats.totalExams || 0}</strong></div>
          <div className="card stat-card"><h3>رسائل غير مقروءة</h3><strong>{stats.unreadMessages || 0}</strong></div>
        </div>

        <div className={adminPanel !== 'active' ? 'student-panel-hidden' : 'card'} style={{ padding: 20, marginTop: 24 }}>
          <h3>الطلاب النشطون الآن</h3>
          {activeStudents.length === 0 ? <div className="empty-state">لا يوجد طلاب نشطون خلال آخر 15 دقيقة.</div> : (
            activeStudents.map((student) => <div key={student.id} style={{ padding: '10px 0', borderBottom: '1px solid #eee' }}><strong>● {student.name}</strong><span className="muted"> {student.gradeName || 'مرحلة غير محددة'} · آخر دخول {student.lastLoginAt}</span></div>)
          )}
        </div>

        <div className={`admin-two-column-layout ${adminPanel !== 'content' ? 'student-panel-hidden' : ''}`}>
          <div className="card" style={{ padding: 20 }}>
            <h3>إضافة مادة جديدة</h3>
            <form onSubmit={addSubject}>
              <div className="form-group">
                <label>اسم المادة</label>
                <input value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>المرحلة</label>
                <input value={subjectForm.gradeId} onChange={(e) => setSubjectForm({ ...subjectForm, gradeId: e.target.value })} />
              </div>
              <div className="form-group">
                <label>الوصف</label>
                <textarea rows="3" value={subjectForm.description} onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })} />
              </div>
              <button type="submit">حفظ المادة</button>
            </form>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3>المواد الأخيرة</h3>
            {subjects.length === 0 ? <div className="empty-state">لا توجد مواد بعد.</div> : (
              <ul>
                {subjects.map((subject) => <li key={subject.id}>{subject.name}</li>)}
              </ul>
            )}
          </div>
        </div>

        <div className={`admin-two-column-layout ${adminPanel !== 'content' ? 'student-panel-hidden' : ''}`}>
          <div className="card" style={{ padding: 20 }}>
            <h3>إضافة وحدة</h3>
            <form onSubmit={addUnit}>
              <div className="form-group">
                <label>رقم المادة</label>
                <input value={unitForm.subjectId} onChange={(e) => setUnitForm({ ...unitForm, subjectId: e.target.value })} />
              </div>
              <div className="form-group">
                <label>اسم الوحدة</label>
                <input value={unitForm.name} onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>الوصف</label>
                <textarea rows="3" value={unitForm.description} onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })} />
              </div>
              <button type="submit">حفظ الوحدة</button>
            </form>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3>الوحدات الأخيرة</h3>
            {units.length === 0 ? <div className="empty-state">لا توجد وحدات بعد.</div> : (
              <ul>
                {units.map((unit) => <li key={unit.id}>{unit.name}</li>)}
              </ul>
            )}
          </div>
        </div>

        <div className={`admin-two-column-layout ${adminPanel !== 'content' ? 'student-panel-hidden' : ''}`}>
          <div className="card" style={{ padding: 20 }}>
            <h3>إضافة درس</h3>
            <form onSubmit={addLesson}>
              <div className="form-group">
                <label>رقم الوحدة</label>
                <input value={lessonForm.unitId} onChange={(e) => setLessonForm({ ...lessonForm, unitId: e.target.value })} />
              </div>
              <div className="form-group">
                <label>اسم الدرس</label>
                <input value={lessonForm.name} onChange={(e) => setLessonForm({ ...lessonForm, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>الوصف</label>
                <textarea rows="3" value={lessonForm.description} onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} />
              </div>
              <button type="submit">حفظ الدرس</button>
            </form>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3>الدروس الأخيرة</h3>
            {lessons.length === 0 ? <div className="empty-state">لا توجد دروس بعد.</div> : (
              <ul>
                {lessons.map((lesson) => <li key={lesson.id}>{lesson.name}</li>)}
              </ul>
            )}
          </div>
        </div>

        <div className={adminPanel !== 'content' ? 'student-panel-hidden' : 'card'} style={{ padding: 20, marginTop: 24 }}>
          <h3>إنشاء اختبار</h3>
          <form onSubmit={addExam}>
            <div className="form-grid">
              <div className="form-group">
                <label>عنوان الاختبار</label>
                <input value={examForm.title} onChange={(e) => setExamForm({ ...examForm, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label>إرفاق صورة</label>
                <input type="file" accept="image/*" onChange={selectExamImage} />
              </div>
              <div className="form-group">
                <label>رابط خارجي</label>
                <input type="url" value={examForm.resourceUrl} onChange={(e) => setExamForm({ ...examForm, resourceUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div className="form-group">
                <label>المرحلة</label>
                <input value={examForm.gradeId} onChange={(e) => setExamForm({ ...examForm, gradeId: e.target.value })} />
              </div>
              <div className="form-group">
                <label>المادة</label>
                <input value={examForm.subjectId} onChange={(e) => setExamForm({ ...examForm, subjectId: e.target.value })} />
              </div>
              <div className="form-group">
                <label>الوحدة</label>
                <input value={examForm.unitId} onChange={(e) => setExamForm({ ...examForm, unitId: e.target.value })} />
              </div>
              <div className="form-group">
                <label>الدرس</label>
                <input value={examForm.lessonId} onChange={(e) => setExamForm({ ...examForm, lessonId: e.target.value })} />
              </div>
              <div className="form-group">
                <label>إجمالي العلامات</label>
                <input type="number" value={examForm.totalMarks} onChange={(e) => setExamForm({ ...examForm, totalMarks: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>الوصف</label>
              <textarea rows="3" value={examForm.description} onChange={(e) => setExamForm({ ...examForm, description: e.target.value })} />
            </div>
            <button type="submit">حفظ الاختبار</button>
          </form>
        </div>

        <div className={adminPanel === 'content' ? 'card' : 'student-panel-hidden'} style={{ padding: 20, marginTop: 24 }}>
          <h3>إضافة محتوى للدرس</h3>
          <form onSubmit={addSection}>
            <div className="form-grid">
              <div className="form-group">
                <label>الدرس</label>
                <select value={sectionForm.lessonId} onChange={(e) => setSectionForm({ ...sectionForm, lessonId: e.target.value })}>
                  <option value="">اختر درساً</option>
                  {lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>نوع المحتوى</label>
                <select value={sectionForm.sectionType} onChange={(e) => setSectionForm({ ...sectionForm, sectionType: e.target.value })}>
                  <option value="text">نص</option>
                  <option value="video">فيديو</option>
                  <option value="file">ملف</option>
                  <option value="summary">ملخص</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>العنوان</label>
              <input value={sectionForm.title} onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label>المحتوى أو الرابط</label>
              <textarea rows="5" value={sectionForm.content} onChange={(e) => setSectionForm({ ...sectionForm, content: e.target.value })} />
            </div>
            <button type="submit" disabled={!sectionForm.lessonId}>حفظ المحتوى</button>
          </form>
        </div>

        <div className={adminPanel === 'content' ? 'card' : 'student-panel-hidden'} style={{ padding: 20, marginTop: 24 }}>
          <h3>الاختبارات</h3>
          {exams.length === 0 ? <div className="empty-state">لا توجد اختبارات بعد.</div> : (
            <ul>
              {exams.map((exam) => <li key={exam.id}>{exam.title}</li>)}
            </ul>
          )}
        </div>

        <div className={adminPanel === 'content' ? 'card' : 'student-panel-hidden'} style={{ padding: 20, marginTop: 24 }}>
          <h3>إضافة سؤال لاختبار</h3>
          <form onSubmit={addQuestion}>
            <div className="form-grid">
              <div className="form-group">
                <label>الاختبار</label>
                <select value={questionForm.examId} onChange={(e) => setQuestionForm({ ...questionForm, examId: e.target.value })}>
                  <option value="">اختر اختباراً</option>
                  {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>العلامات</label>
                <input type="number" min="1" value={questionForm.marks} onChange={(e) => setQuestionForm({ ...questionForm, marks: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>نص السؤال</label>
              <textarea rows="3" value={questionForm.questionText} onChange={(e) => setQuestionForm({ ...questionForm, questionText: e.target.value })} />
            </div>
            {questionForm.answers.map((answer, index) => (
              <div className="form-group" key={index}>
                <label>الإجابة {index + 1}</label>
                <input value={answer} onChange={(e) => setQuestionForm({ ...questionForm, answers: questionForm.answers.map((item, itemIndex) => itemIndex === index ? e.target.value : item) })} />
              </div>
            ))}
            <div className="form-group">
              <label>الإجابة الصحيحة</label>
              <select value={questionForm.correctIndex} onChange={(e) => setQuestionForm({ ...questionForm, correctIndex: e.target.value })}>
                {questionForm.answers.map((_, index) => <option key={index} value={index}>الإجابة {index + 1}</option>)}
              </select>
            </div>
            <button type="submit" disabled={!questionForm.examId}>حفظ السؤال</button>
          </form>
        </div>

        <div className={`admin-two-column-layout ${adminPanel !== 'announcements' ? 'student-panel-hidden' : ''}`}>
          <div className="card" style={{ padding: 20 }}>
            <h3>إضافة إعلان</h3>
            <form onSubmit={addAnnouncement}>
              <div className="form-group">
                <label>العنوان</label>
                <input value={announcementForm.title} onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label>المرحلة المستهدفة</label>
                <select value={announcementForm.targetGrade} onChange={(e) => setAnnouncementForm({ ...announcementForm, targetGrade: e.target.value })}>
                  <option value="">الجميع</option>
                  {grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>المحتوى</label>
                <textarea rows="4" value={announcementForm.content} onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })} />
              </div>
              <div className="form-group">
                <label>إرفاق صورة (اختياري)</label>
                <input type="file" accept="image/*" onChange={selectAnnouncementImage} />
              </div>
              <button type="submit">نشر الإعلان</button>
            </form>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3>الإعلانات المنشورة</h3>
            {announcements.length === 0 ? <div className="empty-state">لا توجد إعلانات.</div> : announcements.map((announcement) => (
              <div key={announcement.id} style={{ padding: '10px 0', borderBottom: '1px solid #eee' }}>
                <strong>{announcement.title}</strong>
                <p>{announcement.content}</p>
                {announcement.imageUrl && <img src={announcement.imageUrl} alt={announcement.title} style={{ maxWidth: '100%', maxHeight: 180, objectFit: 'cover' }} />}
                <div className="row" style={{ marginTop: 10 }}>
                  <button type="button" className="danger" disabled={deletingAnnouncementId === announcement.id} onClick={() => deleteAnnouncement(announcement)}>
                    {deletingAnnouncementId === announcement.id ? 'جارٍ الحذف...' : 'حذف الإعلان'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={adminPanel === 'reports' ? 'card' : 'student-panel-hidden'} style={{ padding: 20, marginTop: 24 }}>
          <h3>سجل العمليات</h3>
          {auditLogs.length === 0 ? <div className="empty-state">لا توجد عمليات مسجلة.</div> : (
            <table className="table">
              <thead><tr><th>المنفذ</th><th>العملية</th><th>النوع</th><th>التاريخ</th></tr></thead>
              <tbody>{auditLogs.slice(0, 12).map((log) => (
                <tr key={log.id}><td>{log.actorName || 'النظام'}</td><td>{log.action}</td><td>{log.entityType}</td><td>{log.createdAt}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>

        <div className={adminPanel === 'students' ? 'card' : 'student-panel-hidden'} style={{ padding: 20, marginTop: 24 }}>
          <h3>إسناد مادة لطالب</h3>
          <form onSubmit={addEnrollment}>
            <div className="form-grid">
              <div className="form-group">
                <label>الطالب</label>
                <select value={enrollmentForm.studentId} onChange={(e) => setEnrollmentForm({ ...enrollmentForm, studentId: e.target.value })}>
                  <option value="">اختر طالباً</option>
                  {students.filter((student) => student.role === 'student').map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>المادة</label>
                <select value={enrollmentForm.subjectId} onChange={(e) => setEnrollmentForm({ ...enrollmentForm, subjectId: e.target.value })}>
                  <option value="">اختر مادة</option>
                  {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" disabled={!enrollmentForm.studentId || !enrollmentForm.subjectId}>إسناد المادة</button>
          </form>
          {enrollments.length > 0 && <div style={{ marginTop: 16 }}>
            {enrollments.slice(0, 10).map((enrollment) => <div key={enrollment.id} className="muted">{enrollment.studentName} ← {enrollment.subjectName}</div>)}
          </div>}
        </div>

        <div className={adminPanel !== 'students' ? 'student-panel-hidden' : 'card'} style={{ padding: 20, marginTop: 24 }}>
          <div className="student-management-header">
            <h3>الطلاب</h3>
            <span className="muted">عرض {filteredManagementStudents.length} من {students.length}</span>
          </div>
          <input
            className="student-management-search"
            type="search"
            value={studentManagementSearch}
            onChange={(event) => setStudentManagementSearch(event.target.value)}
            placeholder="ابحث عن طالب بالاسم أو البريد الإلكتروني..."
            aria-label="ابحث عن طالب بالاسم أو البريد الإلكتروني"
          />
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>البريد</th>
                <th>الدور</th>
                <th>توقع المعدل</th>
                <th>الحالة</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {filteredManagementStudents.length === 0 ? (
                <tr><td colSpan="6"><div className="empty-state">{studentManagementSearchTerm ? 'لا يوجد طالب مطابق للبحث.' : 'لا يوجد طلاب مسجلون.'}</div></td></tr>
              ) : filteredManagementStudents.map((student) => (
                <tr key={student.id}>
                  <td>{student.name}</td>
                  <td>{student.email}</td>
                  <td>{student.role}<div className="muted">{student.gradeName || 'مرحلة غير محددة'}</div></td>
                  <td>
                    {student.role === 'student' && (
                      <div className="row">
                        <span title="الستريك اليومي">🔥 {student.streak || 0}</span>
                        <span title="المعدل المتوقع">{Number(student.predictedAverage || 0).toFixed(1)}%</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="0 - 100"
                          value={progressDrafts[student.id] || ''}
                          onChange={(e) => setProgressDrafts({ ...progressDrafts, [student.id]: e.target.value })}
                          style={{ width: 110, marginTop: 0 }}
                        />
                        <button type="button" onClick={() => updateStudentProgress(student.id)}>حفظ</button>
                      </div>
                    )}
                  </td>
                  <td>
                    {student.role === 'student' ? (
                      <span className={`badge ${student.accountStatus === 'banned' ? 'banned-badge' : ''}`}>
                        {student.accountStatus === 'banned' ? `مبند: ${student.bannedReason || 'بدون سبب'}` : 'نشط'}
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    {student.role === 'student' && (
                      <div className="row">
                        <button type="button" onClick={() => toggleStudentBan(student.id, student.accountStatus !== 'banned')} className={student.accountStatus === 'banned' ? 'secondary' : 'danger'}>
                          {student.accountStatus === 'banned' ? 'إلغاء التبنيد' : 'تبنيد'}
                        </button>
                        <button type="button" className="secondary" onClick={() => setSelectedStudentDetailsId(String(student.id))}>عرض الملف</button>
                        <button type="button" onClick={() => { setSelectedChatStudentId(String(student.id)); setAdminPanel('notes'); }}>فتح الشات</button>
                        <button type="button" onClick={() => promoteUser(student.id)}>ترقية إلى مدير</button>
                        <button type="button" className="danger" disabled={deletingStudentId === student.id} onClick={() => permanentlyDeleteStudent(student)}>{deletingStudentId === student.id ? 'جارٍ الحذف...' : 'حذف نهائي'}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {adminPanel === 'students' && selectedStudentDetailsId && (() => {
          const selectedStudent = students.find((student) => student.id === Number(selectedStudentDetailsId));
          if (!selectedStudent) return null;
          return (
            <div className="card student-profile-card" style={{ marginTop: 20, padding: 20 }}>
              <div className="toolbar">
                <div>
                  <h3>ملف الطالب: {selectedStudent.name}</h3>
                  <p className="muted">{selectedStudent.email}</p>
                </div>
                <button type="button" className="secondary" onClick={() => setSelectedStudentDetailsId('')}>إغلاق الملف</button>
              </div>
              <div className="student-profile-summary">
                <div><span className="muted">المرحلة الدراسية</span><strong>{selectedStudent.gradeName || selectedStudent.academicStageName || 'غير محددة'}</strong></div>
                {selectedStudent.academicFieldName && <div><span className="muted">الفرع</span><strong>{selectedStudent.academicFieldName}</strong></div>}
                <div><span className="muted">الستريك اليومي</span><strong>🔥 {selectedStudent.streak || 0}</strong></div>
                <div><span className="muted">المعدل المتوقع</span><strong>{Number(selectedStudent.predictedAverage || 0).toFixed(1)}%</strong></div>
              </div>
              <h4>المواد التي اختارها الطالب</h4>
              {selectedStudent.subjects?.length ? (
                <div className="student-subject-chips">
                  {selectedStudent.subjects.map((subject) => <span className="badge" key={subject.id}>{subject.name}</span>)}
                </div>
              ) : <div className="empty-state">لم يختر الطالب مواده بعد.</div>}
            </div>
          );
        })()}

        <div className={adminPanel !== 'students' ? 'student-panel-hidden' : 'card'} style={{ padding: 20, marginTop: 24 }}>
          <h3>إضافة طالب جديد</h3>
          <form onSubmit={addStudent}>
            <div className="form-grid">
              <div className="form-group">
                <label>اسم الطالب</label>
                <input required value={studentForm.name} onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>البريد الإلكتروني</label>
                <input required type="email" value={studentForm.email} onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>كلمة المرور</label>
                <input required minLength="8" type="password" value={studentForm.password} onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })} />
              </div>
              <div className="form-group">
                <label>المرحلة</label>
                <select value={studentForm.gradeId} onChange={(e) => setStudentForm({ ...studentForm, gradeId: e.target.value })}>
                  <option value="">غير محددة</option>
                  {grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
                </select>
              </div>
            </div>
            <button type="submit">إنشاء حساب الطالب</button>
          </form>
        </div>

        <div className={adminPanel !== 'notes' ? 'student-panel-hidden' : 'card chat-shell'} style={{ padding: 0, marginTop: 24 }}>
          <div className="chat-header">
            <div className="chat-avatar">◉</div>
            <div><strong>{students.find((student) => student.id === Number(selectedChatStudentId))?.name || 'رسائل الطلاب'}</strong><span className="muted">محادثة خاصة مع طالب واحد</span></div>
          </div>
          <div className="chat-student-search">
            <input
              type="search"
              value={chatStudentSearch}
              onChange={(event) => setChatStudentSearch(event.target.value)}
              placeholder="ابحث عن طالب بالاسم أو البريد الإلكتروني..."
              aria-label="البحث عن طالب بالاسم أو البريد الإلكتروني"
            />
          </div>
          <div className="chat-student-list">
            {chatStudents.length === 0 ? (
              <div className="empty-state">{searchTerm ? 'لا يوجد طالب بهذا الاسم أو البريد الإلكتروني.' : 'لا يوجد طلاب مسجلون.'}</div>
            ) : chatStudents.map((student) => (
              <button key={student.id} type="button" className={`${Number(selectedChatStudentId) === student.id ? 'selected' : ''} ${unreadStudentIds.has(Number(student.id)) ? 'has-unread-message' : ''}`} onClick={() => selectAdminChatStudent(student.id)}>
                <span className="chat-student-avatar">{student.name?.charAt(0) || 'ط'}</span>
                <span><strong>{student.name}</strong><small>{student.email}</small></span>
                {unreadStudentIds.has(Number(student.id)) && <span className="message-unread-badge"><span className="message-unread-dot" />رسالة جديدة</span>}
              </button>
            ))}
          </div>
          <div ref={adminPrivateChatRef} className="chat-messages">
            {messages.filter((message) => selectedChatStudentId && (message.senderId === Number(selectedChatStudentId) || message.recipientId === Number(selectedChatStudentId))).length === 0 && <div className="empty-state">اختر طالباً لعرض محادثته.</div>}
            {[...messages].filter((message) => selectedChatStudentId && (message.senderId === Number(selectedChatStudentId) || message.recipientId === Number(selectedChatStudentId))).reverse().map((message) => (
              <div key={message.id} className={`chat-message ${message.senderId === user.id ? 'mine' : 'theirs'}`}>
                <div className="chat-bubble">
                  <p>{message.message}</p>
                  {message.imageUrl && <img className="chat-image" src={message.imageUrl} alt="مرفق من الطالب" />}
                  <span className="chat-time">{message.senderId === user.id ? 'أنت' : message.senderName} · {message.createdAt}</span>
                  {message.senderId !== user.id && <div style={{ marginTop: 8 }}><button type="button" onClick={() => replyToMessage(message.senderId)}>رد</button></div>}
                </div>
              </div>
            ))}
          </div>
          <form className="chat-composer" onSubmit={sendAdminMessage}>
            <textarea rows="1" value={chatMessageText} onChange={(e) => setChatMessageText(e.target.value)} placeholder="اكتب رد الإدارة..." />
            <label className="chat-attach">
              <span>{isProcessingChatImage ? 'جارٍ تجهيز الصورة...' : 'إرفاق صورة'}</span>
              <input type="file" accept="image/*" onChange={selectChatImage} disabled={isProcessingChatImage || isSendingPrivateMessage} />
            </label>
            <button type="submit" disabled={isProcessingChatImage || isSendingPrivateMessage || (!chatMessageText.trim() && !chatImageUrl)}>{isSendingPrivateMessage ? 'جارٍ الإرسال...' : 'إرسال'}</button>
          </form>
          {chatImageUrl && <div className="chat-attachment-preview"><img src={chatImageUrl} alt="معاينة الصورة المرفقة" /><button type="button" className="secondary" onClick={() => setChatImageUrl('')}>إزالة الصورة</button></div>}
          {chatImageError && <p className="form-error" role="alert" style={{ padding: '0 20px' }}>{chatImageError}</p>}
          {privateChatError && <p className="form-error" role="alert" style={{ padding: '0 20px' }}>{privateChatError}</p>}
        </div>

        <div className={adminPanel === 'reports' ? 'card' : 'student-panel-hidden'} style={{ padding: 20, marginTop: 24 }}>
          <h3>نتائج الطلاب</h3>
          {results.length === 0 ? <div className="empty-state">لا توجد نتائج مسجلة.</div> : (
            <table className="table">
              <thead><tr><th>الطالب</th><th>الاختبار</th><th>النتيجة</th><th>النسبة</th><th>التاريخ</th></tr></thead>
              <tbody>{results.slice(0, 30).map((result) => (
                <tr key={result.id}>
                  <td>{result.studentName}</td>
                  <td>{result.examTitle}</td>
                  <td>{result.score} / {result.totalMarks}</td>
                  <td>{Math.round(result.percentage)}%</td>
                  <td>{result.createdAt}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>

        {user.role === 'super_admin' && (
          <div className={adminPanel === 'permissions' ? 'card' : 'student-panel-hidden'} style={{ padding: 20, marginTop: 24 }}>
            <h3>إدارة الصلاحيات</h3>
            {adminPermissions.admins.length === 0 ? <div className="empty-state">لا يوجد مديرون.</div> : (
              adminPermissions.admins.map((admin) => (
                <div key={admin.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <strong>{admin.name}</strong>
                    <span className="badge">{admin.role}</span>
                  </div>
                  {admin.role === 'admin' && <button type="button" className="danger" style={{ marginTop: 12 }} onClick={() => demoteAdmin(admin)}>إزالة من الإدارة وتحويله إلى طالب</button>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    {adminPermissions.permissions.map((permission) => {
                      const enabled = admin.permissions.includes(permission);
                      return (
                        <button
                          key={`${admin.id}-${permission}`}
                          className={enabled ? 'secondary' : ''}
                          type="button"
                          onClick={() => togglePermission(admin.id, permission, !enabled)}
                          style={{ padding: '8px 10px', fontSize: 12 }}
                        >
                          {permission} {enabled ? '✓' : '×'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
