import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import passport from 'passport';
import bcrypt from 'bcryptjs';
import path from 'path';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

import db from './db.js';
import { SQLiteSessionStore } from './session-store.js';
import { DEFAULT_PERMISSIONS, DEFAULT_STUDENT_SUBJECT_NAMES, createAuditLog, ensureSchema, ensureSuperAdmin, getUserByEmail, getUserById, getUserPermissions } from './init.js';

dotenv.config();

if (process.env.NODE_ENV === 'production') {
  const requiredProductionVariables = ['SESSION_SECRET', 'SUPER_ADMIN_EMAIL', 'SUPER_ADMIN_PASSWORD'];
  const missingVariables = requiredProductionVariables.filter((name) => !process.env[name]);
  if (missingVariables.length > 0) {
    throw new Error(`Missing required production environment variables: ${missingVariables.join(', ')}`);
  }
}

const app = express();
const PORT = Number(process.env.PORT || 3001);
const distDirectory = path.resolve(process.cwd(), 'dist');

const ADMIN_ROLES = ['admin', 'super_admin'];

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ 
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || 'http://localhost:5173' 
    : 'http://localhost:5173', 
  credentials: true 
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

app.use(session({
  store: new SQLiteSessionStore(db),
  secret: process.env.SESSION_SECRET || 'tawjihi-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8,
  },
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = getUserById(Number(id));
  done(null, user || null);
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
  }, (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(new Error('Google email missing'));

      let user = getUserByEmail(email);
      if (!user) {
        const result = db.prepare(`
          INSERT INTO users (name, email, googleId, profilePicture, role, accountStatus, createdAt, updatedAt, lastLoginAt)
          VALUES (?, ?, ?, ?, 'student', 'active', datetime('now'), datetime('now'), datetime('now'))
        `).run(profile.displayName, email, profile.id, profile.photos?.[0]?.value || null);
        user = getUserById(result.lastInsertRowid);
      } else {
        db.prepare("UPDATE users SET lastLoginAt = datetime('now'), updatedAt = datetime('now') WHERE id = ?").run(user.id);
        user = getUserById(user.id);
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }));
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'غير مسموح لك بالدخول.' });
  }
  next();
}

function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    const user = getUserById(req.session.userId);
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: 'ليس لديك صلاحية كافية.' });
    }
    next();
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    const user = getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: 'غير مصرح لك.' });
    }

    const permissions = getUserPermissions(user.id);
    if (user.role === 'super_admin' || permissions.includes(permission)) {
      return next();
    }

    return res.status(403).json({ message: 'الإذن المطلوب غير موجود.' });
  };
}

function serializeUser(user) {
  if (!user) return null;
  const grade = user.gradeId ? db.prepare('SELECT name FROM grades WHERE id = ?').get(user.gradeId) : null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    gradeName: grade ? grade.name : null,
    accountStatus: user.accountStatus,
  };
}

function getStudentSubjects(studentId) {
  return db.prepare(`
    SELECT s.*
    FROM student_subject_enrollment e
    JOIN subjects s ON s.id = e.subjectId
    WHERE e.studentId = ? AND s.deletedAt IS NULL
    ORDER BY s.displayOrder ASC
  `).all(studentId);
}

function updateStudentCheckIn(studentId) {
  const current = db.prepare('SELECT * FROM student_progress WHERE studentId = ?').get(studentId);
  const now = new Date();
  let streak = 1;

  if (current?.lastCheckInAt) {
    const elapsedHours = (now.getTime() - new Date(`${current.lastCheckInAt}Z`).getTime()) / (1000 * 60 * 60);
    if (elapsedHours <= 24) streak = Math.max(1, Number(current.streak || 0));
  }

  db.prepare(`
    INSERT INTO student_progress (studentId, predictedAverage, streak, lastCheckInAt, updatedAt)
    VALUES (?, 0, ?, datetime('now'), datetime('now'))
    ON CONFLICT(studentId) DO UPDATE SET streak = excluded.streak, lastCheckInAt = excluded.lastCheckInAt, updatedAt = excluded.updatedAt
  `).run(studentId, streak);

  return db.prepare('SELECT * FROM student_progress WHERE studentId = ?').get(studentId);
}

function getStudentProgress(studentId) {
  const progress = db.prepare('SELECT * FROM student_progress WHERE studentId = ?').get(studentId);
  if (!progress) {
    db.prepare("INSERT INTO student_progress (studentId, predictedAverage, streak, lastCheckInAt) VALUES (?, 0, 0, NULL)").run(studentId);
    return db.prepare('SELECT * FROM student_progress WHERE studentId = ?').get(studentId);
  }

  if (progress.lastCheckInAt) {
    const elapsedHours = (Date.now() - new Date(`${progress.lastCheckInAt}Z`).getTime()) / (1000 * 60 * 60);
    if (elapsedHours > 24 && progress.streak !== 0) {
      db.prepare("UPDATE student_progress SET streak = 0, updatedAt = datetime('now') WHERE studentId = ?").run(studentId);
      return db.prepare('SELECT * FROM student_progress WHERE studentId = ?').get(studentId);
    }
  }
  return progress;
}

app.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Tawjihi Time is running' });
});

app.get('/api/auth/session', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'لا توجد جلسة' });
  }

  const user = getUserById(req.session.userId);
  if (!user) {
    return res.status(401).json({ message: 'المستخدم غير موجود' });
  }

  return res.json({
    user: {
      ...serializeUser(user),
      subjects: getStudentSubjects(user.id),
    },
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور.' });
  }

  const user = getUserByEmail(String(email).trim());
  if (user?.accountStatus === 'banned') {
    return res.status(403).json({ message: 'تم تبنيد هذا الحساب. تواصل مع الإدارة.' });
  }
  if (!user || !user.passwordHash) {
    return res.status(401).json({ message: 'بيانات الدخول غير صحيحة.' });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ message: 'كلمة المرور غير صحيحة.' });
  }

  req.session.userId = user.id;
  req.session.role = user.role;
  const progress = user.role === 'student' ? updateStudentCheckIn(user.id) : null;
  db.prepare("UPDATE users SET lastLoginAt = datetime('now'), updatedAt = datetime('now') WHERE id = ?").run(user.id);
  return res.json({ message: 'تم تسجيل الدخول بنجاح', user: { ...serializeUser(user), progress } });
});

app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور.' });
  }

  const user = getUserByEmail(String(email).trim());
  if (user?.accountStatus === 'banned') {
    return res.status(403).json({ message: 'تم تبنيد هذا الحساب.' });
  }
  if (!user || !user.passwordHash) {
    return res.status(401).json({ message: 'بيانات الدخول غير صحيحة.' });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match || !ADMIN_ROLES.includes(user.role)) {
    return res.status(403).json({ message: 'ليس لديك صلاحية للوصول إلى لوحة الإدارة.' });
  }

  req.session.userId = user.id;
  req.session.role = user.role;
  return res.json({ message: 'تم تسجيل الدخول بنجاح', user: serializeUser(user) });
});

app.get('/api/auth/google/status', (req, res) => {
  res.json({ enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) });
});

app.get('/api/auth/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).send('تسجيل الدخول عبر Google غير مفعّل بعد. أضف بيانات Google OAuth إلى ملف .env.');
  }
  return passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get('/api/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/?auth=failed', session: true }),
  (req, res) => {
    req.session.userId = req.user.id;
    req.session.role = req.user.role;
    updateStudentCheckIn(req.user.id);
    res.redirect('/student/dashboard');
  },
);

app.get('/api/student/progress', requireAuth, (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user || user.role !== 'student') return res.status(403).json({ message: 'هذه البيانات مخصصة للطلاب.' });
  res.json(getStudentProgress(user.id));
});

app.get('/api/admin/students/:id/progress', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_students'), (req, res) => {
  const studentId = Number(req.params.id);
  const student = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'student'").get(studentId);
  if (!student) return res.status(404).json({ message: 'الطالب غير موجود.' });
  res.json(getStudentProgress(studentId));
});

app.put('/api/admin/students/:id/progress', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_students'), (req, res) => {
  const studentId = Number(req.params.id);
  const average = Number(req.body?.predictedAverage);
  const student = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'student'").get(studentId);
  if (!student) return res.status(404).json({ message: 'الطالب غير موجود.' });
  if (!Number.isFinite(average) || average < 0 || average > 100) return res.status(400).json({ message: 'المعدل يجب أن يكون بين 0 و100.' });

  getStudentProgress(studentId);
  db.prepare("UPDATE student_progress SET predictedAverage = ?, updatedAt = datetime('now') WHERE studentId = ?").run(average, studentId);
  createAuditLog({ actorUserId: req.session.userId, action: 'update', entityType: 'student_progress', entityId: studentId, metadata: { predictedAverage: average } });
  res.json(getStudentProgress(studentId));
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'تم تسجيل الخروج بنجاح' });
  });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'تم تسجيل الخروج بنجاح' });
  });
});

