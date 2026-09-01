CREATE TABLE IF NOT EXISTS stage_subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stage_id INTEGER NOT NULL REFERENCES academic_stages(id),
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(stage_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_stage_subjects_stage ON stage_subjects(stage_id);

INSERT OR IGNORE INTO grades (name, description, display_order, active)
VALUES ('مسارات التوجيهي', 'مواد المراحل والمسارات التعليمية', 100, TRUE);

INSERT OR IGNORE INTO academic_stages (name, description, display_order, active)
VALUES
  ('تكميلي 2008', 'مرحلة تكميلي 2008', 10, TRUE),
  ('2009 نظامي', 'مرحلة 2009 نظامي', 11, TRUE),
  ('تكميلي 2009', 'مرحلة تكميلي 2009', 12, TRUE),
  ('2010 نظامي', 'مرحلة 2010 نظامي', 13, TRUE);

INSERT OR IGNORE INTO academic_fields (stage_id, name, description, display_order, active)
SELECT id, 'صحي', 'المسار الصحي', 1, TRUE FROM academic_stages WHERE name IN ('تكميلي 2008', '2009 نظامي');

INSERT OR IGNORE INTO academic_fields (stage_id, name, description, display_order, active)
SELECT id, 'هندسي وتكنولوجيا', 'المسار الهندسي والتكنولوجي', 2, TRUE FROM academic_stages WHERE name IN ('تكميلي 2008', '2009 نظامي');

INSERT OR IGNORE INTO academic_fields (stage_id, name, description, display_order, active)
SELECT id, 'بيتيك', 'مسار بيتيك', 3, TRUE FROM academic_stages WHERE name IN ('تكميلي 2008', '2009 نظامي');

INSERT OR IGNORE INTO subjects (name, description, grade_id, display_order, visibility, created_at, updated_at)
SELECT 'الكيمياء', 'مواد مسارات التوجيهي', id, 1, TRUE, datetime('now'), datetime('now') FROM grades WHERE name = 'مسارات التوجيهي';
INSERT OR IGNORE INTO subjects (name, description, grade_id, display_order, visibility, created_at, updated_at)
SELECT 'الأحياء', 'مواد مسارات التوجيهي', id, 2, TRUE, datetime('now'), datetime('now') FROM grades WHERE name = 'مسارات التوجيهي';
INSERT OR IGNORE INTO subjects (name, description, grade_id, display_order, visibility, created_at, updated_at)
SELECT 'علوم الأرض', 'مواد مسارات التوجيهي', id, 3, TRUE, datetime('now'), datetime('now') FROM grades WHERE name = 'مسارات التوجيهي';
INSERT OR IGNORE INTO subjects (name, description, grade_id, display_order, visibility, created_at, updated_at)
SELECT 'اللغة الإنجليزية', 'مواد مسارات التوجيهي', id, 4, TRUE, datetime('now'), datetime('now') FROM grades WHERE name = 'مسارات التوجيهي';
INSERT OR IGNORE INTO subjects (name, description, grade_id, display_order, visibility, created_at, updated_at)
SELECT 'الرياضيات', 'مواد مسارات التوجيهي', id, 5, TRUE, datetime('now'), datetime('now') FROM grades WHERE name = 'مسارات التوجيهي';
INSERT OR IGNORE INTO subjects (name, description, grade_id, display_order, visibility, created_at, updated_at)
SELECT 'الفيزياء', 'مواد مسارات التوجيهي', id, 6, TRUE, datetime('now'), datetime('now') FROM grades WHERE name = 'مسارات التوجيهي';
INSERT OR IGNORE INTO subjects (name, description, grade_id, display_order, visibility, created_at, updated_at)
SELECT 'تاريخ الأردن', 'مواد مسارات التوجيهي', id, 7, TRUE, datetime('now'), datetime('now') FROM grades WHERE name = 'مسارات التوجيهي';
INSERT OR IGNORE INTO subjects (name, description, grade_id, display_order, visibility, created_at, updated_at)
SELECT 'التربية الإسلامية', 'مواد مسارات التوجيهي', id, 8, TRUE, datetime('now'), datetime('now') FROM grades WHERE name = 'مسارات التوجيهي';
INSERT OR IGNORE INTO subjects (name, description, grade_id, display_order, visibility, created_at, updated_at)
SELECT 'اللغة العربية', 'مواد مسارات التوجيهي', id, 9, TRUE, datetime('now'), datetime('now') FROM grades WHERE name = 'مسارات التوجيهي';

INSERT OR IGNORE INTO stage_field_subjects (stage_id, field_id, subject_id, active)
SELECT st.id, af.id, s.id, TRUE
FROM academic_stages st
JOIN academic_fields af ON af.stage_id = st.id
JOIN subjects s ON s.name IN ('الكيمياء', 'الأحياء', 'علوم الأرض', 'اللغة الإنجليزية')
WHERE st.name IN ('تكميلي 2008', '2009 نظامي') AND af.name = 'صحي';

INSERT OR IGNORE INTO stage_field_subjects (stage_id, field_id, subject_id, active)
SELECT st.id, af.id, s.id, TRUE
FROM academic_stages st
JOIN academic_fields af ON af.stage_id = st.id
JOIN subjects s ON s.name IN ('اللغة الإنجليزية', 'الرياضيات', 'الفيزياء', 'علوم الأرض')
WHERE st.name IN ('تكميلي 2008', '2009 نظامي') AND af.name = 'هندسي وتكنولوجيا';

INSERT OR IGNORE INTO stage_field_subjects (stage_id, field_id, subject_id, active)
SELECT st.id, af.id, s.id, TRUE
FROM academic_stages st
JOIN academic_fields af ON af.stage_id = st.id
JOIN subjects s ON s.name IN ('اللغة الإنجليزية', 'تاريخ الأردن', 'التربية الإسلامية', 'اللغة العربية')
WHERE st.name IN ('تكميلي 2008', '2009 نظامي') AND af.name = 'بيتيك';

INSERT OR IGNORE INTO stage_subjects (stage_id, subject_id, active)
SELECT st.id, s.id, TRUE
FROM academic_stages st
JOIN subjects s ON s.name IN ('اللغة الإنجليزية', 'اللغة العربية', 'تاريخ الأردن', 'التربية الإسلامية')
WHERE st.name = 'تكميلي 2009';

INSERT OR IGNORE INTO stage_subjects (stage_id, subject_id, active)
SELECT st.id, s.id, TRUE
FROM academic_stages st
JOIN subjects s ON s.name IN ('الرياضيات', 'اللغة العربية', 'التربية الإسلامية', 'تاريخ الأردن')
WHERE st.name = '2010 نظامي';
