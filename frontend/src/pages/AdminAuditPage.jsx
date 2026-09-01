import { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/dashboard.css';

export default function AdminAuditPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await axios.get('/api/audit?perPage=20');
        setLogs(response.data.logs || []);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Failed to load audit logs');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  if (loading) return <div className="dashboard-loading">Loading audit logs...</div>;

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Audit Logs</h1>
          <p>Recent platform activity</p>
        </div>
      </header>

      <div className="dashboard-grid">
        <section className="card full-width">
          <h2>Recent Activity</h2>
          {error && <div className="error-message">{error}</div>}

          {logs.length > 0 ? (
            <div className="activities-list">
              {logs.map((log) => (
                <div key={log.id} className="activity-item">
                  <p>
                    <strong>{log.actor_name || 'System'}</strong> · {log.action}
                  </p>
                  <p>{log.entity_type || 'General'} #{log.entity_id || '-'}</p>
                  <span className="activity-time">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No activity logs yet</p>
          )}
        </section>
      </div>
    </div>
  );
}