app.post('/api/admin/account/password', requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = getUserById(req.session.userId);
  if (!user?.passwordHash) return res.status(404).json({ message: 'تعذر العثور على حساب الإدارة.' });
  if (!currentPassword || !newPassword) return res.status(400).json({ message: 'أدخل كلمة المرور الحالية والجديدة.' });
  if (String(newPassword).length < 14) return res.status(400).json({ message: 'اجعل كلمة المرور الجديدة 14 حرفاً على الأقل.' });
  if (String(currentPassword) === String(newPassword)) return res.status(400).json({ message: 'يجب أن تختلف كلمة المرور الجديدة عن الحالية.' });

  const matches = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!matches) return res.status(403).json({ message: 'كلمة المرور الحالية غير صحيحة.' });

  const passwordHash = await bcrypt.hash(String(newPassword), 12);
  db.prepare("UPDATE users SET passwordHash = ?, updatedAt = datetime('now') WHERE id = ?").run(passwordHash, user.id);
  createAuditLog({ actorUserId: user.id, action: 'change_password', entityType: 'user', entityId: user.id });

  res.json({ message: 'تم تغيير كلمة مرور الإدارة بنجاح.' });
});

app.get('/api/admin/dashboard', requireAuth, requireRole(ADMIN_ROLES), (req, res) => {
  const stats = {
    totalStudents: db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'student'").get().count,
    activeStudents: db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'student' AND accountStatus = 'active'").get().count,
    totalSubjects: db.prepare('SELECT COUNT(*) AS count FROM subjects WHERE deletedAt IS NULL').get().count,
    totalUnits: db.prepare('SELECT COUNT(*) AS count FROM units WHERE deletedAt IS NULL').get().count,
    totalLessons: db.prepare('SELECT COUNT(*) AS count FROM lessons WHERE deletedAt IS NULL').get().count,
    totalExams: db.prepare('SELECT COUNT(*) AS count FROM exams WHERE deletedAt IS NULL').get().count,
    unreadNotes: db.prepare("SELECT COUNT(*) AS count FROM student_notes WHERE readStatus = 'unread'").get().count,
    unreadMessages: db.prepare("SELECT COUNT(*) AS count FROM messages WHERE readStatus = 'unread'").get().count,
  };

  const recentUsers = db.prepare('SELECT * FROM users ORDER BY createdAt DESC LIMIT 5').all();
  const subjects = db.prepare('SELECT * FROM subjects WHERE deletedAt IS NULL ORDER BY createdAt DESC LIMIT 5').all();

  res.json({ stats, recentUsers, subjects });
});

app.get('/api/admin/subjects', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_subjects'), (req, res) => {
  const rows = db.prepare('SELECT * FROM subjects WHERE deletedAt IS NULL ORDER BY displayOrder ASC, id ASC').all();
  res.json(rows);
});

app.get('/api/admin/units', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_units'), (req, res) => {
  const rows = db.prepare('SELECT * FROM units WHERE deletedAt IS NULL ORDER BY subjectId ASC, displayOrder ASC, id ASC').all();
  res.json(rows);
});

app.get('/api/admin/lessons', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_lessons'), (req, res) => {
  const rows = db.prepare('SELECT * FROM lessons WHERE deletedAt IS NULL ORDER BY unitId ASC, displayOrder ASC, id ASC').all();
  res.json(rows);
});

app.get('/api/admin/exams', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_exams'), (req, res) => {
  const rows = db.prepare('SELECT * FROM exams WHERE deletedAt IS NULL ORDER BY createdAt DESC').all();
  res.json(rows);
});

app.get('/api/admin/exams/:examId/questions', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_questions'), (req, res) => {
  const examId = Number(req.params.examId);
  const exam = db.prepare('SELECT * FROM exams WHERE id = ? AND deletedAt IS NULL').get(examId);
  if (!exam) return res.status(404).json({ message: 'الاختبار غير موجود.' });

  const questions = db.prepare('SELECT * FROM questions WHERE examId = ? AND deletedAt IS NULL ORDER BY displayOrder ASC, id ASC').all(examId);
  const payload = questions.map((question) => ({
    ...question,
    answers: db.prepare('SELECT * FROM answers WHERE questionId = ? AND deletedAt IS NULL ORDER BY displayOrder ASC, id ASC').all(question.id),
  }));

  res.json({ exam, questions: payload });
});

app.post('/api/admin/exams/:examId/questions', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_questions'), (req, res) => {
  const examId = Number(req.params.examId);
  const { questionText, marks, answers } = req.body || {};
  if (!questionText || !String(questionText).trim()) {
    return res.status(400).json({ message: 'نص السؤال مطلوب.' });
  }

  const exam = db.prepare('SELECT * FROM exams WHERE id = ? AND deletedAt IS NULL').get(examId);
  if (!exam) return res.status(404).json({ message: 'الاختبار غير موجود.' });

  const list = Array.isArray(answers) ? answers : [];
  const validAnswers = list
    .filter((answer) => typeof answer?.answerText === 'string' && answer.answerText.trim())
    .map((answer, index) => ({
      answerText: answer.answerText.trim(),
      isCorrect: Boolean(answer.isCorrect),
      displayOrder: index,
    }));

  if (validAnswers.length === 0) {
    return res.status(400).json({ message: 'يجب إضافة إجابة واحدة على الأقل لكل سؤال.' });
  }
  if (!validAnswers.some((answer) => answer.isCorrect)) {
    return res.status(400).json({ message: 'يجب تحديد إجابة صحيحة.' });
  }

  const questionResult = db.prepare(`
    INSERT INTO questions (examId, questionText, marks, displayOrder)
    VALUES (?, ?, ?, COALESCE((SELECT MAX(displayOrder) + 1 FROM questions WHERE examId = ?), 1))
  `).run(examId, String(questionText).trim(), Number(marks || 1), examId);

  const questionId = questionResult.lastInsertRowid;

  for (const answer of validAnswers) {
    db.prepare(`
      INSERT INTO answers (questionId, answerText, isCorrect, displayOrder)
      VALUES (?, ?, ?, ?)
    `).run(questionId, answer.answerText, answer.isCorrect ? 1 : 0, answer.displayOrder);
  }

  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
  const insertedAnswers = db.prepare('SELECT * FROM answers WHERE questionId = ? ORDER BY displayOrder ASC, id ASC').all(questionId);
  res.status(201).json({ ...question, answers: insertedAnswers });
});

app.get('/api/student/exams', requireAuth, (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user || user.role !== 'student') {
    return res.status(403).json({ message: 'يجب أن تكون طالباً للوصول إلى هذه البيانات.' });
  }

  const rows = db.prepare(`
    SELECT e.*
    FROM exams e
    WHERE e.deletedAt IS NULL
      AND (e.gradeId IS NULL OR e.gradeId = ?)
    ORDER BY e.createdAt DESC
  `).all(user.gradeId || null);

  const payload = rows.map((exam) => ({
    ...exam,
    questionCount: db.prepare('SELECT COUNT(*) AS count FROM questions WHERE examId = ? AND deletedAt IS NULL').get(exam.id).count,
  }));

  res.json(payload);
});

app.get('/api/student/exams/:examId', requireAuth, (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user || user.role !== 'student') {
    return res.status(403).json({ message: 'يجب أن تكون طالباً للوصول إلى هذا الاختبار.' });
  }

  const examId = Number(req.params.examId);
  const exam = db.prepare('SELECT * FROM exams WHERE id = ? AND deletedAt IS NULL AND (gradeId IS NULL OR gradeId = ?)').get(examId, user.gradeId || null);
  if (!exam) return res.status(404).json({ message: 'الاختبار غير موجود.' });

  const questions = db.prepare('SELECT * FROM questions WHERE examId = ? AND deletedAt IS NULL ORDER BY displayOrder ASC, id ASC').all(examId);
  const payload = questions.map((question) => ({
    ...question,
    answers: db.prepare('SELECT id, answerText FROM answers WHERE questionId = ? AND deletedAt IS NULL ORDER BY displayOrder ASC, id ASC').all(question.id),
  }));

  res.json({ exam, questions: payload });
});

app.post('/api/student/exams/:examId/start', requireAuth, (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user || user.role !== 'student') {
    return res.status(403).json({ message: 'يجب أن تكون طالباً لبدء الاختبار.' });
  }

  const examId = Number(req.params.examId);
  const exam = db.prepare('SELECT * FROM exams WHERE id = ? AND deletedAt IS NULL').get(examId);
  if (!exam) return res.status(404).json({ message: 'الاختبار غير موجود.' });

  const existing = db.prepare('SELECT * FROM exam_attempts WHERE studentId = ? AND examId = ? AND status = ? ORDER BY startedAt DESC LIMIT 1').get(user.id, examId, 'in_progress');
  if (existing) {
    return res.json({ message: 'الاختبار بدأ بالفعل.', attemptId: existing.id });
  }

  const result = db.prepare(`
    INSERT INTO exam_attempts (studentId, examId, startedAt, status)
    VALUES (?, ?, datetime('now'), 'in_progress')
  `).run(user.id, examId);

  res.status(201).json({ message: 'تم بدء الاختبار بنجاح.', attemptId: result.lastInsertRowid });
});

