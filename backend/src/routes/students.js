const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { verifyToken, requireAdmin, requireSuperAdmin, requirePermission } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');
const { recordStudentDailyActivity } = require('../utils/studentStreak');

async function getStudentsListResponse(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { status: 400, message: 'Validation error', errors: errors.array() } });
    }

    const page = req.query.page || 1;
    const perPage = req.query.perPage || 20;
    const offset = (page - 1) * perPage;
    const search = req.query.search;
    const grade = req.query.grade;
    const subject = req.query.subject;
    const status = req.query.status || 'active';
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder || 'DESC';

    let whereClause = `WHERE u.role = 'student' AND u.account_status = ?`;
    let params = [status];
    let paramCount = 1;

    if (search) {
      whereClause += ` AND (u.name LIKE ? OR u.email LIKE ?)`;
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      paramCount++;
    }

    if (grade) {
      whereClause += ` AND u.grade_id = ?`;
      params.push(grade);
      paramCount++;
    }

    if (subject) {
      whereClause = `
        WHERE u.role = 'student' AND u.account_status = ?
        AND EXISTS (
          SELECT 1 FROM student_subject_enrollments sse
          WHERE sse.student_id = u.id AND sse.subject_id = ?
        )
      `;
      params = [status, subject];
      paramCount = 2;
    }

    const countQuery = `SELECT COUNT(*) as total FROM users u ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT
        u.id,
        u.name,
        u.email,
        u.profile_picture,
        u.grade_id,
        g.name as grade_name,
        u.account_status,
        u.created_at,
        u.last_login_at,
        (SELECT COUNT(*) FROM student_subject_enrollments WHERE student_id = u.id) as subjects_count
      FROM users u
      LEFT JOIN grades g ON u.grade_id = g.id
      ${whereClause}
      ORDER BY u.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    params.push(perPage, offset);
    const result = await pool.query(query, params);

    return res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage)
      }
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    return res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
}

async function getStudentDashboardResponse(req, res, studentId) {
  try {
    const userId = req.user.id;

    if (req.user.role === 'student' && userId !== parseInt(studentId)) {
      return res.status(403).json({
        error: { status: 403, message: 'Cannot view other student dashboard' }
      });
    }

    if (req.user.role === 'student') {
      await recordStudentDailyActivity(userId);
    }

    const userResult = await pool.query(
      `SELECT u.id, u.name, u.email, u.profile_picture, u.grade_id, u.account_status,
              st.name as stage_name, af.name as field_name
       FROM users u
       LEFT JOIN academic_stages st ON st.id = u.stage_id
       LEFT JOIN academic_fields af ON af.id = u.academic_field_id
       WHERE u.id = ? AND u.role = 'student'`,
      [studentId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: { status: 404, message: 'Student not found' } });
    }

    const student = userResult.rows[0];

    const subjectsResult = await pool.query(
      `SELECT COUNT(*) as total FROM student_subject_enrollments WHERE student_id = ?`,
      [studentId]
    );

    const examsResult = await pool.query(
      `SELECT e.id, e.title, e.subject_id, s.name as subject_name, e.total_marks
      FROM exams e
      JOIN subjects s ON e.subject_id = s.id
      WHERE e.grade_id = (SELECT grade_id FROM users WHERE id = ?)
      AND e.visibility = true
      AND e.deleted_at IS NULL
      LIMIT 5`,
      [studentId]
    );

    const resultsResult = await pool.query(
      `SELECT er.id, e.title, er.score, er.total_marks, er.percentage, er.created_at, er.passed
      FROM exam_results er
      JOIN exams e ON er.exam_id = e.id
      WHERE er.student_id = ?
      ORDER BY er.created_at DESC
      LIMIT 5`,
      [studentId]
    );

    const notesResult = await pool.query(
      `SELECT COUNT(*) as unread FROM student_notes WHERE student_id = ? AND is_read = false`,
      [studentId]
    );

    const announcementsResult = await pool.query(
      `SELECT id, title, content, image_url, created_at
      FROM announcements
      WHERE visibility = true
      AND (target_grade_id IS NULL OR target_grade_id = (SELECT grade_id FROM users WHERE id = ?))
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      AND (publish_at IS NULL OR publish_at <= datetime('now'))
      ORDER BY created_at DESC
      LIMIT 3`,
      [studentId]
    );

    return res.json({
      success: true,
      dashboard: {
        student,
        subjectsCount: subjectsResult.rows[0].total,
        availableExams: examsResult.rows,
        recentResults: resultsResult.rows,
        unreadNotes: notesResult.rows[0].unread,
        announcements: announcementsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
}

// Create student manually by admin
router.post(
  '/',
  verifyToken,
  requireSuperAdmin,
  [
    body('name').trim().notEmpty().isLength({ min: 2, max: 255 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('gradeId').optional().isInt().toInt(),
    body('stageId').optional().isInt().toInt(),
    body('academicFieldId').optional().isInt().toInt(),
    body('status').optional().isIn(['active', 'inactive', 'suspended']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error', errors: errors.array() } });
      }

      const { name, email, password, gradeId, stageId, academicFieldId, status = 'active' } = req.body;

      if (stageId && academicFieldId) {
        const fieldCheck = await pool.query(
          'SELECT id FROM academic_fields WHERE id = ? AND stage_id = ? AND active = TRUE',
          [academicFieldId, stageId]
        );

        if (fieldCheck.rows.length === 0) {
          return res.status(400).json({ error: { status: 400, message: 'Academic field does not belong to the selected stage' } });
        }
      }

      const existing = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: { status: 409, message: 'Student with this email already exists' }
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const result = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, account_status, grade_id, stage_id, academic_field_id, created_at, updated_at)
         VALUES (?, ?, ?, 'student', ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [name, email, passwordHash, status, gradeId || null, stageId || null, academicFieldId || null]
      );

      // Fetch created student
      const student = await pool.query(
        'SELECT id, name, email, role, account_status, grade_id, stage_id, academic_field_id FROM users WHERE email = ?',
        [email]
      );

      const newStudent = student?.rows?.[0] || {
        id: null,
        name,
        email,
        role: 'student',
        account_status: status,
        grade_id: gradeId || null,
        stage_id: stageId || null,
        academic_field_id: academicFieldId || null
      };

      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
         VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, 'student_created', 'user', newStudent.id, JSON.stringify({ email, method: 'manual_admin_creation' })]
      );

      res.status(201).json({
        success: true,
        student: newStudent,
        message: 'Student created successfully. Please provide the email and password to the student.'
      });
    } catch (error) {
      console.error('Error creating student:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Admin list alias for frontend compatibility
router.get(
  '/list',
  verifyToken,
  requireAdmin,
  requirePermission('view_students'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('perPage').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().trim().isLength({ min: 1 }),
    query('grade').optional().isInt().toInt(),
    query('subject').optional().isInt().toInt(),
    query('status').optional().isIn(['active', 'inactive', 'suspended']),
    query('sortBy').optional().isIn(['name', 'email', 'created_at', 'last_login_at']),
    query('sortOrder').optional().isIn(['ASC', 'DESC']),
  ],
  getStudentsListResponse
);

// Get all students (with pagination, search, filter)
router.get(
  '/',
  verifyToken,
  requireAdmin,
  requirePermission('view_students'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('perPage').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().trim().isLength({ min: 1 }),
    query('grade').optional().isInt().toInt(),
    query('subject').optional().isInt().isInt(),
    query('status').optional().isIn(['active', 'inactive', 'suspended']),
    query('sortBy').optional().isIn(['name', 'email', 'created_at', 'last_login_at']),
    query('sortOrder').optional().isIn(['ASC', 'DESC']),
  ],
  getStudentsListResponse
);

// Get single student details
router.get(
  '/:id(\\d+)',
  verifyToken,
  requireAdmin,
  requirePermission('view_students'),
  [
    body('id').isInt().toInt(),
  ],
  async (req, res) => {
    try {
      const studentId = req.params.id;

      // Get student details
      const userResult = await pool.query(
        `SELECT
          u.id,
          u.name,
          u.email,
          u.profile_picture,
          u.role,
          u.grade_id,
          g.name as grade_name,
          u.account_status,
          u.created_at,
          u.updated_at,
          u.last_login_at
        FROM users u
        LEFT JOIN grades g ON u.grade_id = g.id
        WHERE u.id = ? AND u.role = 'student'`,
        [studentId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Student not found' } });
      }

      const student = userResult.rows[0];

      // Get enrolled subjects
      const subjectsResult = await pool.query(
        `SELECT s.id, s.name, s.description, g.name as grade_name
        FROM student_subject_enrollments sse
        JOIN subjects s ON sse.subject_id = s.id
        LEFT JOIN grades g ON s.grade_id = g.id
        WHERE sse.student_id = ? AND s.deleted_at IS NULL
        ORDER BY s.name`,
        [studentId]
      );

      // Get exam attempts count
      const examsResult = await pool.query(
        `SELECT COUNT(*) as attempts, SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as completed
        FROM exam_attempts
        WHERE student_id = ?`,
        [studentId]
      );

      // Get notes count
      const notesResult = await pool.query(
        `SELECT COUNT(*) as total, SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) as unread
        FROM student_notes
        WHERE student_id = ?`,
        [studentId]
      );

      res.json({
        success: true,
        student: {
          ...student,
          subjects: subjectsResult.rows,
          examStats: examsResult.rows[0],
          noteStats: notesResult.rows[0]
        }
      });
    } catch (error) {
      console.error('Error fetching student:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Update student profile
router.put(
  '/:id',
  verifyToken,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const studentId = parseInt(req.params.id);
      const { name, gradeId } = req.body;

      // Students can only update their own profile
      if (req.user.role === 'student' && userId !== studentId) {
        return res.status(403).json({
          error: { status: 403, message: 'Cannot update other student profiles' }
        });
      }

      // Validate input
      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          error: { status: 400, message: 'Name is required' }
        });
      }

      // Update profile
      await pool.query(
        `UPDATE users SET name = ?, grade_id = ?, updated_at = datetime('now')
        WHERE id = ? AND role = 'student'`,
        [name, gradeId, studentId]
      );

      // Log action
      if (req.user.role === 'admin' || req.user.role === 'super_admin') {
        await pool.query(
          `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
          VALUES (?, ?, ?, ?)`,
          [req.user.id, 'student_profile_updated', 'user', studentId]
        );
      }

      // Re-fetch to get updated data
      const updated = await pool.query(
        'SELECT id, name, email, profile_picture, grade_id, account_status FROM users WHERE id = ?',
        [studentId]
      );

      res.json({
        success: true,
        student: updated.rows[0],
        message: 'Profile updated successfully'
      });
    } catch (error) {
      console.error('Error updating student:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Get student's enrolled subjects
router.get('/:id/subjects', verifyToken, async (req, res) => {
  try {
    const studentId = req.params.id;
    const userId = req.user.id;

    // Students can only view their own subjects
    if (req.user.role === 'student' && userId !== parseInt(studentId)) {
      return res.status(403).json({
        error: { status: 403, message: 'Cannot view other student subjects' }
      });
    }

    const result = await pool.query(
      `SELECT s.id, s.name, s.description, g.name as grade_name, sse.created_at as enrolled_at
      FROM student_subject_enrollments sse
      JOIN subjects s ON sse.subject_id = s.id
      LEFT JOIN grades g ON s.grade_id = g.id
      WHERE sse.student_id = ? AND s.deleted_at IS NULL
      ORDER BY s.name`,
      [studentId]
    );

    res.json({
      success: true,
      subjects: result.rows
    });
  } catch (error) {
    console.error('Error fetching student subjects:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

// Student private schedules: read-only table for the student, uploadable only by admin
router.get('/:id/schedules', verifyToken, async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    const userId = req.user.id;

    if (req.user.role === 'student' && userId !== studentId) {
      return res.status(403).json({
        error: { status: 403, message: 'لا يمكنك الوصول إلى جداول طالب آخر' }
      });
    }

    const result = await pool.query(
      `SELECT id, student_id, uploaded_by, image_url, file_name, created_at
       FROM student_schedules
       WHERE student_id = ?
       ORDER BY created_at DESC`,
      [studentId]
    );

    res.json({
      success: true,
      schedules: result.rows
    });
  } catch (error) {
    console.error('Error fetching student schedules:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

router.post(
  '/:id/schedules',
  verifyToken,
  requireAdmin,
  requirePermission('manage_students'),
  [
    body('imageUrl').trim().notEmpty(),
    body('fileName').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: { status: 400, message: 'Validation error', details: errors.array() }
        });
      }

      const studentId = Number(req.params.id);
      const { imageUrl, fileName } = req.body;

      const studentCheck = await pool.query(
        'SELECT id, role FROM users WHERE id = ? AND role = ?',
        [studentId, 'student']
      );

      if (studentCheck.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Student not found' } });
      }

      const insertResult = await pool.query(
        `INSERT INTO student_schedules (student_id, uploaded_by, image_url, file_name, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [studentId, req.user.id, imageUrl, fileName || 'schedule.png']
      );

      const scheduleResult = await pool.query(
        `SELECT id, student_id, uploaded_by, image_url, file_name, created_at
         FROM student_schedules
         WHERE id = ?`,
        [insertResult.rows[0]?.id || insertResult.lastID]
      );

      await pool.query(
        `INSERT INTO notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
         VALUES (?, 'student_schedule', 'جدول خاص جديد', 'أرسل لك المشرف جدولًا خاصًا جديدًا', 'student_schedule', ?)
         ON CONFLICT(recipient_id, related_entity_type, related_entity_id) DO NOTHING`,
        [studentId, scheduleResult.rows[0].id]
      );

      res.status(201).json({
        success: true,
        schedule: scheduleResult.rows[0]
      });
    } catch (error) {
      console.error('Error uploading student schedule:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Enroll student in subjects
router.post(
  '/:id/subjects',
  verifyToken,
  requireAdmin,
  requirePermission('manage_students'),
  [
    body('subjectIds').isArray().notEmpty(),
    body('subjectIds.*').isInt(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Invalid subject IDs' } });
      }

      const studentId = req.params.id;
      const { subjectIds } = req.body;

      // Verify student exists
      const studentCheck = await pool.query(
        'SELECT id FROM users WHERE id = ? AND role = ?',
        [studentId, 'student']
      );

      if (studentCheck.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Student not found' } });
      }

      // Enroll in subjects
      for (const subjectId of subjectIds) {
        await pool.query(
          `INSERT OR IGNORE INTO student_subject_enrollments (student_id, subject_id)
          VALUES (?, ?)`,
          [studentId, subjectId]
        );
      }

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
        VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, 'student_subjects_enrolled', 'user', studentId, JSON.stringify({ subjects: subjectIds })]
      );

      res.json({
        success: true,
        message: `Student enrolled in ${subjectIds.length} subjects`
      });
    } catch (error) {
      console.error('Error enrolling student:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Student dashboard alias for frontend compatibility
router.get(
  '/dashboard',
  verifyToken,
  async (req, res) => {
    const studentId = req.user.id;
    return getStudentDashboardResponse(req, res, studentId);
  }
);

router.get('/streak', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: { status: 403, message: 'Student access required' } });
    }

    const result = await pool.query(
      'SELECT current_streak, last_login_at FROM student_streaks WHERE student_id = ?',
      [req.user.id]
    );

    res.json({
      success: true,
      streak: result.rows[0]?.current_streak || 0,
      lastLoginAt: result.rows[0]?.last_login_at || null
    });
  } catch (error) {
    console.error('Error fetching student streak:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

// Get student dashboard data
router.get(
  '/:id/dashboard',
  verifyToken,
  async (req, res) => {
    const studentId = req.params.id;
    return getStudentDashboardResponse(req, res, studentId);
  }
);

// Change student account status
router.patch(
  '/:id/status',
  verifyToken,
  requireAdmin,
  requirePermission('manage_students'),
  [
    body('status').isIn(['active', 'inactive', 'suspended']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Invalid status' } });
      }

      const studentId = req.params.id;
      const { status } = req.body;

      // Check student exists
      const check = await pool.query(
        'SELECT id, account_status FROM users WHERE id = ? AND role = ?',
        [studentId, 'student']
      );

      if (check.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Student not found' } });
      }

      const oldStatus = check.rows[0].account_status;

      // Update status
      await pool.query(
        `UPDATE users SET account_status = ?, updated_at = datetime('now')
        WHERE id = ?`,
        [status, studentId]
      );

      // Fetch updated student
      const result = await pool.query(
        'SELECT id, name, email, account_status FROM users WHERE id = ?',
        [studentId]
      );

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
        VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, 'student_status_changed', 'user', studentId, JSON.stringify({ from: oldStatus, to: status })]
      );

      res.json({
        success: true,
        student: result.rows[0],
        message: `Student status changed to ${status}`
      });
    } catch (error) {
      console.error('Error changing status:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

module.exports = router;
