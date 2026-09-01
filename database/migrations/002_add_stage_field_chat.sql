-- 002_add_stage_field_chat.sql
-- Add academic stage/field metadata and public chat/mute support

CREATE TABLE IF NOT EXISTS academic_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academic_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stage_id INTEGER NOT NULL REFERENCES academic_stages(id),
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(stage_id, name)
);

CREATE TABLE IF NOT EXISTS stage_field_subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stage_id INTEGER NOT NULL REFERENCES academic_stages(id),
  field_id INTEGER NOT NULL REFERENCES academic_fields(id),
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(stage_id, field_id, subject_id)
);

CREATE TABLE IF NOT EXISTS public_chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
CREATE INDEX IF NOT EXISTS idx_chat_mutes_active ON chat_mutes(is_active, muted_until);
CREATE INDEX IF NOT EXISTS idx_public_chat_created ON public_chat_messages(created_at);

INSERT OR IGNORE INTO academic_stages (name, description, display_order, active)
VALUES
  ('المرحلة الثانوية الأولى', 'المرحلة الثانوية الأولى', 1, TRUE),
  ('المرحلة الثانوية الثانية', 'المرحلة الثانوية الثانية', 2, TRUE),
  ('المراحل التكميلية', 'المراحل التكميلية', 3, TRUE);
