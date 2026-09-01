import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';
import apiClient from '../utils/api';
import '../styles/navigation.css';

export default function Navigation() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState([]);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        const response = await apiClient.get('/notifications?perPage=100');
        setUnreadCount(response.data.unreadCount || 0);
          setUnreadNotifications((response.data.notifications || []).filter(notification => !notification.is_read));
      } catch (error) {
        setUnreadCount(0);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
      window.addEventListener('notifications-read', fetchNotifications);
      return () => {
        clearInterval(interval);
        window.removeEventListener('notifications-read', fetchNotifications);
      };
  }, [user?.id]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const studentLinks = [
    { path: '/dashboard', label: 'لوحة التحكم', icon: '📊' },
    { path: '/announcements', label: 'الإعلانات', icon: '📢' },
    { path: '/my-subjects', label: 'موادي', icon: '📚' },
    { path: '/chat', label: 'التواصل مع الإدارة', icon: '💬', notificationTypes: ['private_message', 'message'] },
    { path: '/private-table', label: 'الجدول الخاص', icon: '📅', notificationTypes: ['student_schedule'] },
    { path: '/public-chat', label: 'الشات العام', icon: '👥', notificationTypes: ['general_chat', 'public_chat'] },
  ];

  const adminLinks = [
    { path: '/admin/messages', label: 'الرسائل', icon: '💬', notificationTypes: ['private_message', 'message'] },
    { path: '/admin/students', label: 'جداول الطلاب', icon: '📅' },
    { path: '/admin/announcements', label: 'إضافة إعلان', icon: '📢' },
    { path: '/public-chat', label: 'الشات العام', icon: '👥', notificationTypes: ['general_chat', 'public_chat'] },
    { path: '/admin/dashboard', label: 'لوحة المدير', icon: '📊' },
  ];

  const isPrimarySuperAdmin = user?.role === 'super_admin' && user?.email?.toLowerCase() === 'ahmad169qyp12q@gmail.com';
  const links = user?.role === 'student'
    ? studentLinks
    : [
      ...adminLinks.slice(0, 3),
      ...(isPrimarySuperAdmin ? [{ path: '/admin/management', label: 'إضافة أدمن', icon: '👤' }] : []),
      ...adminLinks.slice(3)
    ];

  const openLink = (link) => {
    navigate(link.path);
    setIsOpen(false);
  };

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <h1>Tawjihi Time</h1>
        </div>

        <div className={`nav-menu ${isOpen ? 'open' : ''}`}>
          {links.map(link => (
            <a
              key={link.path}
              href={link.path}
              className="nav-link"
              onClick={(event) => {
                event.preventDefault();
                openLink(link);
              }}
            >
              <span className="nav-icon">
                {link.icon}
                {unreadNotifications.some(notification => link.notificationTypes?.includes(notification.related_entity_type)) && <span className="nav-link-notification" />}
              </span>
              <span className="nav-label">{link.label}</span>
            </a>
          ))}
        </div>

        <div className="nav-user">
          <div className="user-info">
            <p className="user-name">{user?.name}</p>
            <p className="user-role">
              {user?.role === 'student' ? 'طالب' : 'مشرف'}
              {unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
            </p>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            تسجيل الخروج
          </button>
        </div>

        <button 
          className="nav-toggle"
          onClick={() => setIsOpen(!isOpen)}
        >
          ☰
        </button>
      </div>
    </nav>
  );
}
