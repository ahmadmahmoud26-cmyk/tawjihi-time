PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS stage_field_subjects;
DROP TABLE IF EXISTS stage_subjects;
DROP TABLE IF EXISTS academic_fields;
DROP TABLE IF EXISTS academic_stages;

CREATE TABLE academic_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE academic_fields (
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

CREATE TABLE stage_field_subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stage_id INTEGER NOT NULL REFERENCES academic_stages(id),
  field_id INTEGER NOT NULL REFERENCES academic_fields(id),
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(stage_id, field_id, subject_id)
);

CREATE TABLE stage_subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stage_id INTEGER NOT NULL REFERENCES academic_stages(id),
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(stage_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_stage_subjects_stage ON stage_subjects(stage_id);

INSERT INTO academic_stages (name, description, display_order, active) VALUES
  ('المرحلة الثانوية الأولى', 'المرحلة الثانوية الأولى', 1, TRUE),
  ('المرحلة الثانوية الثانية', 'المرحلة الثانوية الثانية', 2, TRUE),
  ('المراحل التكميلية', 'المراحل التكميلية', 3, TRUE),
  ('تكميلي 2008', 'مرحلة تكميلي 2008', 10, TRUE),
  ('2009 نظامي', 'مرحلة 2009 نظامي', 11, TRUE),
  ('تكميلي 2009', 'مرحلة تكميلي 2009', 12, TRUE),
  ('2010 نظامي', 'مرحلة 2010 نظامي', 13, TRUE);

INSERT INTO academic_fields (stage_id, name, description, display_order, active)
SELECT id, 'صحي', 'المسار الصحي', 1, TRUE FROM academic_stages WHERE name IN ('تكميلي 2008', '2009 نظامي');
INSERT INTO academic_fields (stage_id, name, description, display_order, active)
SELECT id, 'هندسي وتكنولوجيا', 'المسار الهندسي والتكنولوجي', 2, TRUE FROM academic_stages WHERE name IN ('تكميلي 2008', '2009 نظامي');
INSERT INTO academic_fields (stage_id, name, description, display_order, active)
SELECT id, 'بيتيك', 'مسار بيتيك', 3, TRUE FROM academic_stages WHERE name IN ('تكميلي 2008', '2009 نظامي');

INSERT INTO stage_field_subjects (stage_id, field_id, subject_id, active)
SELECT st.id, af.id, s.id, TRUE
FROM academic_stages st
JOIN academic_fields af ON af.stage_id = st.id
JOIN subjects s ON s.name IN ('الكيمياء', 'الأحياء', 'علوم الأرض', 'اللغة الإنجليزية')
WHERE st.name IN ('تكميلي 2008', '2009 نظامي') AND af.name = 'صحي';

INSERT INTO stage_field_subjects (stage_id, field_id, subject_id, active)
SELECT st.id, af.id, s.id, TRUE
FROM academic_stages st
JOIN academic_fields af ON af.stage_id = st.id
JOIN subjects s ON s.name IN ('اللغة الإنجليزية', 'الرياضيات', 'الفيزياء', 'علوم الأرض')
WHERE st.name IN ('تكميلي 2008', '2009 نظامي') AND af.name = 'هندسي وتكنولوجيا';

INSERT INTO stage_field_subjects (stage_id, field_id, subject_id, active)
SELECT st.id, af.id, s.id, TRUE
FROM academic_stages st
JOIN academic_fields af ON af.stage_id = st.id
JOIN subjects s ON s.name IN ('اللغة الإنجليزية', 'تاريخ الأردن', 'التربية الإسلامية', 'اللغة العربية')
WHERE st.name IN ('تكميلي 2008', '2009 نظامي') AND af.name = 'بيتيك';

INSERT INTO stage_subjects (stage_id, subject_id, active)
SELECT st.id, s.id, TRUE
FROM academic_stages st
JOIN subjects s ON s.name IN ('اللغة الإنجليزية', 'اللغة العربية', 'تاريخ الأردن', 'التربية الإسلامية')
WHERE st.name = 'تكميلي 2009';

INSERT INTO stage_subjects (stage_id, subject_id, active)
SELECT st.id, s.id, TRUE
FROM academic_stages st
JOIN subjects s ON s.name IN ('الرياضيات', 'اللغة العربية', 'التربية الإسلامية', 'تاريخ الأردن')
WHERE st.name = '2010 نظامي';

PRAGMA foreign_keys = ON;