app.post('/api/student/exams/:examId/submit', requireAuth, (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user || user.role !== 'student') {
    return res.status(403).json({ message: 'يجب أن تكون طالباً لتسليم الاختبار.' });
  }

  const examId = Number(req.params.examId);
  const exam = db.prepare('SELECT * FROM exams WHERE id = ? AND deletedAt IS NULL').get(examId);
  if (!exam) return res.status(404).json({ message: 'الاختبار غير موجود.' });

  const attempt = db.prepare('SELECT * FROM exam_attempts WHERE studentId = ? AND examId = ? AND status = ? ORDER BY startedAt DESC LIMIT 1').get(user.id, examId, 'in_progress');
  if (!attempt) {
    return res.status(400).json({ message: 'لم تبدأ هذا الاختبار بعد.' });
  }

  const answers = req.body?.answers || {};
  const questions = db.prepare('SELECT * FROM questions WHERE examId = ? AND deletedAt IS NULL').all(examId);
  let score = 0;

  for (const question of questions) {
    const selectedAnswerId = Number(answers[String(question.id)] || 0);
    if (!selectedAnswerId) continue;

    const selectedAnswer = db.prepare('SELECT isCorrect FROM answers WHERE id = ? AND questionId = ?').get(selectedAnswerId, question.id);
    if (!selectedAnswer) {
      return res.status(400).json({ message: 'إجابة غير صالحة لهذا السؤال.' });
    }
    if (selectedAnswer && Number(selectedAnswer.isCorrect) === 1) {
      score += Number(question.marks || 1);
    }

    db.prepare(`
      INSERT INTO exam_answers (attemptId, questionId, selectedAnswerId)
      VALUES (?, ?, ?)
    `).run(attempt.id, question.id, selectedAnswerId);
  }

  const totalMarks = questions.reduce((sum, question) => sum + Number(question.marks || 1), 0);
  const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;

  db.prepare(`
    INSERT INTO exam_results (attemptId, studentId, examId, score, totalMarks, percentage, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(attempt.id, user.id, examId, score, totalMarks, percentage);

  db.prepare(`
    UPDATE exam_attempts
    SET submittedAt = datetime('now'), status = 'submitted'
    WHERE id = ?
  `).run(attempt.id);

  res.json({
    message: 'تم تسليم الاختبار بنجاح.',
    score,
    totalMarks,
    percentage,
  });
});

app.get('/api/student/results', requireAuth, (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user || user.role !== 'student') {
    return res.status(403).json({ message: 'يجب أن تكون طالباً للوصول إلى النتائج.' });
  }

  const rows = db.prepare(`
    SELECT r.*, e.title AS examTitle, e.subjectId
    FROM exam_results r
    JOIN exams e ON e.id = r.examId
    WHERE r.studentId = ?
    ORDER BY r.createdAt DESC
  `).all(user.id);
  res.json(rows);
});

app.get('/api/admin/results', requireAuth, requireRole(ADMIN_ROLES), requirePermission('view_results'), (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, e.title AS examTitle, u.name AS studentName, u.email AS studentEmail
    FROM exam_results r
    JOIN exams e ON e.id = r.examId
    JOIN users u ON u.id = r.studentId
    ORDER BY r.createdAt DESC
    LIMIT 200
  `).all();
  res.json(rows);
});

app.get('/api/admin/users', requireAuth, requireRole(ADMIN_ROLES), (req, res) => {
  const rows = db.prepare(`
    SELECT u.*, g.name AS gradeName
    FROM users u
    LEFT JOIN grades g ON g.id = u.gradeId
    ORDER BY u.createdAt DESC
  `).all();

  res.json(rows.map((user) => ({
    ...serializeUser(user),
    gradeName: user.gradeName,
    permissions: getUserPermissions(user.id),
  })));
});

app.get('/api/admin/permissions', requireAuth, requireRole(['super_admin']), (req, res) => {
  const admins = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.accountStatus, u.createdAt
    FROM users u
    WHERE u.role IN ('admin', 'super_admin')
    ORDER BY u.createdAt DESC
  `).all();

  res.json({
    permissions: DEFAULT_PERMISSIONS,
    admins: admins.map((admin) => ({
      ...admin,
      permissions: getUserPermissions(admin.id),
    })),
  });
});

app.post('/api/admin/permissions/:userId', requireAuth, requireRole(['super_admin']), (req, res) => {
  const { permission, granted } = req.body || {};
  const userId = Number(req.params.userId);
  if (!permission) {
    return res.status(400).json({ message: 'الإذن مطلوب.' });
  }

  const existing = db.prepare('SELECT * FROM admin_permissions WHERE userId = ? AND permission = ?').get(userId, permission);
  if (existing) {
    db.prepare('UPDATE admin_permissions SET granted = ?, grantedBy = ? WHERE id = ?').run(granted ? 1 : 0, req.session.userId, existing.id);
  } else {
    db.prepare("INSERT INTO admin_permissions (userId, permission, granted, grantedBy, createdAt) VALUES (?, ?, ?, ?, datetime('now'))").run(userId, permission, granted ? 1 : 0, req.session.userId);
  }

  res.json({ message: 'تم تحديث الصلاحية بنجاح.' });
});

app.get('/api/admin/students', requireAuth, requireRole(ADMIN_ROLES), (req, res) => {
  const rows = db.prepare(`
    SELECT u.*, g.name AS gradeName, ast.name AS academicStageName, af.name AS academicFieldName,
           p.predictedAverage, p.streak, p.lastCheckInAt
    FROM users u
    LEFT JOIN grades g ON g.id = u.gradeId
    LEFT JOIN academic_stages ast ON ast.id = u.academicStageId
    LEFT JOIN academic_fields af ON af.id = u.academicFieldId
    LEFT JOIN student_progress p ON p.studentId = u.id
    WHERE u.role IN ('student', 'admin', 'super_admin')
    ORDER BY u.createdAt DESC
  `).all();

  res.json(rows.map((user) => ({
    ...serializeUser(user),
    gradeName: user.gradeName,
    academicStageName: user.academicStageName,
    academicFieldName: user.academicFieldName,
    subjects: user.role === 'student' ? getStudentSubjects(user.id) : [],
    predictedAverage: user.predictedAverage || 0,
    streak: user.streak || 0,
    lastCheckInAt: user.lastCheckInAt,
    bannedAt: user.bannedAt,
    bannedReason: user.bannedReason,
  })));
});

app.get('/api/student/subjects', requireAuth, (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user || user.role !== 'student') return res.status(403).json({ message: 'هذه الصفحة مخصصة للطلاب.' });

  const availableSubjects = DEFAULT_STUDENT_SUBJECT_NAMES.map((name) => db.prepare(`
    SELECT id, name FROM subjects
    WHERE name = ? AND deletedAt IS NULL
    ORDER BY id ASC LIMIT 1
  `).get(name)).filter(Boolean);
  const selectedSubjectIds = getStudentSubjects(user.id).map((subject) => subject.id);
  res.json({ availableSubjects, selectedSubjectIds });
});

app.put('/api/student/subjects', requireAuth, (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user || user.role !== 'student') return res.status(403).json({ message: 'هذه الصفحة مخصصة للطلاب.' });

  const requestedIds = Array.isArray(req.body?.subjectIds) ? [...new Set(req.body.subjectIds.map(Number))] : null;
  if (!requestedIds || requestedIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    return res.status(400).json({ message: 'قائمة المواد المختارة غير صالحة.' });
  }
  if (requestedIds.length > DEFAULT_STUDENT_SUBJECT_NAMES.length) {
    return res.status(400).json({ message: 'تجاوزت الحد الأقصى للمواد المتاحة.' });
  }

  const allowedIds = new Set(DEFAULT_STUDENT_SUBJECT_NAMES.map((name) => db.prepare(`
    SELECT id FROM subjects WHERE name = ? AND deletedAt IS NULL ORDER BY id ASC LIMIT 1
  `).get(name)?.id).filter(Boolean));
  if (requestedIds.some((id) => !allowedIds.has(id))) {
    return res.status(400).json({ message: 'تتضمن القائمة مادة غير متاحة للاختيار.' });
  }

  const replaceSelection = db.transaction(() => {
    db.prepare('DELETE FROM student_subject_enrollment WHERE studentId = ?').run(user.id);
    const insert = db.prepare('INSERT INTO student_subject_enrollment (studentId, subjectId, createdAt) VALUES (?, ?, datetime(\'now\'))');
    for (const subjectId of requestedIds) insert.run(user.id, subjectId);
  });
  replaceSelection();

  const selectedSubjects = getStudentSubjects(user.id);
  createAuditLog({ actorUserId: user.id, action: 'select_subjects', entityType: 'student', entityId: user.id, metadata: { subjectIds: requestedIds } });
  res.json({ message: 'تم حفظ المواد المختارة بنجاح.', subjects: selectedSubjects, selectedSubjectIds: requestedIds });
});

app.get('/api/admin/active-students', requireAuth, requireRole(ADMIN_ROLES), requirePermission('view_students'), (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.name, u.email, u.gradeId, u.lastLoginAt, g.name AS gradeName,
           p.streak, p.predictedAverage
    FROM users u
    LEFT JOIN grades g ON g.id = u.gradeId
    LEFT JOIN student_progress p ON p.studentId = u.id
    WHERE u.role = 'student' AND u.accountStatus = 'active'
      AND u.lastLoginAt IS NOT NULL
      AND u.lastLoginAt >= datetime('now', '-15 minutes')
    ORDER BY u.lastLoginAt DESC
  `).all();
  res.json(rows);
});

app.put('/api/admin/students/:id/status', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_students'), (req, res) => {
  const studentId = Number(req.params.id);
  const student = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'student'").get(studentId);
  if (!student) return res.status(404).json({ message: 'الطالب غير موجود.' });
  const banned = Boolean(req.body?.banned);
  const reason = banned ? String(req.body?.reason || 'قرار إداري').trim() : null;
  db.prepare(`UPDATE users SET accountStatus = ?, bannedAt = ?, bannedReason = ?, updatedAt = datetime('now') WHERE id = ?`).run(banned ? 'banned' : 'active', banned ? new Date().toISOString() : null, reason, studentId);
  createAuditLog({ actorUserId: req.session.userId, action: banned ? 'ban' : 'unban', entityType: 'student', entityId: studentId, metadata: { reason } });
  res.json({ message: banned ? 'تم تبنيد الطالب.' : 'تم إلغاء تبنيد الطالب.' });
});

