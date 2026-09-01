import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';
import apiClient from '../utils/api';
import '../styles/chat.css';

export default function ChatPage() {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const isStudentPrivateView = user?.role === 'student' && (location.pathname === '/private-table' || location.pathname === '/messages');
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [schedules, setSchedules] = useState([]);

  useEffect(() => {
    fetchConversations();
    if (user?.role === 'student') {
      fetchAdmins();
      if (isStudentPrivateView) {
        fetchStudentSchedules();
      }
    }
  }, [user?.id, user?.role, isStudentPrivateView]);

  const fetchStudentSchedules = async () => {
    if (!user?.id) return;

    try {
      const response = await apiClient.get(`/students/${user.id}/schedules`);
      const receivedSchedules = response.data.schedules || [];
      setSchedules(receivedSchedules);
      if (receivedSchedules.length > 0) {
        await apiClient.patch('/notifications/read-related', {
          relatedEntityTypes: ['student_schedule'],
          relatedIds: receivedSchedules.map(schedule => schedule.id)
        });
          window.dispatchEvent(new Event('notifications-read'));
      }
    } catch (error) {
      console.error('Error fetching student schedules:', error);
      setSchedules([]);
    }
  };

  useEffect(() => {
    if (!isStudentPrivateView || conversations.length === 0) return;
    const firstAdminConversation = conversations.find(item => item.otherUser.role !== 'student');
    if (firstAdminConversation) {
      setSelectedConversation(firstAdminConversation);
    }
  }, [isStudentPrivateView, conversations]);

  useEffect(() => {
    const pendingStudentId = location.state?.autoChatStudentId;
    if (!pendingStudentId || !['admin', 'super_admin'].includes(user?.role)) return;

    const autoOpenChat = async () => {
      try {
        const response = await apiClient.get('/messages/list/all');
        const existingConversation = (response.data.conversations || []).find(
          conversation => conversation.otherUser.id === Number(pendingStudentId)
        );

        if (existingConversation) {
          setSelectedConversation(existingConversation);
          await fetchMessages(existingConversation.conversationId);
          navigate('/admin/messages', { replace: true, state: null });
          return;
        }

        await handleStartNewChat(
          {
            id: Number(pendingStudentId),
            name: location.state?.autoChatStudentName || 'طالب'
          },
          'student'
        );

        navigate('/admin/messages', { replace: true, state: null });
      } catch (error) {
        console.error('Error auto-opening chat:', error);
      }
    };

    autoOpenChat();
  }, [location.state?.autoChatStudentId, user?.role]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.conversationId);
      const interval = setInterval(() => fetchMessages(selectedConversation.conversationId), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedConversation]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/messages/list/all');
      setConversations(response.data.conversations || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      const response = await apiClient.get(`/messages/conversation/${conversationId}`);
      const receivedMessages = response.data.messages || [];
      setMessages(receivedMessages);
      const viewedMessageIds = receivedMessages
        .filter(message => message.sender_id !== user?.id)
        .map(message => message.id);
      if (viewedMessageIds.length > 0) {
        await apiClient.patch('/notifications/read-related', {
          relatedEntityTypes: ['private_message', 'message'],
          relatedIds: viewedMessageIds
        });
          window.dispatchEvent(new Event('notifications-read'));
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await apiClient.get(`/admin/students/list?perPage=100&search=${encodeURIComponent(studentSearch)}`);
      setStudents(response.data.students || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchAdmins = async () => {
    try {
      const response = await apiClient.get('/messages/admins');
      setAdmins(response.data.admins || []);
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!selectedConversation) return;

    const hasText = messageText.trim();
    const hasImage = !!selectedImage;

    if (!hasText && !hasImage) return;

    try {
      await apiClient.post('/messages', {
        message: hasText ? messageText : '',
        imageData: hasImage ? selectedImage : undefined,
        recipientId: selectedConversation.otherUser.id
      });
      setMessageText('');
      setSelectedImage(null);
      fetchMessages(selectedConversation.conversationId);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleStartNewChat = async (person, type = 'student') => {
    try {
      const greeting = type === 'student'
        ? `مرحباً ${person.name}، كيف يمكنني مساعدتك؟`
        : `مرحباً ${person.name}، أحتاج المساعدة.`;

      const response = await apiClient.post('/messages', {
        message: greeting,
        recipientId: person.id
      });

      const conversationId = response.data.conversationId;
      const newConversation = {
        conversationId,
        otherUser: {
          id: person.id,
          name: person.name,
          role: type === 'student' ? 'student' : 'admin',
          profilePicture: person.profile_picture || null,
        }
      };

      setShowNewChat(false);
      setSelectedStudent(null);
      setSelectedConversation(newConversation);
      await fetchConversations();
      await fetchMessages(conversationId);
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  };

  if (loading && !isStudentPrivateView) {
    return <div className="chat-loading">جاري تحميل الرسائل...</div>;
  }

  const pageTitle = isStudentPrivateView ? 'الجدول الخاص' : user?.role === 'student' ? 'الجدول الخاص' : 'الرسائل';

  if (isStudentPrivateView) {
    return (
      <div className="chat-container">
        <div className="chat-window" style={{ width: '100%' }}>
          <div className="chat-header">
            <h2>{pageTitle}</h2>
            <p className="user-role">جدولك الخاص فقط</p>
          </div>

          <div className="messages-container" style={{ display: 'grid', gap: '16px' }}>
            {schedules.length === 0 ? (
              <p className="no-messages">لا توجد جداول خاصة لك حتى الآن.</p>
            ) : (
              schedules.map(schedule => (
                <div key={schedule.id} className="card" style={{ padding: '16px', borderRadius: '12px', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <strong>{schedule.file_name || 'جدول الطالب'}</strong>
                    <span className="activity-time">{new Date(schedule.created_at).toLocaleDateString('ar-JO')}</span>
                  </div>
                  <img
                    src={schedule.image_url}
                    alt={schedule.file_name || 'جدول الطالب'}
                    style={{ width: '100%', maxHeight: '500px', objectFit: 'contain', borderRadius: '10px', border: '1px solid #e5e7eb' }}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      {/* Conversations List */}
      <div className="conversations-panel">
        <div className="conversations-header">
          <h2>💬 {pageTitle}</h2>
          {!isStudentPrivateView && ((user?.role === 'super_admin' || user?.role === 'admin') ? (
            <button 
              className="btn-new-chat"
              onClick={() => {
                setShowNewChat(!showNewChat);
                if (!showNewChat) fetchStudents();
              }}
            >
              ➕
            </button>
          ) : (
            <button 
              className="btn-new-chat"
              onClick={() => {
                setShowNewChat(!showNewChat);
                if (!showNewChat) fetchAdmins();
              }}
            >
              ➕
            </button>
          ))}
        </div>

        {showNewChat && (user?.role === 'super_admin' || user?.role === 'admin') && (
          <div className="new-chat-panel">
            <h4>اختر طالب لبدء محادثة</h4>
            <div className="search-box">
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    fetchStudents();
                  }
                }}
                placeholder="ابحث بالاسم أو البريد الإلكتروني"
              />
              <button type="button" onClick={fetchStudents}>بحث</button>
            </div>
            <div className="students-list">
              {students.length === 0 ? (
                <p className="no-results">لا يوجد طلاب مطابقون</p>
              ) : (
                students.map(student => (
                  <div 
                    key={student.id} 
                    className="student-item"
                    onClick={() => handleStartNewChat(student, 'student')}
                  >
                    <div className="student-info">
                      <p className="student-name">{student.name}</p>
                      <p className="student-email">{student.email}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {showNewChat && user?.role === 'student' && (
          <div className="new-chat-panel">
            <h4>اختر الإدارة لبدء محادثة</h4>
            <div className="students-list">
              {admins.length === 0 ? (
                <p className="no-results">لا يوجد مشرفون متاحون الآن</p>
              ) : (
                admins.map(admin => (
                  <div 
                    key={admin.id}
                    className="student-item"
                    onClick={() => handleStartNewChat(admin, 'admin')}
                  >
                    <div className="student-info">
                      <p className="student-name">{admin.name}</p>
                      <p className="student-email">{admin.email}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="conversations-list">
          {conversations.length === 0 ? (
            <p className="no-conversations">لا توجد محادثات حتى الآن</p>
          ) : (
            conversations.map(conversation => (
              <div 
                key={conversation.conversationId}
                className={`conversation-item ${selectedConversation?.conversationId === conversation.conversationId ? 'active' : ''}`}
                onClick={() => setSelectedConversation(conversation)}
              >
                <div className="conversation-avatar">
                  {conversation.otherUser.profilePicture ? (
                    <img src={conversation.otherUser.profilePicture} alt={conversation.otherUser.name} />
                  ) : (
                    <div className="avatar-placeholder">
                      {conversation.otherUser.name.charAt(0)}
                    </div>
                  )}
                  {conversation.unreadCount > 0 && (
                    <span className="unread-badge">{conversation.unreadCount}</span>
                  )}
                </div>
                
                <div className="conversation-info">
                  <div className="conversation-header-row">
                    <h3>{conversation.otherUser.name}</h3>
                    <span className="time">
                      {conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <p className={`last-message ${conversation.unreadCount > 0 ? 'unread' : ''}`}>
                    {conversation.lastMessageSenderId === user.id ? 'أنت: ' : ''}
                    {conversation.lastMessage ? conversation.lastMessage.substring(0, 50) : 'لا توجد رسائل'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Window */}
      <div className="chat-window">
        {selectedConversation ? (
          <>
            <div className="chat-header">
              <h2>{selectedConversation.otherUser.name}</h2>
              <p className="user-role">
                {selectedConversation.otherUser.role === 'student' ? '👨‍🎓 طالب' : '👨‍💼 مشرف'}
              </p>
            </div>

            <div className="messages-container">
              {messages.length === 0 ? (
                <p className="no-messages">لا توجد رسائل في هذه المحادثة</p>
              ) : (
                messages.map(msg => (
                  <div 
                    key={msg.id}
                    className={`message ${msg.sender_id === user.id ? 'sent' : 'received'}`}
                  >
                    <div className="message-bubble">
                      {String(msg.message || '').startsWith('data:image') ? (
                        <img src={msg.message} alt="رسالة صورة" className="message-image" />
                      ) : (
                        <p>{msg.message}</p>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span className="message-time">
                          {new Date(msg.created_at).toLocaleTimeString('ar-JO', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </span>
                        {(msg.sender_id === user.id || ['admin', 'super_admin'].includes(user.role)) && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await apiClient.delete(`/messages/${msg.id}`);
                                fetchMessages(selectedConversation.conversationId);
                              } catch (error) {
                                console.error('Delete message error:', error);
                              }
                            }}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: '#ef4444',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '700'
                            }}
                          >
                            حذف
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {!isStudentPrivateView && (
              <form onSubmit={handleSendMessage} className="message-input-form">
                {selectedImage && (
                  <div className="selected-image-preview">
                    <img src={selectedImage} alt="Selected attachment" />
                    <button type="button" onClick={() => setSelectedImage(null)} className="remove-image-btn">
                      حذف
                    </button>
                  </div>
                )}
                <div className="message-tools">
                  <label className="upload-image-btn">
                    🖼️ صورة
                    <input type="file" accept="image/*" onChange={handleImageSelect} />
                  </label>
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="اكتب رسالة..."
                    className="message-input"
                  />
                  <button type="submit" className="btn-send">
                    📤 إرسال
                  </button>
                </div>
              </form>
            )}
          </>
        ) : (
          <div className="empty-chat">
            <p>💬 اختر محادثة لبدء الرسائلة</p>
          </div>
        )}
      </div>
    </div>
  );
}
