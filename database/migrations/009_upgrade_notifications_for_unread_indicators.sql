PRAGMA foreign_keys = OFF;

CREATE TABLE notifications_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN ('admin_reply', 'announcement', 'message', 'exam', 'note_reply', 'system', 'private_message', 'student_schedule', 'general_chat')),
  title TEXT NOT NULL,
  message TEXT,
  related_entity_type TEXT,
  related_entity_id INTEGER,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP,
  UNIQUE(recipient_id, related_entity_type, related_entity_id)
);

INSERT OR IGNORE INTO notifications_new (id, recipient_id, type, title, message, related_entity_type, related_entity_id, is_read, created_at, read_at)
SELECT id, recipient_id, type, title, message, related_entity_type, related_entity_id, is_read, created_at, read_at
FROM notifications;

DROP TABLE notifications;
ALTER TABLE notifications_new RENAME TO notifications;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_entity ON notifications(recipient_id, related_entity_type, related_entity_id);

PRAGMA foreign_keys = ON;