app.delete('/api/admin/students/:id', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_students'), (req, res) => {
  const studentId = Number(req.params.id);
  if (!Number.isSafeInteger(studentId) || studentId < 1) return res.status(400).json({ message: 'رقم حساب الطالب غير صالح.' });

  const student = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'student'").get(studentId);
  if (!student) return res.status(404).json({ message: 'الطالب غير موجود.' });

  const counts = db.transaction(() => {
    const attemptIds = db.prepare('SELECT id FROM exam_attempts WHERE studentId = ?').all(studentId).map((row) => row.id);
    const resultIds = db.prepare('SELECT id FROM exam_results WHERE studentId = ?').all(studentId).map((row) => row.id);
    const noteIds = db.prepare('SELECT id FROM student_notes WHERE studentId = ?').all(studentId).map((row) => row.id);
    const messageIds = db.prepare('SELECT id FROM messages WHERE senderId = ? OR recipientId = ?').all(studentId, studentId).map((row) => row.id);
    const scheduleIds = db.prepare('SELECT id FROM weekly_schedules WHERE studentId = ?').all(studentId).map((row) => row.id);
    const publicChatMessageIds = db.prepare('SELECT id FROM public_chat_messages WHERE studentId = ?').all(studentId).map((row) => row.id);

    const deleteRelatedNotifications = db.prepare('DELETE FROM notifications WHERE relatedEntityType = ? AND relatedEntityId = ?');
    for (const id of noteIds) deleteRelatedNotifications.run('student_note', id);
    for (const id of messageIds) deleteRelatedNotifications.run('message', id);
    for (const id of scheduleIds) deleteRelatedNotifications.run('weekly_schedule', id);

    if (attemptIds.length) {
      const placeholders = attemptIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM exam_answers WHERE attemptId IN (${placeholders})`).run(...attemptIds);
    }
    if (resultIds.length) {
      const placeholders = resultIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM exam_answers WHERE attemptId IN (SELECT attemptId FROM exam_results WHERE id IN (${placeholders}))`).run(...resultIds);
    }
    db.prepare('DELETE FROM exam_results WHERE studentId = ?').run(studentId);
    db.prepare('DELETE FROM exam_attempts WHERE studentId = ?').run(studentId);
    db.prepare('DELETE FROM student_subject_enrollment WHERE studentId = ?').run(studentId);
    db.prepare('DELETE FROM student_progress WHERE studentId = ?').run(studentId);
    db.prepare('DELETE FROM student_notes WHERE studentId = ?').run(studentId);
    db.prepare('DELETE FROM messages WHERE senderId = ? OR recipientId = ?').run(studentId, studentId);
    db.prepare('DELETE FROM weekly_schedules WHERE studentId = ?').run(studentId);
    db.prepare('DELETE FROM public_chat_messages WHERE studentId = ?').run(studentId);
    db.prepare('DELETE FROM chat_mutes WHERE studentId = ? OR mutedBy = ?').run(studentId, studentId);
    db.prepare('DELETE FROM notifications WHERE recipientId = ?').run(studentId);
    db.prepare('DELETE FROM admin_permissions WHERE userId = ?').run(studentId);
    db.prepare('UPDATE admin_permissions SET grantedBy = NULL WHERE grantedBy = ?').run(studentId);
    db.prepare('UPDATE subjects SET createdBy = NULL WHERE createdBy = ?').run(studentId);
    db.prepare('UPDATE sections SET createdBy = NULL WHERE createdBy = ?').run(studentId);
    db.prepare('UPDATE exams SET createdBy = NULL WHERE createdBy = ?').run(studentId);
    db.prepare('UPDATE student_notes SET repliedBy = NULL WHERE repliedBy = ?').run(studentId);
    db.prepare('UPDATE weekly_schedules SET createdBy = NULL WHERE createdBy = ?').run(studentId);
    db.prepare('UPDATE announcements SET createdBy = NULL WHERE createdBy = ?').run(studentId);

    const sessions = db.prepare('SELECT sid, sess FROM app_sessions').all();
    const deleteSession = db.prepare('DELETE FROM app_sessions WHERE sid = ?');
    for (const session of sessions) {
      try {
        if (Number(JSON.parse(session.sess).userId) === studentId) deleteSession.run(session.sid);
      } catch {
        // Ignore malformed session rows; they are unrelated to account deletion.
      }
    }

    db.prepare("DELETE FROM audit_logs WHERE actorUserId = ? OR (entityType IN ('student', 'user') AND entityId = ?)").run(studentId, studentId);
    const deleteEntityAuditLogs = db.prepare('DELETE FROM audit_logs WHERE entityType = ? AND entityId = ?');
    for (const id of attemptIds) deleteEntityAuditLogs.run('exam_attempt', id);
    for (const id of resultIds) deleteEntityAuditLogs.run('exam_result', id);
    for (const id of noteIds) deleteEntityAuditLogs.run('student_note', id);
    for (const id of messageIds) deleteEntityAuditLogs.run('message', id);
    for (const id of scheduleIds) deleteEntityAuditLogs.run('weekly_schedule', id);
    for (const id of publicChatMessageIds) deleteEntityAuditLogs.run('public_chat_message', id);
    deleteEntityAuditLogs.run('chat_mute', studentId);
    db.prepare('DELETE FROM users WHERE id = ?').run(studentId);
    return { attempts: attemptIds.length, results: resultIds.length, notes: noteIds.length, messages: messageIds.length, schedules: scheduleIds.length, publicChatMessages: publicChatMessageIds.length };
  });

  const deletedData = counts();
  createAuditLog({ actorUserId: req.session.userId, action: 'permanently_delete_student', entityType: 'student', entityId: null, metadata: { deletedData } });
  res.json({ message: 'تم حذف حساب الطالب وجميع بياناته نهائياً.', deletedData });
});

app.post('/api/admin/students', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_students'), async (req, res) => {
  const { name, email, password, gradeId } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!name || !normalizedEmail || !password) {
    return res.status(400).json({ message: 'الاسم والبريد وكلمة المرور مطلوبة.' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ message: 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: 'صيغة البريد الإلكتروني غير صحيحة.' });
  }
  if (getUserByEmail(normalizedEmail)) {
    return res.status(409).json({ message: 'هذا البريد مستخدم مسبقاً.' });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const result = db.prepare(`
    INSERT INTO users (name, email, role, gradeId, accountStatus, passwordHash, createdAt, updatedAt)
    VALUES (?, ?, 'student', ?, 'active', ?, datetime('now'), datetime('now'))
  `).run(String(name).trim(), normalizedEmail, gradeId ? Number(gradeId) : null, passwordHash);

  createAuditLog({ actorUserId: req.session.userId, action: 'create', entityType: 'student', entityId: result.lastInsertRowid });
  res.status(201).json({ message: 'تم إنشاء حساب الطالب بنجاح.', user: serializeUser(getUserById(result.lastInsertRowid)) });
});

app.get('/api/admin/enrollments', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_students'), (req, res) => {
  const rows = db.prepare(`
    SELECT e.id, e.studentId, e.subjectId, e.createdAt, u.name AS studentName, s.name AS subjectName
    FROM student_subject_enrollment e
    JOIN users u ON u.id = e.studentId
    JOIN subjects s ON s.id = e.subjectId
    ORDER BY e.createdAt DESC
  `).all();
  res.json(rows);
});

app.post('/api/admin/enrollments', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_students'), (req, res) => {
  const studentId = Number(req.body?.studentId);
  const subjectId = Number(req.body?.subjectId);
  const student = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'student'").get(studentId);
  const subject = db.prepare('SELECT id FROM subjects WHERE id = ? AND deletedAt IS NULL').get(subjectId);
  if (!student || !subject) return res.status(400).json({ message: 'الطالب أو المادة غير موجود.' });

  db.prepare('INSERT OR IGNORE INTO student_subject_enrollment (studentId, subjectId, createdAt) VALUES (?, ?, datetime(\'now\'))').run(studentId, subjectId);
  createAuditLog({ actorUserId: req.session.userId, action: 'enroll', entityType: 'subject', entityId: subjectId, metadata: { studentId } });
  res.status(201).json({ message: 'تم إسناد المادة للطالب.' });
});

app.get('/api/grades', (req, res) => {
  const rows = db.prepare('SELECT * FROM grades WHERE active = 1 ORDER BY id ASC').all();
  res.json(rows);
});

app.get('/api/subjects', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM subjects WHERE deletedAt IS NULL ORDER BY displayOrder ASC, id ASC').all();
  res.json(rows);
});

