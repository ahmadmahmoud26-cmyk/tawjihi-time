const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { verifyToken, requireAdmin, requireSuperAdmin, requirePermission, PRIMARY_SUPER_ADMIN_EMAIL } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');

const PROGRAM_STAGE_NAMES = ['تكميلي 2008', '2009 نظامي', 'تكميلي 2009', '2010 نظامي'];
const FIELD_REQUIRED_STAGES = ['تكميلي 2008', '2009 نظامي'];

async function getProgramCatalog() {
  const stages = await pool.query(
    `SELECT id, name FROM academic_stages
     WHERE name IN (?, ?, ?, ?) AND active = TRUE
     ORDER BY display_order ASC`,
    PROGRAM_STAGE_NAMES
  );
  const fields = await pool.query(
    `SELECT af.id, af.stage_id, af.name
     FROM academic_fields af
     JOIN academic_stages st ON st.id = af.stage_id
     WHERE st.name IN (?, ?) AND af.active = TRUE
     ORDER BY af.display_order ASC`,
    FIELD_REQUIRED_STAGES
  );
  const fieldSubjects = await pool.query(
    `SELECT sfs.stage_id, sfs.field_id, s.id as subject_id, s.name as subject_name
     FROM stage_field_subjects sfs
     JOIN academic_stages st ON st.id = sfs.stage_id
     JOIN subjects s ON s.id = sfs.subject_id
     WHERE st.name IN (?, ?) AND sfs.active = TRUE AND s.deleted_at IS NULL
     ORDER BY s.display_order ASC`,
    FIELD_REQUIRED_STAGES
  );
  const stageSubjects = await pool.query(
    `SELECT ss.stage_id, s.id as subject_id, s.name as subject_name
     FROM stage_subjects ss
     JOIN academic_stages st ON st.id = ss.stage_id
     JOIN subjects s ON s.id = ss.subject_id
     WHERE st.name IN (?, ?) AND ss.active = TRUE AND s.deleted_at IS NULL
     ORDER BY s.display_order ASC`,
    ['تكميلي 2009', '2010 نظامي']
  );

  return { stages: stages.rows, fields: fields.rows, fieldSubjects: fieldSubjects.rows, stageSubjects: stageSubjects.rows };
}

async function validateStudentProgram(stageId, fieldId, subjectIds) {
  const stageResult = await pool.query(
    'SELECT id, name FROM academic_stages WHERE id = ? AND active = TRUE',
    [stageId]
  );
  const stage = stageResult.rows[0];
  if (!stage || !PROGRAM_STAGE_NAMES.includes(stage.name)) {
    return { error: 'يجب اختيار مرحلة الطالب الصفية الصحيحة' };
  }

  const requiresField = FIELD_REQUIRED_STAGES.includes(stage.name);
  if (requiresField && !fieldId) {
    return { error: 'يجب اختيار الحقل الدراسي لهذه المرحلة' };
  }
  if (!requiresField && fieldId) {
    return { error: 'هذه المرحلة لا تحتاج إلى حقل دراسي' };
  }

  let allowedSubjects;
  if (requiresField) {
    const fieldResult = await pool.query(
      'SELECT id FROM academic_fields WHERE id = ? AND stage_id = ? AND active = TRUE',
      [fieldId, stage.id]
    );
    if (fieldResult.rows.length === 0) {
      return { error: 'الحقل الدراسي لا يتبع للمرحلة المختارة' };
    }
    allowedSubjects = await pool.query(
      'SELECT subject_id FROM stage_field_subjects WHERE stage_id = ? AND field_id = ? AND active = TRUE',
      [stage.id, fieldId]
    );
  } else {
    allowedSubjects = await pool.query(
      'SELECT subject_id FROM stage_subjects WHERE stage_id = ? AND active = TRUE',
      [stage.id]
    );
  }

  const allowedSubjectIds = new Set(allowedSubjects.rows.map(item => Number(item.subject_id)));
  const selectedSubjectIds = [...new Set((subjectIds || []).map(Number))];
  if (selectedSubjectIds.some(subjectId => !allowedSubjectIds.has(subjectId))) {
    return { error: 'تم اختيار مادة غير متاحة للمرحلة أو الحقل المحدد' };
  }

  return { stage, subjectIds: selectedSubjectIds, fieldId: fieldId || null };
}

