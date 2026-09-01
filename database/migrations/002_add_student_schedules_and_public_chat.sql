CREATE TABLE IF NOT EXISTS student_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  image_url TEXT NOT NULL,
  file_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_schedules_student ON student_schedules(student_id);
CREATE INDEX IF NOT EXISTS idx_student_schedules_uploaded_by ON student_schedules(uploaded_by);

CREATE TABLE IF NOT EXISTS public_chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_public_chat_messages_sender ON public_chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_public_chat_messages_created ON public_chat_messages(created_at);

CREATE TABLE IF NOT EXISTS chat_mutes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  admin_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT,
  muted_until TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_mutes_student ON chat_mutes(student_id);
CREATE INDEX IF NOT EXISTS idx_chat_mutes_active ON chat_mutes(is_active);