app.get('/api/student/curriculum', requireAuth, (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user || user.role !== 'student') return res.status(403).json({ message: 'يجب أن تكون طالباً للوصول إلى المنهج.' });

  const subjects = db.prepare(`
    SELECT s.*
    FROM subjects s
    JOIN student_subject_enrollment e ON e.subjectId = s.id AND e.studentId = ?
    WHERE s.deletedAt IS NULL AND (s.gradeId IS NULL OR s.gradeId = ?)
    ORDER BY s.displayOrder ASC, s.id ASC
  `).all(user.id, user.gradeId || null);

  const curriculum = subjects.map((subject) => {
    const units = db.prepare('SELECT * FROM units WHERE subjectId = ? AND deletedAt IS NULL ORDER BY displayOrder ASC, id ASC').all(subject.id);
    return {
      ...subject,
      units: units.map((unit) => {
        const lessons = db.prepare('SELECT * FROM lessons WHERE unitId = ? AND deletedAt IS NULL ORDER BY displayOrder ASC, id ASC').all(unit.id);
        return {
          ...unit,
          lessons: lessons.map((lesson) => ({
            ...lesson,
            sections: db.prepare(`
              SELECT * FROM sections
              WHERE lessonId = ? AND deletedAt IS NULL AND visibility = 'public'
              ORDER BY displayOrder ASC, id ASC
            `).all(lesson.id),
          })),
        };
      }),
    };
  });

  res.json(curriculum);
});

app.post('/api/admin/subjects', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_subjects'), (req, res) => {
  const { name, gradeId, description } = req.body || {};
  if (!name || !gradeId) {
    return res.status(400).json({ message: 'اسم المادة والمرحلة مطلوبان.' });
  }

  const result = db.prepare(`
    INSERT INTO subjects (name, description, gradeId, displayOrder, createdBy, createdAt, updatedAt)
    VALUES (?, ?, ?, COALESCE((SELECT MAX(displayOrder) + 1 FROM subjects WHERE deletedAt IS NULL), 1), ?, datetime('now'), datetime('now'))
  `).run(name, description || '', Number(gradeId), req.session.userId);

  const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(result.lastInsertRowid);
  createAuditLog({ actorUserId: req.session.userId, action: 'create', entityType: 'subject', entityId: subject.id });
  res.status(201).json(subject);
});

app.post('/api/admin/units', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_units'), (req, res) => {
  const { subjectId, name, description } = req.body || {};
  if (!subjectId || !name) {
    return res.status(400).json({ message: 'المادة والاسم مطلوبان.' });
  }

  const result = db.prepare(`
    INSERT INTO units (subjectId, name, description, displayOrder, createdAt, updatedAt)
    VALUES (?, ?, ?, COALESCE((SELECT MAX(displayOrder) + 1 FROM units WHERE deletedAt IS NULL AND subjectId = ?), 1), datetime('now'), datetime('now'))
  `).run(Number(subjectId), name, description || '', Number(subjectId));

  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(result.lastInsertRowid);
  createAuditLog({ actorUserId: req.session.userId, action: 'create', entityType: 'unit', entityId: unit.id });
  res.status(201).json(unit);
});

app.post('/api/admin/lessons', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_lessons'), (req, res) => {
  const { unitId, name, description } = req.body || {};
  if (!unitId || !name) {
    return res.status(400).json({ message: 'الوحدة والاسم مطلوبان.' });
  }

  const result = db.prepare(`
    INSERT INTO lessons (unitId, name, description, displayOrder, createdAt, updatedAt)
    VALUES (?, ?, ?, COALESCE((SELECT MAX(displayOrder) + 1 FROM lessons WHERE deletedAt IS NULL AND unitId = ?), 1), datetime('now'), datetime('now'))
  `).run(Number(unitId), name, description || '', Number(unitId));

  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(result.lastInsertRowid);
  createAuditLog({ actorUserId: req.session.userId, action: 'create', entityType: 'lesson', entityId: lesson.id });
  res.status(201).json(lesson);
});

app.get('/api/admin/sections', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_sections'), (req, res) => {
  const rows = db.prepare('SELECT * FROM sections WHERE deletedAt IS NULL ORDER BY lessonId ASC, displayOrder ASC, id ASC').all();
  res.json(rows);
});

app.post('/api/admin/sections', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_sections'), (req, res) => {
  const { lessonId, sectionType, title, content } = req.body || {};
  if (!lessonId || !sectionType || !content || !String(content).trim()) {
    return res.status(400).json({ message: 'الدرس ونوع القسم والمحتوى مطلوبة.' });
  }

  const lesson = db.prepare('SELECT id FROM lessons WHERE id = ? AND deletedAt IS NULL').get(Number(lessonId));
  if (!lesson) return res.status(404).json({ message: 'الدرس غير موجود.' });

  const result = db.prepare(`
    INSERT INTO sections (lessonId, sectionType, title, content, displayOrder, visibility, createdBy, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, COALESCE((SELECT MAX(displayOrder) + 1 FROM sections WHERE lessonId = ? AND deletedAt IS NULL), 1), 'public', ?, datetime('now'), datetime('now'))
  `).run(Number(lessonId), String(sectionType).trim(), title || '', String(content).trim(), Number(lessonId), req.session.userId);

  const section = db.prepare('SELECT * FROM sections WHERE id = ?').get(result.lastInsertRowid);
  createAuditLog({ actorUserId: req.session.userId, action: 'create', entityType: 'section', entityId: section.id, metadata: { lessonId: Number(lessonId) } });
  res.status(201).json(section);
});

app.get('/api/lessons/:lessonId/sections', requireAuth, (req, res) => {
  const lessonId = Number(req.params.lessonId);
  const rows = db.prepare(`
    SELECT * FROM sections
    WHERE lessonId = ? AND deletedAt IS NULL AND visibility = 'public'
    ORDER BY displayOrder ASC, id ASC
  `).all(lessonId);
  res.json(rows);
});

app.get('/api/admin/learning-resources', requireAuth, requireRole(ADMIN_ROLES), (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, u.name AS creatorName
    FROM learning_resources r
    LEFT JOIN users u ON u.id = r.createdBy
    ORDER BY r.createdAt DESC, r.id DESC
  `).all();
  res.json(rows);
});

app.get('/api/student/learning-resources', requireAuth, (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user || user.role !== 'student') return res.status(403).json({ message: 'هذه الموارد مخصصة للطلاب.' });
  const rows = db.prepare(`
    SELECT r.id, r.resourceType, r.description, r.imageUrl, r.resourceUrl, r.createdAt, u.name AS creatorName
    FROM learning_resources r
    LEFT JOIN users u ON u.id = r.createdBy
    ORDER BY r.createdAt DESC, r.id DESC
  `).all();
  res.json(rows);
});

app.post('/api/admin/learning-resources', requireAuth, requireRole(ADMIN_ROLES), (req, res) => {
  const { resourceType, description, imageUrl, resourceUrl } = req.body || {};
  const cleanDescription = String(description || '').trim();
  if (!['image', 'link'].includes(resourceType)) return res.status(400).json({ message: 'اختر صورة أو رابطاً.' });
  if (!cleanDescription) return res.status(400).json({ message: 'أضف شرحاً للصورة أو الرابط.' });
  if (cleanDescription.length > 2000) return res.status(400).json({ message: 'يجب ألا يتجاوز الشرح 2000 حرف.' });

  let safeImageUrl = null;
  let safeResourceUrl = null;
  if (resourceType === 'image') {
    if (typeof imageUrl !== 'string' || !/^data:image\/(jpeg|png|webp|gif);base64,/i.test(imageUrl) || imageUrl.length > 1650000) {
      return res.status(400).json({ message: 'اختر صورة صالحة لا يتجاوز حجمها الحد المسموح.' });
    }
    safeImageUrl = imageUrl;
  } else {
    try {
      const parsedUrl = new URL(String(resourceUrl || '').trim());
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Unsupported protocol');
      safeResourceUrl = parsedUrl.toString();
    } catch {
      return res.status(400).json({ message: 'أدخل رابطاً صحيحاً يبدأ بـ https:// أو http://.' });
    }
  }

  const result = db.prepare(`
    INSERT INTO learning_resources (resourceType, description, imageUrl, resourceUrl, createdBy, createdAt)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(resourceType, cleanDescription, safeImageUrl, safeResourceUrl, req.session.userId);
  const resource = db.prepare(`
    SELECT r.*, u.name AS creatorName
    FROM learning_resources r
    LEFT JOIN users u ON u.id = r.createdBy
    WHERE r.id = ?
  `).get(result.lastInsertRowid);

  createAuditLog({ actorUserId: req.session.userId, action: 'publish_learning_resource', entityType: 'learning_resource', entityId: resource.id, metadata: { resourceType } });
  res.status(201).json(resource);
});

app.delete('/api/admin/learning-resources/:id', requireAuth, requireRole(ADMIN_ROLES), (req, res) => {
  const resourceId = Number(req.params.id);
  if (!Number.isSafeInteger(resourceId) || resourceId < 1) return res.status(400).json({ message: 'رقم المحتوى غير صالح.' });
  const result = db.prepare('DELETE FROM learning_resources WHERE id = ?').run(resourceId);
  if (result.changes === 0) return res.status(404).json({ message: 'المحتوى غير موجود.' });
  createAuditLog({ actorUserId: req.session.userId, action: 'delete_learning_resource', entityType: 'learning_resource', entityId: resourceId });
  res.json({ message: 'تم حذف المحتوى.' });
});

app.post('/api/admin/exams', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_exams'), (req, res) => {
  const { title, description, imageUrl, resourceUrl, gradeId, subjectId, unitId, lessonId, totalMarks } = req.body || {};
  if (!title || !gradeId || !subjectId) {
    return res.status(400).json({ message: 'العنوان والمرحلة والمادة مطلوبان.' });
  }

  const result = db.prepare(`
    INSERT INTO exams (title, description, imageUrl, resourceUrl, gradeId, subjectId, unitId, lessonId, totalMarks, createdBy, visibility, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'public', datetime('now'), datetime('now'))
  `).run(title, description || '', imageUrl || null, resourceUrl || null, Number(gradeId), Number(subjectId), unitId ? Number(unitId) : null, lessonId ? Number(lessonId) : null, totalMarks ? Number(totalMarks) : 0, req.session.userId);

  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(result.lastInsertRowid);
  createAuditLog({ actorUserId: req.session.userId, action: 'create', entityType: 'exam', entityId: exam.id });
  res.status(201).json(exam);
});

