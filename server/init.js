import bcrypt from 'bcryptjs';
import db from './db.js';

export const DEFAULT_STUDENT_SUBJECT_NAMES = [
  'رياضيات',
  'عربي',
  'لغة إنجليزية',
  'تربية إسلامية',
  'فيزياء',
  'علوم أرض',
  'ثقافة مالية',
  'تاريخ أردن',
  'أحياء',
  'كيمياء',
];

export function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS academic_stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      active INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS academic_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      active INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stage_field_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      academicStageId INTEGER NOT NULL,
      academicFieldId INTEGER,
      subjectId INTEGER NOT NULL,
      displayOrder INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (academicStageId) REFERENCES academic_stages(id),
      FOREIGN KEY (academicFieldId) REFERENCES academic_fields(id),
      FOREIGN KEY (subjectId) REFERENCES subjects(id)
    );

    CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      active INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      googleId TEXT,
      profilePicture TEXT,
      role TEXT NOT NULL DEFAULT 'student',
      gradeId INTEGER,
      academicStageId INTEGER,
      academicFieldId INTEGER,
      accountStatus TEXT DEFAULT 'active',
      bannedAt TEXT,
      bannedReason TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      lastLoginAt TEXT,
      passwordHash TEXT,
      FOREIGN KEY (gradeId) REFERENCES grades(id),
      FOREIGN KEY (academicStageId) REFERENCES academic_stages(id),
      FOREIGN KEY (academicFieldId) REFERENCES academic_fields(id)
    );

    CREATE TABLE IF NOT EXISTS student_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL UNIQUE,
      predictedAverage REAL DEFAULT 0,
      streak INTEGER DEFAULT 0,
      lastCheckInAt TEXT,
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (studentId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      gradeId INTEGER,
      displayOrder INTEGER DEFAULT 0,
      visibility TEXT DEFAULT 'public',
      createdBy INTEGER,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      deletedAt TEXT,
      FOREIGN KEY (gradeId) REFERENCES grades(id),
      FOREIGN KEY (createdBy) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS student_subject_enrollment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      subjectId INTEGER NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (studentId) REFERENCES users(id),
      FOREIGN KEY (subjectId) REFERENCES subjects(id)
    );

    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subjectId INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      displayOrder INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      deletedAt TEXT,
      FOREIGN KEY (subjectId) REFERENCES subjects(id)
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unitId INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      displayOrder INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      deletedAt TEXT,
      FOREIGN KEY (unitId) REFERENCES units(id)
    );

    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lessonId INTEGER NOT NULL,
      sectionType TEXT NOT NULL,
      title TEXT,
      content TEXT,
      displayOrder INTEGER DEFAULT 0,
      visibility TEXT DEFAULT 'public',
      createdBy INTEGER,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      deletedAt TEXT,
      FOREIGN KEY (lessonId) REFERENCES lessons(id),
      FOREIGN KEY (createdBy) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS learning_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resourceType TEXT NOT NULL CHECK (resourceType IN ('image', 'link')),
      description TEXT NOT NULL,
      imageUrl TEXT,
      resourceUrl TEXT,
      createdBy INTEGER,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (createdBy) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      imageUrl TEXT,
      resourceUrl TEXT,
      gradeId INTEGER,
      subjectId INTEGER,
      unitId INTEGER,
      lessonId INTEGER,
      duration INTEGER,
      totalMarks INTEGER DEFAULT 0,
      passingMark INTEGER,
      visibility TEXT DEFAULT 'public',
      createdBy INTEGER,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      deletedAt TEXT,
      FOREIGN KEY (gradeId) REFERENCES grades(id),
      FOREIGN KEY (subjectId) REFERENCES subjects(id),
      FOREIGN KEY (unitId) REFERENCES units(id),
      FOREIGN KEY (lessonId) REFERENCES lessons(id),
      FOREIGN KEY (createdBy) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      examId INTEGER NOT NULL,
      questionText TEXT NOT NULL,
      marks INTEGER DEFAULT 1,
      displayOrder INTEGER DEFAULT 0,
      deletedAt TEXT,
      FOREIGN KEY (examId) REFERENCES exams(id)
    );

    CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      questionId INTEGER NOT NULL,
      answerText TEXT NOT NULL,
      isCorrect INTEGER DEFAULT 0,
      displayOrder INTEGER DEFAULT 0,
      deletedAt TEXT,
      FOREIGN KEY (questionId) REFERENCES questions(id)
    );

    CREATE TABLE IF NOT EXISTS exam_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      examId INTEGER NOT NULL,
      startedAt TEXT DEFAULT (datetime('now')),
      submittedAt TEXT,
      status TEXT DEFAULT 'in_progress',
      FOREIGN KEY (studentId) REFERENCES users(id),
      FOREIGN KEY (examId) REFERENCES exams(id)
    );

    CREATE TABLE IF NOT EXISTS exam_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attemptId INTEGER NOT NULL,
      questionId INTEGER NOT NULL,
      selectedAnswerId INTEGER,
      FOREIGN KEY (attemptId) REFERENCES exam_attempts(id),
      FOREIGN KEY (questionId) REFERENCES questions(id),
      FOREIGN KEY (selectedAnswerId) REFERENCES answers(id)
    );

    CREATE TABLE IF NOT EXISTS exam_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attemptId INTEGER NOT NULL,
      studentId INTEGER NOT NULL,
      examId INTEGER NOT NULL,
      score INTEGER DEFAULT 0,
      totalMarks INTEGER DEFAULT 0,
      percentage REAL DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (attemptId) REFERENCES exam_attempts(id),
      FOREIGN KEY (studentId) REFERENCES users(id),
      FOREIGN KEY (examId) REFERENCES exams(id)
    );

    CREATE TABLE IF NOT EXISTS student_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      subjectId INTEGER,
      unitId INTEGER,
      lessonId INTEGER,
      note TEXT NOT NULL,
      readStatus TEXT DEFAULT 'unread',
      adminReply TEXT,
      repliedBy INTEGER,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      readAt TEXT,
      repliedAt TEXT,
      FOREIGN KEY (studentId) REFERENCES users(id),
      FOREIGN KEY (subjectId) REFERENCES subjects(id),
      FOREIGN KEY (unitId) REFERENCES units(id),
      FOREIGN KEY (lessonId) REFERENCES lessons(id),
      FOREIGN KEY (repliedBy) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      senderId INTEGER NOT NULL,
      recipientId INTEGER,
      conversationId TEXT,
      message TEXT NOT NULL,
      imageUrl TEXT,
      readStatus TEXT DEFAULT 'unread',
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (senderId) REFERENCES users(id),
      FOREIGN KEY (recipientId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS weekly_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      title TEXT DEFAULT 'الجدول الأسبوعي',
      imageUrl TEXT NOT NULL,
      createdBy INTEGER,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (studentId) REFERENCES users(id),
      FOREIGN KEY (createdBy) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT,
      imageUrl TEXT,
      targetGrade TEXT,
      createdBy INTEGER,
      visibility TEXT DEFAULT 'public',
      publishAt TEXT,
      expiresAt TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (createdBy) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS public_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      message TEXT NOT NULL,
      imageUrl TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (studentId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS chat_mutes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      mutedBy INTEGER NOT NULL,
      reason TEXT,
      mutedUntil TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (studentId) REFERENCES users(id),
      FOREIGN KEY (mutedBy) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipientId INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      relatedEntityType TEXT,
      relatedEntityId INTEGER,
      isRead INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      readAt TEXT,
      FOREIGN KEY (recipientId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS admin_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      permission TEXT NOT NULL,
      granted INTEGER DEFAULT 1,
      grantedBy INTEGER,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (grantedBy) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actorUserId INTEGER,
      action TEXT NOT NULL,
      entityType TEXT,
      entityId INTEGER,
      metadata TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (actorUserId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      updatedAt TEXT DEFAULT (datetime('now'))
    );
  `);

  const userColumns = db.prepare('PRAGMA table_info(users)').all().map((column) => column.name);
  if (!userColumns.includes('bannedAt')) db.exec('ALTER TABLE users ADD COLUMN bannedAt TEXT');
  if (!userColumns.includes('bannedReason')) db.exec('ALTER TABLE users ADD COLUMN bannedReason TEXT');
  if (!userColumns.includes('academicStageId')) db.exec('ALTER TABLE users ADD COLUMN academicStageId INTEGER');
  if (!userColumns.includes('academicFieldId')) db.exec('ALTER TABLE users ADD COLUMN academicFieldId INTEGER');

  const announcementColumns = db.prepare('PRAGMA table_info(announcements)').all().map((column) => column.name);
  if (!announcementColumns.includes('imageUrl')) db.exec('ALTER TABLE announcements ADD COLUMN imageUrl TEXT');

  const messageColumns = db.prepare('PRAGMA table_info(messages)').all().map((column) => column.name);
  if (!messageColumns.includes('imageUrl')) db.exec('ALTER TABLE messages ADD COLUMN imageUrl TEXT');

  const examColumns = db.prepare('PRAGMA table_info(exams)').all().map((column) => column.name);
  if (!examColumns.includes('imageUrl')) db.exec('ALTER TABLE exams ADD COLUMN imageUrl TEXT');
  if (!examColumns.includes('resourceUrl')) db.exec('ALTER TABLE exams ADD COLUMN resourceUrl TEXT');

  const defaultGrades = [
    'الأولى الثانوي',
    'الثانية الثانوي',
    'الثالثة الثانوي',
  ];

  for (const grade of defaultGrades) {
    db.prepare('INSERT INTO grades (name, active) SELECT ?, 1 WHERE NOT EXISTS (SELECT 1 FROM grades WHERE name = ?)').run(grade, grade);
  }

  const defaultAcademicStages = [
    'الأولى الثانوي',
    'الأولى الثانوي - الدور التكميلي',
    'الثانية الثانوي',
    'الثانية الثانوي - الدور التكميلي',
    'الثانية الثانوي بتك',
    'الثانية الثانوي بتك - الدور التكميلي',
  ];

  for (const stage of defaultAcademicStages) {
    db.prepare('INSERT INTO academic_stages (name, active) SELECT ?, 1 WHERE NOT EXISTS (SELECT 1 FROM academic_stages WHERE name = ?)').run(stage, stage);
  }

  const defaultAcademicFields = [
    'الصحة',
    'الهندسة والتكنولوجيا',
    'الأعمال والقانون',
    'بتك',
  ];

  for (const field of defaultAcademicFields) {
    db.prepare('INSERT INTO academic_fields (name, active) SELECT ?, 1 WHERE NOT EXISTS (SELECT 1 FROM academic_fields WHERE name = ?)').run(field, field);
  }

  for (const [displayOrder, name] of DEFAULT_STUDENT_SUBJECT_NAMES.entries()) {
    db.prepare(`
      INSERT INTO subjects (name, description, gradeId, displayOrder, visibility, createdAt, updatedAt)
      SELECT ?, '', NULL, ?, 'public', datetime('now'), datetime('now')
      WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = ? AND deletedAt IS NULL)
    `).run(name, displayOrder + 1, name);
  }

  const duplicateGrades = db.prepare(`
    SELECT name, MIN(id) AS keepId, GROUP_CONCAT(id) AS duplicateIds
    FROM grades
    GROUP BY name
    HAVING COUNT(*) > 1
  `).all();
  for (const grade of duplicateGrades) {
    const duplicateIds = grade.duplicateIds.split(',').map(Number).filter((id) => id !== grade.keepId);
    for (const duplicateId of duplicateIds) {
      db.prepare('UPDATE users SET gradeId = ? WHERE gradeId = ?').run(grade.keepId, duplicateId);
      db.prepare('UPDATE subjects SET gradeId = ? WHERE gradeId = ?').run(grade.keepId, duplicateId);
      db.prepare('UPDATE exams SET gradeId = ? WHERE gradeId = ?').run(grade.keepId, duplicateId);
      db.prepare('DELETE FROM grades WHERE id = ?').run(duplicateId);
    }
  }
}

export const DEFAULT_PERMISSIONS = [
  'manage_students',
  'view_students',
  'manage_subjects',
  'manage_units',
  'manage_lessons',
  'manage_sections',
  'manage_exams',
  'manage_questions',
  'view_results',
  'manage_notes',
  'reply_to_students',
  'manage_messages',
  'manage_announcements',
  'manage_files',
  'manage_settings',
  'manage_admins',
];

export function ensureSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD before starting in production.');
    }
    console.warn('Super Admin was not initialized: set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD to create one.');
    return null;
  }

  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existing) {
    const existingPermissions = db.prepare('SELECT permission FROM admin_permissions WHERE userId = ?').all(existing.id);
    for (const permission of DEFAULT_PERMISSIONS) {
      const hasPermission = existingPermissions.some((row) => row.permission === permission);
      if (!hasPermission) {
        db.prepare("INSERT INTO admin_permissions (userId, permission, granted, grantedBy, createdAt) VALUES (?, ?, 1, ?, datetime('now'))").run(existing.id, permission, existing.id);
      }
    }
    return existing;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (name, email, role, accountStatus, passwordHash, createdAt, updatedAt, lastLoginAt)
    VALUES (?, ?, 'super_admin', 'active', ?, datetime('now'), datetime('now'), datetime('now'))
  `).run('Super Admin', email, passwordHash);

  const userId = result.lastInsertRowid;
  for (const permission of DEFAULT_PERMISSIONS) {
    db.prepare("INSERT INTO admin_permissions (userId, permission, granted, grantedBy, createdAt) VALUES (?, ?, 1, ?, datetime('now'))").run(userId, permission, userId);
  }

  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function getUserPermissions(userId) {
  return db.prepare('SELECT permission, granted FROM admin_permissions WHERE userId = ?').all(userId)
    .filter((row) => Number(row.granted) === 1)
    .map((row) => row.permission);
}

export function createAuditLog({ actorUserId, action, entityType, entityId, metadata }) {
  db.prepare(`
    INSERT INTO audit_logs (actorUserId, action, entityType, entityId, metadata, createdAt)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(actorUserId || null, action, entityType || null, entityId || null, metadata ? JSON.stringify(metadata) : null);
}