async function replaceStudentSubjects(studentId, subjectIds) {
  await pool.query('DELETE FROM student_subject_enrollments WHERE student_id = ?', [studentId]);
  for (const subjectId of subjectIds) {
    await pool.query(
      'INSERT INTO student_subject_enrollments (student_id, subject_id) VALUES (?, ?)',
      [studentId, subjectId]
    );
  }
}

// List admin users with their permissions
router.get(
  '/users/list',
  verifyToken,
  requireSuperAdmin,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('perPage').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().trim(),
  ],
  async (req, res) => {
    try {
      const page = req.query.page || 1;
      const perPage = req.query.perPage || 20;
      const offset = (page - 1) * perPage;
      const search = req.query.search;

      let whereClause = "WHERE u.role IN ('admin', 'super_admin')";
      let params = [];
      let paramCount = 1;

      if (search) {
        whereClause += ` AND u.name LIKE ?`;
        params.push(`%${search}%`);
        paramCount++;
      }

      // Get admin users with permission counts
      const result = await pool.query(
        `SELECT
          u.id,
          u.name,
          u.email,
          u.role,
          u.account_status,
          COUNT(ap.id) as permission_count,
          u.created_at
        FROM users u
        LEFT JOIN admin_permissions ap ON u.id = ap.admin_id AND ap.is_granted = TRUE
        ${whereClause}
        GROUP BY u.id, u.name, u.email, u.role, u.account_status, u.created_at
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?`,
        [...params, perPage, offset]
      );

      // Get count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM users u ${whereClause}`,
        params
      );

      res.json({
        success: true,
        admins: result.rows,
        pagination: {
          page,
          perPage,
          total: parseInt(countResult.rows[0].total)
        }
      });
    } catch (error) {
      console.error('Error fetching admin users:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Get admin permissions
router.get(
  '/users/:adminId/permissions',
  verifyToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const adminId = req.params.adminId;

      const result = await pool.query(
        `SELECT
          ap.id,
          ap.permission_name,
          ap.is_granted,
          ap.created_at
        FROM admin_permissions ap
        WHERE ap.admin_id = ? AND ap.is_granted = TRUE`,
        [adminId]
      );

      res.json({
        success: true,
        permissions: result.rows.map(p => p.permission_name)
      });
    } catch (error) {
      console.error('Error fetching admin permissions:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Grant permission to admin
router.post(
  '/users/:adminId/permissions',
  verifyToken,
  requireSuperAdmin,
  [
    body('permission').trim().notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
      }

      const adminId = req.params.adminId;
      const { permission } = req.body;

      // Verify admin exists
      const adminCheck = await pool.query(
        "SELECT id FROM users WHERE id = ? AND role IN ('admin', 'super_admin')",
        [adminId]
      );

      if (adminCheck.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Admin not found' } });
      }

      // Check if permission already exists
      const existingCheck = await pool.query(
        `SELECT id FROM admin_permissions WHERE admin_id = ? AND permission_name = ? AND is_granted = TRUE`,
        [adminId, permission]
      );

      if (existingCheck.rows.length > 0) {
        return res.status(400).json({
          error: { status: 400, message: 'Permission already granted' }
        });
      }

      await pool.query(
        `INSERT INTO admin_permissions (admin_id, permission_name, is_granted, granted_by, created_at)
        VALUES (?, ?, TRUE, ?, datetime('now'))`,
        [adminId, permission, req.user.id]
      );

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)`,
        [req.user.id, 'permission_granted', 'admin', adminId]
      );

      res.json({
        success: true,
        message: `Permission '${permission}' granted successfully`
      });
    } catch (error) {
      console.error('Error granting permission:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Revoke permission from admin
router.delete(
  '/users/:adminId/permissions/:permission',
  verifyToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const adminId = req.params.adminId;
      const permission = req.params.permission;

      const result = await pool.query(
        `UPDATE admin_permissions
        SET is_granted = FALSE, granted_by = ?
        WHERE admin_id = ? AND permission_name = ? AND is_granted = TRUE`,
        [req.user.id, adminId, permission]
      );

      if (result.changes === 0) {
        return res.status(404).json({
          error: { status: 404, message: 'Permission not found' }
        });
      }

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)`,
        [req.user.id, 'permission_revoked', 'admin', adminId]
      );

      res.json({
        success: true,
        message: `Permission '${permission}' revoked successfully`
      });
    } catch (error) {
      console.error('Error revoking permission:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

router.post(
  '/create-admin',
  verifyToken,
  requireSuperAdmin,
  [
    body('name').trim().notEmpty().isLength({ min: 2, max: 255 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('permissions').optional().isArray(),
    body('accountStatus').optional().isIn(['active', 'inactive']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
      }

      const { name, email, password, permissions = [], accountStatus = 'active' } = req.body;
      const existing = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: { status: 409, message: 'Admin with this email already exists' } });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await pool.query(
        `INSERT INTO users (name, email, password_hash, role, account_status, created_at, updated_at)
         VALUES (?, ?, ?, 'admin', ?, datetime('now'), datetime('now'))`,
        [name, email, passwordHash, accountStatus]
      );

      // Fetch created admin
      const adminResult = await pool.query('SELECT id, name, email, role, account_status FROM users WHERE email = ?', [email]);
      const admin = adminResult?.rows?.[0] || {
        id: null,
        name,
        email,
        role: 'admin',
        account_status: 'active'
      };

      const permissionList = permissions.length > 0 ? permissions : ['manage_students', 'view_results', 'manage_notes', 'view_audit_logs'];

      for (const permission of permissionList) {
        await pool.query(
          `INSERT OR IGNORE INTO admin_permissions (admin_id, permission_name, is_granted, granted_by, created_at)
           VALUES (?, ?, TRUE, ?, datetime('now'))`,
          [admin.id, permission, req.user.id]
        );
      }

      res.status(201).json({ success: true, admin, message: 'Admin created successfully' });
    } catch (error) {
      console.error('Error creating admin:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

router.get(
  '/dashboard',
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const stats = {};

      const queries = [
        "SELECT COUNT(*) AS total_students FROM users WHERE role = 'student'",
        "SELECT COUNT(*) AS active_students FROM users WHERE role = 'student' AND account_status = 'active'",
        "SELECT COUNT(*) AS new_students FROM users WHERE role = 'student' AND created_at >= datetime('now', '-30 days')",
        "SELECT COUNT(*) AS total_subjects FROM subjects WHERE deleted_at IS NULL",
        "SELECT COUNT(*) AS total_units FROM units WHERE deleted_at IS NULL",
        "SELECT COUNT(*) AS total_lessons FROM lessons WHERE deleted_at IS NULL",
        "SELECT COUNT(*) AS total_exams FROM exams WHERE deleted_at IS NULL",
        "SELECT COUNT(*) AS total_attempts FROM exam_attempts",
        "SELECT COUNT(*) AS unread_notes FROM student_notes WHERE is_read = false",
        "SELECT COUNT(*) AS unread_messages FROM messages WHERE is_read = false OR is_read IS NULL",
        "SELECT COUNT(*) AS recent_registrations FROM users WHERE role = 'student' AND created_at >= datetime('now', '-7 days')",
        "SELECT COUNT(*) AS recent_activity FROM audit_logs WHERE created_at >= datetime('now', '-7 days')"
      ];

      for (const query of queries) {
        let result;
        try {
          result = await pool.query(query);
        } catch (error) {
          continue;
        }

        if (!result || !Array.isArray(result.rows)) continue;

        const row = result.rows[0] || {};
        const entries = Object.entries(row);

        if (entries.length === 0) continue;

        const [key, value] = entries[0];
        const normalizedValue = Number(value ?? 0);

        if (key === 'total_students' || key === 'students') stats.totalStudents = normalizedValue;
        if (key === 'active_students') stats.activeStudents = normalizedValue;
        if (key === 'new_students') stats.newStudents = normalizedValue;
        if (key === 'total_subjects') stats.totalSubjects = normalizedValue;
        if (key === 'total_units') stats.totalUnits = normalizedValue;
        if (key === 'total_lessons') stats.totalLessons = normalizedValue;
        if (key === 'total_exams') stats.totalExams = normalizedValue;
        if (key === 'total_attempts') stats.totalExamAttempts = normalizedValue;
        if (key === 'unread_notes') stats.unreadNotes = normalizedValue;
        if (key === 'unread_messages') stats.unreadMessages = normalizedValue;
        if (key === 'recent_registrations' || key === 'registrations') stats.recentRegistrations = normalizedValue;
        if (key === 'recent_activity' || key === 'activity_count') stats.recentActivity = normalizedValue;
      }

      let recentLogs = [];
      try {
        const recentLogsResult = await pool.query(
          `SELECT al.id, u.name AS actor_name, al.action, al.entity_type, al.created_at
           FROM audit_logs al
           LEFT JOIN users u ON u.id = al.actor_id
           ORDER BY al.created_at DESC
           LIMIT 5`
        );

        recentLogs = recentLogsResult && Array.isArray(recentLogsResult.rows) ? recentLogsResult.rows : [];
      } catch (error) {
        recentLogs = [];
      }

      res.json({
        success: true,
        stats,
        recentActivity: recentLogs
      });
    } catch (error) {
      console.error('Error fetching admin dashboard stats:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

router.patch(
  '/users/:id/status',
  verifyToken,
  requireSuperAdmin,
  [body('status').isIn(['active', 'inactive', 'suspended'])],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
      }

      const adminId = req.params.id;
      const { status } = req.body;

      const targetResult = await pool.query('SELECT email, role FROM users WHERE id = ?', [adminId]);
      const target = targetResult.rows[0];
      if (!target) {
        return res.status(404).json({ error: { status: 404, message: 'Admin not found' } });
      }

      if (target.email.toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL || target.role === 'super_admin') {
        return res.status(403).json({ error: { status: 403, message: 'Super admin status cannot be changed through this route' } });
      }

      await pool.query(
        `UPDATE users SET account_status = ?, updated_at = datetime('now')
         WHERE id = ? AND role IN ('admin', 'super_admin')`,
        [status, adminId]
      );

      const result = await pool.query(
        'SELECT id, name, email, role, account_status FROM users WHERE id = ?',
        [adminId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Admin not found' } });
      }

      res.json({ success: true, admin: result.rows[0], message: 'Admin status updated' });
    } catch (error) {
      console.error('Error updating admin status:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

router.delete('/users/:id', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const adminId = Number(req.params.id);
    const targetResult = await pool.query(
      "SELECT id, email, name, role FROM users WHERE id = ? AND role = 'admin'",
      [adminId]
    );
    const target = targetResult.rows[0];

    if (!target) {
      return res.status(404).json({ error: { status: 404, message: 'Admin not found' } });
    }
    if (target.email.toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL) {
      return res.status(403).json({ error: { status: 403, message: 'Primary Super Admin cannot be removed' } });
    }

    await pool.query("DELETE FROM users WHERE id = ? AND role = 'admin'", [adminId]);
    await pool.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'admin_deleted', 'admin', adminId, JSON.stringify({ email: target.email, name: target.name })]
    );

    res.json({ success: true, message: 'Admin removed successfully' });
  } catch (error) {
    console.error('Error removing admin:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

// Promote student to admin
router.post(
  '/promote-student',
  verifyToken,
  requireSuperAdmin,
  [
    body('studentId').isInt().toInt(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
      }

      const studentId = req.body.studentId;

      // Verify student exists
      const studentCheck = await pool.query(
        "SELECT id, name, email FROM users WHERE id = ? AND role = 'student'",
        [studentId]
      );

      if (studentCheck.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Student not found' } });
      }

      const student = studentCheck.rows[0];

      // Promote to admin
      await pool.query(
        "UPDATE users SET role = 'admin' WHERE id = ?",
        [studentId]
      );

      // Get updated student
      const result = await pool.query(
        "SELECT id, role FROM users WHERE id = ?",
        [studentId]
      );

      // Grant initial permissions
      const initialPermissions = [
        'manage_students',
        'manage_notes',
        'view_results'
      ];

      for (const permission of initialPermissions) {
        await pool.query(
          `INSERT OR IGNORE INTO admin_permissions (admin_id, permission_name, is_granted, granted_by, created_at)
          VALUES (?, ?, TRUE, ?, datetime('now'))`,
          [studentId, permission, req.user.id]
        );
      }

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
        VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, 'student_promoted', 'user', studentId, JSON.stringify({ name: student.name })]
      );

      // Notify promoted user
      await pool.query(
        `INSERT INTO notifications (recipient_id, type, title, message)
        VALUES (?, ?, ?, ?)`,
        [studentId, 'promotion', 'Admin Promotion', 'You have been promoted to admin. You now have access to admin features.']
      );

      res.json({
        success: true,
        message: `Student '${student.name}' promoted to admin successfully`,
        admin: result.rows[0]
      });
    } catch (error) {
      console.error('Error promoting student:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Demote admin to student
router.post(
  '/demote-admin',
  verifyToken,
  requireSuperAdmin,
  [
    body('adminId').isInt().toInt(),
  ],
  async (req, res) => {
    try {
      const adminId = req.body.adminId;

      // Cannot demote super_admin
      const adminCheck = await pool.query(
        "SELECT id, name, role FROM users WHERE id = ?",
        [adminId]
      );

      if (adminCheck.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Admin not found' } });
      }

      const admin = adminCheck.rows[0];

      if (admin.role === 'super_admin') {
        return res.status(403).json({
          error: { status: 403, message: 'Cannot demote super admin' }
        });
      }

      // Demote to student
      await pool.query(
        "UPDATE users SET role = 'student' WHERE id = ? AND role = 'admin'",
        [adminId]
      );

      const result = await pool.query(
        "SELECT id, role FROM users WHERE id = ?",
        [adminId]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({
          error: { status: 400, message: 'User is not an admin' }
        });
      }

      // Revoke all permissions
      await pool.query(
        `UPDATE admin_permissions
        SET is_granted = FALSE, granted_by = ?
        WHERE admin_id = ? AND is_granted = TRUE`,
        [req.user.id, adminId]
      );

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
        VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, 'admin_demoted', 'user', adminId, JSON.stringify({ name: admin.name })]
      );

      res.json({
        success: true,
        message: `Admin '${admin.name}' demoted to student successfully`,
        user: result.rows[0]
      });
    } catch (error) {
      console.error('Error demoting admin:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Create student account manually (by admin)
router.get('/student-program-catalog', verifyToken, requireAdmin, async (req, res) => {
  try {
    res.json({ success: true, ...(await getProgramCatalog()) });
  } catch (error) {
    console.error('Error fetching student program catalog:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

router.post(
  '/create-student',
  verifyToken,
  requireSuperAdmin,
  [
    body('name').trim().notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('stageId').isInt().toInt(),
    body('fieldId').optional({ nullable: true }).isInt().toInt(),
    body('subjectIds').optional().isArray(),
    body('subjectIds.*').optional().isInt().toInt(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error', details: errors.array() } });
      }

      const { name, email, password, stageId, fieldId, subjectIds = [] } = req.body;
      const program = await validateStudentProgram(stageId, fieldId, subjectIds);
      if (program.error) {
        return res.status(400).json({ error: { status: 400, message: program.error } });
      }

      // Check if email exists
      const existingUser = await pool.query(
        "SELECT id FROM users WHERE email = ?",
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({
          error: { status: 400, message: 'Email already exists' }
        });
      }

      const gradeCheck = await pool.query(
        "SELECT id FROM grades WHERE name = 'مسارات التوجيهي'",
        []
      );

      if (gradeCheck.rows.length === 0) {
        return res.status(400).json({
          error: { status: 400, message: 'Invalid grade' }
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Create student
      await pool.query(
        `INSERT INTO users (name, email, password_hash, role, grade_id, account_status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, email, passwordHash, 'student', gradeCheck.rows[0].id, 'active']
      );

      const result = await pool.query(
        'SELECT id, name, email, role, grade_id, account_status, created_at FROM users WHERE email = ?',
        [email]
      );

      const student = result.rows[0];
      await pool.query(
        `UPDATE users SET stage_id = ?, academic_field_id = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [program.stage.id, program.fieldId, student.id]
      );
      await replaceStudentSubjects(student.id, program.subjectIds);

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
         VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, 'student_created', 'user', student.id, JSON.stringify({ name: student.name, email: student.email })]
      );

      res.status(201).json({
        success: true,
        message: 'Student account created successfully',
        student: {
          id: student.id,
          name: student.name,
          email: student.email,
          grade_id: student.grade_id,
          stage_id: program.stage.id,
          academic_field_id: program.fieldId,
          subject_ids: program.subjectIds,
          account_status: student.account_status,
          created_at: student.created_at
        }
      });
    } catch (error) {
      console.error('Error creating student:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

router.get('/students/:id/program', verifyToken, requireAdmin, async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    const studentResult = await pool.query(
      `SELECT u.id, u.name, u.email, u.stage_id, u.academic_field_id,
              st.name as stage_name, af.name as field_name
       FROM users u
       LEFT JOIN academic_stages st ON st.id = u.stage_id
       LEFT JOIN academic_fields af ON af.id = u.academic_field_id
       WHERE u.id = ? AND u.role = 'student'`,
      [studentId]
    );
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: { status: 404, message: 'Student not found' } });
    }
    const subjectsResult = await pool.query(
      'SELECT subject_id FROM student_subject_enrollments WHERE student_id = ?',
      [studentId]
    );
    res.json({
      success: true,
      student: { ...studentResult.rows[0], subjectIds: subjectsResult.rows.map(item => item.subject_id) }
    });
  } catch (error) {
    console.error('Error fetching student program:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

router.put('/students/:id/program', verifyToken, requireAdmin, [
  body('stageId').isInt().toInt(),
  body('fieldId').optional({ nullable: true }).isInt().toInt(),
  body('subjectIds').optional().isArray(),
  body('subjectIds.*').optional().isInt().toInt(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { status: 400, message: 'Validation error', details: errors.array() } });
    }
    const studentId = Number(req.params.id);
    const program = await validateStudentProgram(req.body.stageId, req.body.fieldId, req.body.subjectIds || []);
    if (program.error) {
      return res.status(400).json({ error: { status: 400, message: program.error } });
    }
    const studentResult = await pool.query("SELECT id FROM users WHERE id = ? AND role = 'student'", [studentId]);
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: { status: 404, message: 'Student not found' } });
    }
    await pool.query(
      `UPDATE users SET stage_id = ?, academic_field_id = ?, updated_at = datetime('now') WHERE id = ?`,
      [program.stage.id, program.fieldId, studentId]
    );
    await replaceStudentSubjects(studentId, program.subjectIds);
    await pool.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'student_program_updated', 'user', studentId, JSON.stringify({ stageId: program.stage.id, fieldId: program.fieldId, subjectIds: program.subjectIds })]
    );
    res.json({ success: true, message: 'Student program updated successfully' });
  } catch (error) {
    console.error('Error updating student program:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

// List all students (for admin management)
router.get(
  '/students/list',
  verifyToken,
  requireAdmin,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('perPage').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().trim(),
  ],
  async (req, res) => {
    try {
      const page = req.query.page || 1;
      const perPage = req.query.perPage || 20;
      const offset = (page - 1) * perPage;
      const search = req.query.search;

      let whereClause = "WHERE u.role = 'student'";
      let params = [];
      let paramCount = 1;

      if (search) {
        whereClause += ` AND (u.name LIKE ? OR u.email LIKE ?)`;
        params.push(`%${search}%`);
        params.push(`%${search}%`);
        paramCount++;
      }

      // Get students
      const result = await pool.query(
        `SELECT
          u.id,
          u.name,
          u.email,
          u.grade_id,
          u.stage_id,
          st.name as stage_name,
          u.academic_field_id,
          af.name as field_name,
          u.account_status,
          g.name as grade_name,
          COUNT(DISTINCT ea.id) as exam_attempts,
          u.created_at
        FROM users u
        LEFT JOIN grades g ON u.grade_id = g.id
        LEFT JOIN academic_stages st ON u.stage_id = st.id
        LEFT JOIN academic_fields af ON u.academic_field_id = af.id
        LEFT JOIN exam_attempts ea ON u.id = ea.student_id
        ${whereClause}
        GROUP BY u.id, u.name, u.email, u.grade_id, st.name, u.academic_field_id, af.name, u.account_status, g.name, u.created_at
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?`,
        [...params, perPage, offset]
      );

      // Get count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM users u ${whereClause}`,
        params
      );

      res.json({
        success: true,
        students: result.rows,
        pagination: {
          page,
          perPage,
          total: parseInt(countResult.rows[0].total)
        }
      });
    } catch (error) {
      console.error('Error fetching students:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

module.exports = router;