app.post('/api/admin/exams/:examId/questions', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_questions'), (req, res) => {
  const { questionText, marks } = req.body || {};
  if (!questionText || !String(questionText).trim()) {
    return res.status(400).json({ message: 'نص السؤال مطلوب.' });
  }

  const result = db.prepare(`
    INSERT INTO questions (examId, questionText, marks, displayOrder)
    VALUES (?, ?, ?, COALESCE((SELECT MAX(displayOrder) + 1 FROM questions WHERE examId = ?), 1))
  `).run(Number(req.params.examId), String(questionText).trim(), Number(marks || 1), Number(req.params.examId));

  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(question);
});

app.put('/api/admin/subjects/:id', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_subjects'), (req, res) => {
  const { name, description, gradeId } = req.body || {};
  const target = db.prepare('SELECT * FROM subjects WHERE id = ? AND deletedAt IS NULL').get(Number(req.params.id));
  if (!target) {
    return res.status(404).json({ message: 'المادة غير موجودة.' });
  }

  db.prepare(`
    UPDATE subjects
    SET name = ?, description = ?, gradeId = ?, updatedAt = datetime('now')
    WHERE id = ?
  `).run(name || target.name, description !== undefined ? description : target.description, Number(gradeId || target.gradeId), target.id);

  const updated = db.prepare('SELECT * FROM subjects WHERE id = ?').get(target.id);
  createAuditLog({ actorUserId: req.session.userId, action: 'update', entityType: 'subject', entityId: target.id });
  res.json(updated);
});

app.delete('/api/admin/subjects/:id', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_subjects'), (req, res) => {
  const id = Number(req.params.id);
  const result = db.prepare("UPDATE subjects SET deletedAt = datetime('now'), updatedAt = datetime('now') WHERE id = ? AND deletedAt IS NULL").run(id);
  if (result.changes === 0) return res.status(404).json({ message: 'المادة غير موجودة.' });
  createAuditLog({ actorUserId: req.session.userId, action: 'archive', entityType: 'subject', entityId: id });
  res.json({ message: 'تم أرشفة المادة بنجاح.' });
});

app.get('/api/student/notes', requireAuth, (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) return res.status(404).json({ message: 'المستخدم غير موجود.' });

  if (user.role === 'student') {
    const rows = db.prepare(`
      SELECT n.*, s.name as subjectName, u.name as unitName
      FROM student_notes n
      LEFT JOIN subjects s ON s.id = n.subjectId
      LEFT JOIN units u ON u.id = n.unitId
      WHERE n.studentId = ?
      ORDER BY n.createdAt DESC
    `).all(user.id);
    return res.json(rows);
  }

  const rows = db.prepare(`
    SELECT n.*, s.name as subjectName, u.name as unitName, st.name as studentName
    FROM student_notes n
    LEFT JOIN subjects s ON s.id = n.subjectId
    LEFT JOIN units u ON u.id = n.unitId
    LEFT JOIN users st ON st.id = n.studentId
    ORDER BY n.createdAt DESC
  `).all();
  res.json(rows);
});

app.post('/api/student/notes', requireAuth, (req, res) => {
  const { subjectId, unitId, lessonId, note } = req.body || {};
  if (!note || !String(note).trim()) {
    return res.status(400).json({ message: 'يرجى كتابة ملاحظة.' });
  }

  const result = db.prepare(`
    INSERT INTO student_notes (studentId, subjectId, unitId, lessonId, note, readStatus, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, 'unread', datetime('now'), datetime('now'))
  `).run(req.session.userId, subjectId || null, unitId || null, lessonId || null, String(note).trim());

  const inserted = db.prepare('SELECT * FROM student_notes WHERE id = ?').get(result.lastInsertRowid);
  const staff = db.prepare("SELECT id FROM users WHERE role IN ('admin','super_admin')").all();
  for (const admin of staff) {
    db.prepare(`
      INSERT INTO notifications (recipientId, type, title, message, relatedEntityType, relatedEntityId, isRead, createdAt)
      VALUES (?, 'student_note', 'ملاحظة جديدة', 'تمت إضافة ملاحظة جديدة من الطالب', 'student_note', ?, 0, datetime('now'))
    `).run(admin.id, inserted.id);
  }

  res.status(201).json(inserted);
});

app.get('/api/admin/notes', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_notes'), (req, res) => {
  const rows = db.prepare(`
    SELECT n.*, s.name as subjectName, st.name as studentName
    FROM student_notes n
    LEFT JOIN subjects s ON s.id = n.subjectId
    LEFT JOIN users st ON st.id = n.studentId
    ORDER BY n.createdAt DESC
  `).all();

  res.json(rows);
});

app.post('/api/admin/notes/:id/reply', requireAuth, requireRole(ADMIN_ROLES), requirePermission('reply_to_students'), (req, res) => {
  const { reply } = req.body || {};
  const noteId = Number(req.params.id);
  const note = db.prepare('SELECT * FROM student_notes WHERE id = ?').get(noteId);
  if (!note) return res.status(404).json({ message: 'الملاحظة غير موجودة.' });

  db.prepare(`
    UPDATE student_notes
    SET adminReply = ?, repliedBy = ?, repliedAt = datetime('now'), readStatus = 'read', readAt = datetime('now'), updatedAt = datetime('now')
    WHERE id = ?
  `).run(String(reply || '').trim(), req.session.userId, noteId);

  db.prepare(`
    INSERT INTO notifications (recipientId, type, title, message, relatedEntityType, relatedEntityId, isRead, createdAt)
    VALUES (?, 'admin_reply', 'رد جديد', 'تم الرد على ملاحظتك', 'student_note', ?, 0, datetime('now'))
  `).run(note.studentId, noteId);

  res.json({ message: 'تم إرسال الرد بنجاح.' });
});

app.get('/api/notifications', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM notifications
    WHERE recipientId = ?
    ORDER BY createdAt DESC
    LIMIT 30
  `).all(req.session.userId);
  res.json(rows);
});

app.post('/api/notifications/:id/read', requireAuth, (req, res) => {
  const result = db.prepare(`
    UPDATE notifications
    SET isRead = 1, readAt = datetime('now')
    WHERE id = ? AND recipientId = ?
  `).run(Number(req.params.id), req.session.userId);

  if (result.changes === 0) return res.status(404).json({ message: 'الإشعار غير موجود.' });
  res.json({ message: 'تم تعليم الإشعار كمقروء.' });
});

app.post('/api/notifications/read-all', requireAuth, (req, res) => {
  db.prepare(`
    UPDATE notifications
    SET isRead = 1, readAt = datetime('now')
    WHERE recipientId = ? AND isRead = 0
  `).run(req.session.userId);
  res.json({ message: 'تم تعليم الإشعارات كمقروءة.' });
});

app.get('/api/messages', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT m.*, sender.name AS senderName, sender.role AS senderRole, recipient.name AS recipientName
    FROM messages m
    JOIN users sender ON sender.id = m.senderId
    LEFT JOIN users recipient ON recipient.id = m.recipientId
    WHERE m.senderId = ? OR m.recipientId = ?
    ORDER BY m.createdAt DESC
    LIMIT 100
  `).all(req.session.userId, req.session.userId);
  res.json(rows);
});

app.get('/api/student/admins', requireAuth, (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user || user.role !== 'student') return res.status(403).json({ message: 'هذه القائمة مخصصة للطلاب.' });
  const admins = db.prepare(`
    SELECT id, name, role
    FROM users
    WHERE role IN ('admin', 'super_admin') AND accountStatus = 'active'
    ORDER BY role = 'super_admin' DESC, name COLLATE NOCASE ASC
  `).all();
  res.json(admins);
});

app.post('/api/admin/messages/read-conversation/:studentId', requireAuth, requireRole(ADMIN_ROLES), (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!Number.isSafeInteger(studentId) || studentId < 1) return res.status(400).json({ message: 'رقم الطالب غير صالح.' });
  const student = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'student'").get(studentId);
  if (!student) return res.status(404).json({ message: 'الطالب غير موجود.' });

  const result = db.prepare(`
    UPDATE messages
    SET readStatus = 'read'
    WHERE senderId = ? AND recipientId = ? AND readStatus = 'unread'
  `).run(studentId, req.session.userId);
  res.json({ message: 'تم تعليم رسائل الطالب كمقروءة.', updated: result.changes });
});

app.post('/api/student/messages/read-conversation/:adminId', requireAuth, (req, res) => {
  const student = getUserById(req.session.userId);
  const adminId = Number(req.params.adminId);
  if (!student || student.role !== 'student') return res.status(403).json({ message: 'هذه المحادثة مخصصة للطلاب.' });
  if (!Number.isSafeInteger(adminId) || adminId < 1) return res.status(400).json({ message: 'رقم الأدمن غير صالح.' });
  const admin = db.prepare("SELECT id FROM users WHERE id = ? AND role IN ('admin', 'super_admin')").get(adminId);
  if (!admin) return res.status(404).json({ message: 'الأدمن غير موجود.' });

  const result = db.prepare(`
    UPDATE messages
    SET readStatus = 'read'
    WHERE senderId = ? AND recipientId = ? AND readStatus = 'unread'
  `).run(adminId, student.id);
  res.json({ message: 'تم تعليم رسائل الأدمن كمقروءة.', updated: result.changes });
});

app.get('/api/student/weekly-schedules', requireAuth, (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user || user.role !== 'student') return res.status(403).json({ message: 'هذه البيانات مخصصة للطلاب.' });
  const rows = db.prepare(`
    SELECT id, title, imageUrl, createdAt, updatedAt
    FROM weekly_schedules
    WHERE studentId = ?
    ORDER BY createdAt DESC
  `).all(user.id);
  res.json(rows);
});

app.get('/api/admin/weekly-schedules', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_students'), (req, res) => {
  const rows = db.prepare(`
    SELECT w.*, u.name AS studentName, u.email AS studentEmail
    FROM weekly_schedules w
    JOIN users u ON u.id = w.studentId
    ORDER BY w.createdAt DESC
  `).all();
  res.json(rows);
});

app.delete('/api/admin/weekly-schedules/:id', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_students'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: 'رقم الجدول غير صالح.' });

  const schedule = db.prepare('SELECT id, studentId FROM weekly_schedules WHERE id = ?').get(id);
  if (!schedule) return res.status(404).json({ message: 'الجدول غير موجود.' });

  const deleteSchedule = db.transaction(() => {
    db.prepare("DELETE FROM notifications WHERE relatedEntityType = 'weekly_schedule' AND relatedEntityId = ?").run(id);
    db.prepare('DELETE FROM weekly_schedules WHERE id = ?').run(id);
    createAuditLog({ actorUserId: req.session.userId, action: 'delete', entityType: 'weekly_schedule', entityId: id, metadata: { studentId: schedule.studentId } });
  });
  deleteSchedule();

  res.json({ message: 'تم حذف الجدول الأسبوعي بنجاح.' });
});

app.post('/api/admin/weekly-schedules', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_students'), (req, res) => {
  const { studentIds, imageUrl, title } = req.body || {};
  const ids = Array.isArray(studentIds) ? [...new Set(studentIds.map(Number).filter(Number.isInteger))] : [];
  if (!ids.length || !imageUrl || !String(imageUrl).startsWith('data:image/')) {
    return res.status(400).json({ message: 'اختر طالباً واحداً على الأقل وأرفق صورة صحيحة.' });
  }
  if (String(imageUrl).length > 2200000) return res.status(400).json({ message: 'حجم صورة الجدول كبير جداً.' });

  const insert = db.prepare(`
    INSERT INTO weekly_schedules (studentId, title, imageUrl, createdBy, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  const notify = db.prepare(`
    INSERT INTO notifications (recipientId, type, title, message, relatedEntityType, relatedEntityId, isRead, createdAt)
    VALUES (?, 'weekly_schedule', 'جدول أسبوعي جديد', 'تم إضافة جدول أسبوعي جديد لك', 'weekly_schedule', ?, 0, datetime('now'))
  `);
  const created = [];
  const transaction = db.transaction(() => {
    for (const studentId of ids) {
      const student = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'student' AND accountStatus = 'active'").get(studentId);
      if (!student) continue;
      const result = insert.run(studentId, title || 'الجدول الأسبوعي', imageUrl, req.session.userId);
      notify.run(studentId, result.lastInsertRowid);
      created.push(Number(result.lastInsertRowid));
    }
  });
  transaction();
  if (!created.length) return res.status(400).json({ message: 'لم يتم العثور على طلاب صالحين.' });
  createAuditLog({ actorUserId: req.session.userId, action: 'create', entityType: 'weekly_schedule', entityId: created[0], metadata: { studentIds: ids } });
  res.status(201).json({ message: `تم إرسال الجدول إلى ${created.length} طالب.`, ids: created });
});

app.post('/api/messages', requireAuth, (req, res) => {
  const { message, imageUrl, recipientId } = req.body || {};
  if ((!message || !String(message).trim()) && !imageUrl) return res.status(400).json({ message: 'اكتب رسالة أو أرفق صورة.' });
  if (String(message || '').length > 4000) return res.status(400).json({ message: 'يجب ألا تتجاوز الرسالة 4000 حرف.' });
  if (imageUrl && (typeof imageUrl !== 'string' || !imageUrl.startsWith('data:image/') || imageUrl.length > 1650000)) {
    return res.status(400).json({ message: 'الصورة غير صالحة أو حجمها كبير. اختر صورة أخرى.' });
  }

  const sender = getUserById(req.session.userId);
  let targetId = recipientId ? Number(recipientId) : null;
  if (!targetId && sender.role === 'student') {
    targetId = db.prepare("SELECT id FROM users WHERE role IN ('admin', 'super_admin') ORDER BY role = 'super_admin' DESC, id ASC LIMIT 1").get()?.id;
  }

  if (!targetId || !getUserById(targetId)) return res.status(400).json({ message: 'المستلم غير موجود.' });
  if (sender.role === 'student' && !['admin', 'super_admin'].includes(getUserById(targetId).role)) {
    return res.status(403).json({ message: 'لا يمكنك مراسلة هذا المستخدم.' });
  }
  if (sender.role !== 'student' && !getUserPermissions(sender.id).includes('manage_messages') && sender.role !== 'super_admin') {
    return res.status(403).json({ message: 'لا تملك صلاحية إرسال الرسائل.' });
  }

  const result = db.prepare(`
    INSERT INTO messages (senderId, recipientId, conversationId, message, imageUrl, readStatus, createdAt)
    VALUES (?, ?, ?, ?, ?, 'unread', datetime('now'))
  `).run(sender.id, targetId, [sender.id, targetId].sort((a, b) => a - b).join('-'), String(message || '').trim(), imageUrl || null);

  db.prepare(`
    INSERT INTO notifications (recipientId, type, title, message, relatedEntityType, relatedEntityId, isRead, createdAt)
    VALUES (?, 'message', 'رسالة جديدة', ?, 'message', ?, 0, datetime('now'))
  `).run(targetId, String(message || 'صورة مرفقة').trim().slice(0, 120), result.lastInsertRowid);

  res.status(201).json(db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid));
});

app.post('/api/messages/:id/read', requireAuth, (req, res) => {
  const result = db.prepare(`
    UPDATE messages SET readStatus = 'read'
    WHERE id = ? AND recipientId = ?
  `).run(Number(req.params.id), req.session.userId);
  if (result.changes === 0) return res.status(404).json({ message: 'الرسالة غير موجودة.' });
  res.json({ message: 'تم تعليم الرسالة كمقروءة.' });
});

app.post('/api/admin/announcements', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_announcements'), (req, res) => {
  const { title, content, imageUrl, targetGrade, publishAt, expiresAt } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ message: 'عنوان الإعلان مطلوب.' });

  const result = db.prepare(`
    INSERT INTO announcements (title, content, imageUrl, targetGrade, createdBy, visibility, publishAt, expiresAt, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, 'public', COALESCE(?, datetime('now')), ?, datetime('now'), datetime('now'))
  `).run(String(title).trim(), content || '', imageUrl || null, targetGrade || null, req.session.userId, publishAt || null, expiresAt || null);

  const announcement = db.prepare('SELECT * FROM announcements WHERE id = ?').get(result.lastInsertRowid);
  const students = db.prepare("SELECT id FROM users WHERE role = 'student' AND accountStatus = 'active'").all();
  for (const student of students) {
    db.prepare(`
      INSERT INTO notifications (recipientId, type, title, message, relatedEntityType, relatedEntityId, isRead, createdAt)
      VALUES (?, 'announcement', ?, ?, 'announcement', ?, 0, datetime('now'))
    `).run(student.id, announcement.title, announcement.content, announcement.id);
  }

  createAuditLog({ actorUserId: req.session.userId, action: 'create', entityType: 'announcement', entityId: announcement.id });
  res.status(201).json(announcement);
});

app.get('/api/admin/announcements', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_announcements'), (req, res) => {
  res.json(db.prepare('SELECT * FROM announcements ORDER BY createdAt DESC LIMIT 50').all());
});

app.delete('/api/admin/announcements/:id', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_announcements'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: 'رقم الإعلان غير صالح.' });

  const announcement = db.prepare('SELECT id FROM announcements WHERE id = ?').get(id);
  if (!announcement) return res.status(404).json({ message: 'الإعلان غير موجود.' });

  const deleteAnnouncement = db.transaction(() => {
    db.prepare("DELETE FROM notifications WHERE relatedEntityType = 'announcement' AND relatedEntityId = ?").run(id);
    db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
    createAuditLog({ actorUserId: req.session.userId, action: 'delete', entityType: 'announcement', entityId: id });
  });
  deleteAnnouncement();

  res.json({ message: 'تم حذف الإعلان بنجاح.' });
});

app.get('/api/admin/audit-logs', requireAuth, requireRole(ADMIN_ROLES), requirePermission('manage_settings'), (req, res) => {
  const rows = db.prepare(`
    SELECT a.*, u.name AS actorName
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.actorUserId
    ORDER BY a.createdAt DESC
    LIMIT 100
  `).all();
  res.json(rows);
});

app.post('/api/admin/promote/:id', requireAuth, requireRole(['super_admin']), (req, res) => {
  const userId = Number(req.params.id);
  const user = getUserById(userId);
  if (!user) return res.status(404).json({ message: 'المستخدم غير موجود.' });

  db.prepare("UPDATE users SET role = 'admin', updatedAt = datetime('now') WHERE id = ?").run(userId);
  createAuditLog({ actorUserId: req.session.userId, action: 'promote', entityType: 'user', entityId: userId });
  res.json({ message: 'تم ترقية المستخدم إلى مدير.', user: serializeUser(getUserById(userId)) });
});

app.post('/api/admin/demote/:id', requireAuth, requireRole(['super_admin']), (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isSafeInteger(userId) || userId < 1) return res.status(400).json({ message: 'رقم الحساب غير صالح.' });
  if (userId === Number(req.session.userId)) return res.status(400).json({ message: 'لا يمكنك إزالة صلاحيات حسابك الحالي.' });

  const target = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(userId);
  if (!target) return res.status(404).json({ message: 'الحساب غير موجود.' });
  if (target.role === 'super_admin') return res.status(403).json({ message: 'لا يمكن تحويل حساب المدير العام إلى طالب.' });
  if (target.role !== 'admin') return res.status(400).json({ message: 'هذا الحساب ليس أدمن.' });

  const demoteAdmin = db.transaction(() => {
    db.prepare("UPDATE users SET role = 'student', updatedAt = datetime('now') WHERE id = ?").run(userId);
    db.prepare('DELETE FROM admin_permissions WHERE userId = ?').run(userId);
    createAuditLog({ actorUserId: req.session.userId, action: 'demote_admin_to_student', entityType: 'user', entityId: userId, metadata: { previousRole: target.role } });
  });
  demoteAdmin();

  res.json({ message: `تمت إزالة صلاحيات الإدارة عن ${target.name} وتحويل حسابه إلى طالب.`, user: serializeUser(getUserById(userId)) });
});

app.get('/api/announcements', requireAuth, (req, res) => {
  const user = getUserById(req.session.userId);
  const rows = db.prepare(`
    SELECT * FROM announcements
    WHERE visibility = 'public'
      AND (publishAt IS NULL OR publishAt <= datetime('now'))
      AND (expiresAt IS NULL OR expiresAt > datetime('now'))
      AND (targetGrade IS NULL OR targetGrade = ? OR ? IN ('admin', 'super_admin'))
    ORDER BY createdAt DESC
    LIMIT 20
  `).all(user?.gradeId ? String(user.gradeId) : '', user?.role || 'student');
  res.json(rows);
});

// Academic Stages and Fields
app.get('/api/academic-stages', (req, res) => {
  const stages = db.prepare('SELECT * FROM academic_stages WHERE active = 1 ORDER BY id ASC').all();
  res.json(stages);
});

app.get('/api/academic-fields', (req, res) => {
  const fields = db.prepare('SELECT * FROM academic_fields WHERE active = 1 ORDER BY id ASC').all();
  res.json(fields);
});

app.get('/api/stage-subjects/:stageId/:fieldId?', (req, res) => {
  const stageId = Number(req.params.stageId);
  const fieldId = req.params.fieldId ? Number(req.params.fieldId) : null;
  
  let query = `
    SELECT DISTINCT s.*, sfs.displayOrder
    FROM subjects s
    JOIN stage_field_subjects sfs ON sfs.subjectId = s.id
    WHERE sfs.academicStageId = ?
  `;
  const params = [stageId];
  
  if (fieldId) {
    query += ` AND sfs.academicFieldId = ?`;
    params.push(fieldId);
  } else {
    query += ` AND sfs.academicFieldId IS NULL`;
  }
  
  query += ` ORDER BY sfs.displayOrder ASC, s.id ASC`;
  
  const subjects = db.prepare(query).all(...params);
  res.json(subjects);
});

// Public Chat System
app.get('/api/public-chat/messages', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT m.*, u.name as studentName, u.profilePicture, u.role as authorRole
    FROM public_chat_messages m
    JOIN users u ON u.id = m.studentId
    ORDER BY m.createdAt DESC
    LIMIT 100
  `).all();
  res.json(rows.reverse());
});

app.get('/api/student/chat-mute-status', requireAuth, (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user || user.role !== 'student') {
    return res.status(403).json({ message: 'يجب أن تكون طالباً.' });
  }

  const mute = db.prepare(`
    SELECT * FROM chat_mutes
    WHERE studentId = ? AND mutedUntil > datetime('now')
    ORDER BY mutedUntil DESC
    LIMIT 1
  `).get(user.id);

  res.json({ isMuted: !!mute, isPermanent: Boolean(mute?.mutedUntil?.startsWith('9999-')), mute: mute || null });
});

app.post('/api/public-chat/message', requireAuth, (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user || !['student', ...ADMIN_ROLES].includes(user.role)) {
    return res.status(403).json({ message: 'ليس لديك صلاحية المشاركة في الشات العام.' });
  }

  const { message, imageUrl } = req.body || {};
  if ((!message || !String(message).trim()) && !imageUrl) {
    return res.status(400).json({ message: 'اكتب رسالة أو أرفق صورة.' });
  }
  if (String(message || '').length > 4000) {
    return res.status(400).json({ message: 'يجب ألا تتجاوز الرسالة 4000 حرف.' });
  }

  if (user.role === 'student') {
    const mute = db.prepare(`
      SELECT * FROM chat_mutes
      WHERE studentId = ? AND mutedUntil > datetime('now')
    `).get(user.id);

    if (mute) {
      return res.status(403).json({ message: 'لا يمكنك المشاركة في الشات العام حالياً بسبب الحظر.' });
    }
  }

  const result = db.prepare(`
    INSERT INTO public_chat_messages (studentId, message, imageUrl, createdAt)
    VALUES (?, ?, ?, datetime('now'))
  `).run(user.id, String(message || '').trim(), imageUrl || null);

  createAuditLog({ actorUserId: user.id, action: 'public_chat_message', entityType: 'public_chat_message', entityId: result.lastInsertRowid });
  res.status(201).json({ id: result.lastInsertRowid, message: 'تم إرسال الرسالة بنجاح.' });
});

app.delete('/api/admin/public-chat/messages/:messageId', requireAuth, requireRole(ADMIN_ROLES), (req, res) => {
  const messageId = Number(req.params.messageId);
  if (!Number.isSafeInteger(messageId) || messageId < 1) return res.status(400).json({ message: 'رقم الرسالة غير صالح.' });
  const result = db.prepare('DELETE FROM public_chat_messages WHERE id = ?').run(messageId);
  if (result.changes === 0) return res.status(404).json({ message: 'الرسالة غير موجودة أو حُذفت مسبقاً.' });

  createAuditLog({ actorUserId: req.session.userId, action: 'delete_public_chat_message', entityType: 'public_chat_message', entityId: messageId });
  res.json({ message: 'تم حذف الرسالة.' });
});

app.post('/api/admin/chat/mute/:studentId', requireAuth, requireRole(ADMIN_ROLES), (req, res) => {
  const studentId = Number(req.params.studentId);
  const { durationMinutes, reason } = req.body || {};
  const student = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'student'").get(studentId);
  if (!student) return res.status(404).json({ message: 'الطالب غير موجود.' });

  const duration = Number(durationMinutes);
  if (duration !== -1 && (!Number.isInteger(duration) || duration < 1 || duration > 10080)) {
    return res.status(400).json({ message: 'اختر حظراً دائماً أو مدة بين دقيقة وأسبوع.' });
  }

  const mutedUntil = duration === -1 ? '9999-12-31 23:59:59' : new Date(Date.now() + duration * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO chat_mutes (studentId, mutedBy, reason, mutedUntil, createdAt)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(studentId, req.session.userId, reason || '', mutedUntil);

  createAuditLog({ actorUserId: req.session.userId, action: duration === -1 ? 'ban_from_public_chat' : 'mute_chat', entityType: 'chat_mute', entityId: studentId, metadata: { durationMinutes: duration, reason } });
  res.json({ message: duration === -1 ? 'تم حظر الطالب من الشات العام حتى إلغاء الحظر.' : `تم كتم صوت الطالب لمدة ${duration} دقيقة.` });
});

app.post('/api/admin/chat/unmute/:studentId', requireAuth, requireRole(ADMIN_ROLES), (req, res) => {
  const studentId = Number(req.params.studentId);
  const result = db.prepare(`
    UPDATE chat_mutes
    SET mutedUntil = datetime('now')
    WHERE studentId = ? AND mutedUntil > datetime('now')
  `).run(studentId);

  if (result.changes === 0) {
    return res.status(404).json({ message: 'لا توجد حظر نشط لهذا الطالب.' });
  }

  createAuditLog({ actorUserId: req.session.userId, action: 'unban_from_public_chat', entityType: 'chat_mute', entityId: studentId });
  res.json({ message: 'تم إلغاء الحظر عن الشات العام.' });
});

app.get('/api/admin/chat/mutes', requireAuth, requireRole(ADMIN_ROLES), (req, res) => {
  const rows = db.prepare(`
    SELECT m.*, u.name as studentName, u.email as studentEmail, admin.name as adminName
    FROM chat_mutes m
    JOIN users u ON u.id = m.studentId
    LEFT JOIN users admin ON admin.id = m.mutedBy
    ORDER BY m.createdAt DESC
  `).all();
  res.json(rows);
});

app.use(express.static(distDirectory));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(distDirectory, 'index.html'), (error) => {
    if (error) next(error);
  });
});

app.listen(PORT, () => {
  ensureSchema();
  ensureSuperAdmin();
  console.log(`Tawjihi Time server listening on http://localhost:${PORT}`);
});
