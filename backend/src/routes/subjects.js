const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken, requireAdmin, requirePermission } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');

// Get all subjects (with pagination, filtering)
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('perPage').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('grade').optional().isInt().toInt(),
    query('search').optional().trim().isLength({ min: 1 }),
    query('visibility').optional().isIn(['true', 'false']),
    query('sortBy').optional().isIn(['name', 'created_at', 'display_order']),
    query('sortOrder').optional().isIn(['ASC', 'DESC']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
      }

      const page = req.query.page || 1;
      const perPage = req.query.perPage || 20;
      const offset = (page - 1) * perPage;
      const gradeId = req.query.grade;
      const search = req.query.search;
      const visibility = req.query.visibility === 'true' ? true : (req.query.visibility === 'false' ? false : null);
      const sortBy = req.query.sortBy || 'display_order';
      const sortOrder = req.query.sortOrder || 'ASC';

      // Build query
      let whereClause = 'WHERE s.deleted_at IS NULL';
      let params = [];
      let paramCount = 1;

      if (gradeId) {
        whereClause += ` AND s.grade_id = $${paramCount}`;
        params.push(gradeId);
        paramCount++;
      }

      if (search) {
        whereClause += ` AND (s.name LIKE $${paramCount} OR s.description LIKE $${paramCount})`;
        params.push(`%${search}%`);
        paramCount++;
      }

      if (visibility !== null) {
        whereClause += ` AND s.visibility = $${paramCount}`;
        params.push(visibility);
        paramCount++;
      }

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM subjects s ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total);

      // Get subjects with grade info and counts
      const query = `
        SELECT
          s.id,
          s.name,
          s.description,
          s.grade_id,
          g.name as grade_name,
          s.display_order,
          s.visibility,
          s.created_by,
          u.name as created_by_name,
          s.created_at,
          s.updated_at,
          (SELECT COUNT(*) FROM units WHERE subject_id = s.id AND deleted_at IS NULL) as units_count,
          (SELECT COUNT(*) FROM exams WHERE subject_id = s.id AND deleted_at IS NULL) as exams_count,
          (SELECT COUNT(*) FROM student_subject_enrollments WHERE subject_id = s.id) as students_enrolled
        FROM subjects s
        LEFT JOIN grades g ON s.grade_id = g.id
        LEFT JOIN users u ON s.created_by = u.id
        ${whereClause}
        ORDER BY s.${sortBy} ${sortOrder}
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `;

      params.push(perPage, offset);
      const result = await pool.query(query, params);

      res.json({
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
      console.error('Error fetching subjects:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Get single subject with hierarchy
router.get('/:id', async (req, res) => {
  try {
    const subjectId = req.params.id;

    // Get subject details
    const subjectResult = await pool.query(
      `SELECT
        s.id,
        s.name,
        s.description,
        s.grade_id,
        g.name as grade_name,
        s.display_order,
        s.visibility,
        s.created_by,
        u.name as created_by_name,
        s.created_at,
        s.updated_at
      FROM subjects s
      LEFT JOIN grades g ON s.grade_id = g.id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = ? AND s.deleted_at IS NULL`,
      [subjectId]
    );

    if (subjectResult.rows.length === 0) {
      return res.status(404).json({ error: { status: 404, message: 'Subject not found' } });
    }

    const subject = subjectResult.rows[0];

    // Get units with lessons
    const unitsResult = await pool.query(
      `SELECT
        u.id,
        u.name,
        u.description,
        u.display_order,
        (SELECT COUNT(*) FROM lessons WHERE unit_id = u.id AND deleted_at IS NULL) as lessons_count
      FROM units u
      WHERE u.subject_id = ? AND u.deleted_at IS NULL
      ORDER BY u.display_order ASC`,
      [subjectId]
    );

    // Get exams count
    const examsResult = await pool.query(
      `SELECT COUNT(*) as total FROM exams WHERE subject_id = ? AND deleted_at IS NULL`,
      [subjectId]
    );

    res.json({
      success: true,
      subject: {
        ...subject,
        units: unitsResult.rows,
        examsCount: examsResult.rows[0].total
      }
    });
  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

// Create subject
router.post(
  '/',
  verifyToken,
  requireAdmin,
  requirePermission('manage_subjects'),
  [
    body('name').trim().notEmpty().isLength({ min: 2, max: 255 }),
    body('description').optional().trim(),
    body('gradeId').isInt(),
    body('displayOrder').optional().isInt().toInt(),
    body('visibility').optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error', errors: errors.array() } });
      }

      const { name, description, gradeId, displayOrder = 0, visibility = true } = req.body;

      // Verify grade exists
      const gradeCheck = await pool.query('SELECT id FROM grades WHERE id = ?', [gradeId]);
      if (gradeCheck.rows.length === 0) {
        return res.status(400).json({ error: { status: 400, message: 'Grade not found' } });
      }

      // Create subject
      const result = await pool.query(
        `INSERT INTO subjects (name, description, grade_id, display_order, visibility, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        RETURNING id, name, description, grade_id, display_order, visibility, created_by, created_at`,
        [name, description, gradeId, displayOrder, visibility, req.user.id]
      );

      const subject = result.rows[0];

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)`,
        [req.user.id, 'subject_created', 'subject', subject.id]
      );

      // Create notification
      await pool.query(
        `INSERT INTO notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
        SELECT u.id, 'announcement', 'New Subject', ?, 'subject', ?
        FROM users u
        WHERE u.role = 'student' AND u.grade_id = ?`,
        [`New subject "${name}" has been added`, subject.id, gradeId]
      );

      res.status(201).json({
        success: true,
        subject,
        message: 'Subject created successfully'
      });
    } catch (error) {
      console.error('Error creating subject:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Update subject
router.put(
  '/:id',
  verifyToken,
  requireAdmin,
  requirePermission('manage_subjects'),
  [
    body('name').optional().trim().isLength({ min: 2, max: 255 }),
    body('description').optional().trim(),
    body('displayOrder').optional().isInt().toInt(),
    body('visibility').optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
      }

      const subjectId = req.params.id;
      const { name, description, displayOrder, visibility } = req.body;

      // Build dynamic update query
      let updateFields = ["updated_at = datetime('now')"];
      let params = [];
      let paramCount = 1;

      if (name) {
        updateFields.push(`name = $${paramCount}`);
        params.push(name);
        paramCount++;
      }

      if (description !== undefined) {
        updateFields.push(`description = $${paramCount}`);
        params.push(description);
        paramCount++;
      }

      if (displayOrder !== undefined) {
        updateFields.push(`display_order = $${paramCount}`);
        params.push(displayOrder);
        paramCount++;
      }

      if (visibility !== undefined) {
        updateFields.push(`visibility = $${paramCount}`);
        params.push(visibility);
        paramCount++;
      }

      params.push(subjectId);

      const result = await pool.query(
        `UPDATE subjects
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount} AND deleted_at IS NULL
        RETURNING id, name, description, grade_id, display_order, visibility, updated_at`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Subject not found' } });
      }

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)`,
        [req.user.id, 'subject_updated', 'subject', subjectId]
      );

      res.json({
        success: true,
        subject: result.rows[0],
        message: 'Subject updated successfully'
      });
    } catch (error) {
      console.error('Error updating subject:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Delete/Archive subject (soft delete)
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  requirePermission('manage_subjects'),
  async (req, res) => {
    try {
      const subjectId = req.params.id;

      // Soft delete
      const result = await pool.query(
        `UPDATE subjects
        SET deleted_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ? AND deleted_at IS NULL
        RETURNING id, name`,
        [subjectId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Subject not found' } });
      }

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)`,
        [req.user.id, 'subject_deleted', 'subject', subjectId]
      );

      res.json({
        success: true,
        message: 'Subject archived successfully'
      });
    } catch (error) {
      console.error('Error deleting subject:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Reorder subjects
router.patch(
  '/reorder',
  verifyToken,
  requireAdmin,
  requirePermission('manage_subjects'),
  [
    body('subjects').isArray().notEmpty(),
    body('subjects.*.id').isInt(),
    body('subjects.*.displayOrder').isInt(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
      }

      const { subjects } = req.body;

      // Update all subjects
      for (const subject of subjects) {
        await pool.query(
          `UPDATE subjects SET display_order = ?, updated_at = datetime('now')
          WHERE id = ?`,
          [subject.displayOrder, subject.id]
        );
      }

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, metadata)
        VALUES (?, ?, ?, ?)`,
        [req.user.id, 'subjects_reordered', 'subject', JSON.stringify({ count: subjects.length })]
      );

      res.json({
        success: true,
        message: 'Subjects reordered successfully'
      });
    } catch (error) {
      console.error('Error reordering subjects:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Get units for a subject
router.get('/:subjectId/units', async (req, res) => {
  try {
    const subjectId = req.params.subjectId;

    const result = await pool.query(
      `SELECT
        u.id,
        u.name,
        u.description,
        u.display_order,
        (SELECT COUNT(*) FROM lessons WHERE unit_id = u.id AND deleted_at IS NULL) as lessons_count
      FROM units u
      WHERE u.subject_id = ? AND u.deleted_at IS NULL
      ORDER BY u.display_order ASC`,
      [subjectId]
    );

    res.json({
      success: true,
      units: result.rows
    });
  } catch (error) {
    console.error('Error fetching units:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

// Create unit
router.post(
  '/:subjectId/units',
  verifyToken,
  requireAdmin,
  requirePermission('manage_units'),
  [
    body('name').trim().notEmpty().isLength({ min: 2, max: 255 }),
    body('description').optional().trim(),
    body('displayOrder').optional().isInt().toInt(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
      }

      const subjectId = req.params.subjectId;
      const { name, description, displayOrder = 0 } = req.body;

      // Verify subject exists
      const subjectCheck = await pool.query(
        'SELECT id FROM subjects WHERE id = ? AND deleted_at IS NULL',
        [subjectId]
      );

      if (subjectCheck.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Subject not found' } });
      }

      const result = await pool.query(
        `INSERT INTO units (subject_id, name, description, display_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        RETURNING id, name, description, display_order`,
        [subjectId, name, description, displayOrder]
      );

      const unit = result.rows[0];

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)`,
        [req.user.id, 'unit_created', 'unit', unit.id]
      );

      res.status(201).json({
        success: true,
        unit,
        message: 'Unit created successfully'
      });
    } catch (error) {
      console.error('Error creating unit:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Update unit
router.put(
  '/:subjectId/units/:unitId',
  verifyToken,
  requireAdmin,
  requirePermission('manage_units'),
  [
    body('name').optional().trim().isLength({ min: 2, max: 255 }),
    body('description').optional().trim(),
    body('displayOrder').optional().isInt().toInt(),
  ],
  async (req, res) => {
    try {
      const unitId = req.params.unitId;
      const { name, description, displayOrder } = req.body;

      // Build dynamic update
      let updateFields = ["updated_at = datetime('now')"];
      let params = [];
      let paramCount = 1;

      if (name) {
        updateFields.push(`name = $${paramCount}`);
        params.push(name);
        paramCount++;
      }

      if (description !== undefined) {
        updateFields.push(`description = $${paramCount}`);
        params.push(description);
        paramCount++;
      }

      if (displayOrder !== undefined) {
        updateFields.push(`display_order = $${paramCount}`);
        params.push(displayOrder);
        paramCount++;
      }

      params.push(unitId);

      const result = await pool.query(
        `UPDATE units SET ${updateFields.join(', ')}
        WHERE id = $${paramCount} AND deleted_at IS NULL
        RETURNING id, name, description, display_order`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Unit not found' } });
      }

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)`,
        [req.user.id, 'unit_updated', 'unit', unitId]
      );

      res.json({
        success: true,
        unit: result.rows[0],
        message: 'Unit updated successfully'
      });
    } catch (error) {
      console.error('Error updating unit:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Delete unit
router.delete(
  '/:subjectId/units/:unitId',
  verifyToken,
  requireAdmin,
  requirePermission('manage_units'),
  async (req, res) => {
    try {
      const unitId = req.params.unitId;

      const result = await pool.query(
        `UPDATE units SET deleted_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ? AND deleted_at IS NULL
        RETURNING id`,
        [unitId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Unit not found' } });
      }

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)`,
        [req.user.id, 'unit_deleted', 'unit', unitId]
      );

      res.json({
        success: true,
        message: 'Unit deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting unit:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Get all grades
// lessons under a unit
router.get('/:subjectId/units/:unitId/lessons', async (req, res) => {
  try {
    const { subjectId, unitId } = req.params;

    const unitCheck = await pool.query(
      `SELECT id FROM units WHERE id = ? AND subject_id = ? AND deleted_at IS NULL`,
      [unitId, subjectId]
    );

    if (unitCheck.rows.length === 0) {
      return res.status(404).json({ error: { status: 404, message: 'Unit not found' } });
    }

    const result = await pool.query(
      `SELECT
        l.id,
        l.name,
        l.description,
        l.display_order,
        (SELECT COUNT(*) FROM sections WHERE lesson_id = l.id AND deleted_at IS NULL) as sections_count
      FROM lessons l
      WHERE l.unit_id = ? AND l.deleted_at IS NULL
      ORDER BY l.display_order ASC`,
      [unitId]
    );

    res.json({ success: true, lessons: result.rows });
  } catch (error) {
    console.error('Error fetching lessons:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

router.post(
  '/:subjectId/units/:unitId/lessons',
  verifyToken,
  requireAdmin,
  requirePermission('manage_lessons'),
  [
    body('name').trim().notEmpty().isLength({ min: 2, max: 255 }),
    body('description').optional().trim(),
    body('displayOrder').optional().isInt().toInt(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error', errors: errors.array() } });
      }

      const { subjectId, unitId } = req.params;
      const { name, description, displayOrder = 0 } = req.body;

      const unitCheck = await pool.query(
        `SELECT id FROM units WHERE id = ? AND subject_id = ? AND deleted_at IS NULL`,
        [unitId, subjectId]
      );

      if (unitCheck.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Unit not found' } });
      }

      const result = await pool.query(
        `INSERT INTO lessons (unit_id, name, description, display_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
         RETURNING id, name, description, display_order`,
        [unitId, name, description || '', displayOrder]
      );

      const lesson = result.rows[0];

      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
         VALUES (?, ?, ?, ?)`,
        [req.user.id, 'lesson_created', 'lesson', lesson.id]
      );

      res.status(201).json({ success: true, lesson, message: 'Lesson created successfully' });
    } catch (error) {
      console.error('Error creating lesson:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

router.put(
  '/:subjectId/units/:unitId/lessons/:lessonId',
  verifyToken,
  requireAdmin,
  requirePermission('manage_lessons'),
  [
    body('name').optional().trim().isLength({ min: 2, max: 255 }),
    body('description').optional().trim(),
    body('displayOrder').optional().isInt().toInt(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error', errors: errors.array() } });
      }

      const { lessonId } = req.params;
      const { name, description, displayOrder } = req.body;

      let updateFields = ["updated_at = datetime('now')"];
      let params = [];
      let paramCount = 1;

      if (name) {
        updateFields.push(`name = $${paramCount}`);
        params.push(name);
        paramCount++;
      }

      if (description !== undefined) {
        updateFields.push(`description = $${paramCount}`);
        params.push(description);
        paramCount++;
      }

      if (displayOrder !== undefined) {
        updateFields.push(`display_order = $${paramCount}`);
        params.push(displayOrder);
        paramCount++;
      }

      params.push(lessonId);

      const result = await pool.query(
        `UPDATE lessons SET ${updateFields.join(', ')}
         WHERE id = $${paramCount} AND deleted_at IS NULL
         RETURNING id, name, description, display_order`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Lesson not found' } });
      }

      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
         VALUES (?, ?, ?, ?)`,
        [req.user.id, 'lesson_updated', 'lesson', lessonId]
      );

      res.json({ success: true, lesson: result.rows[0], message: 'Lesson updated successfully' });
    } catch (error) {
      console.error('Error updating lesson:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

router.delete(
  '/:subjectId/units/:unitId/lessons/:lessonId',
  verifyToken,
  requireAdmin,
  requirePermission('manage_lessons'),
  async (req, res) => {
    try {
      const { lessonId } = req.params;
      const result = await pool.query(
        `UPDATE lessons SET deleted_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ? AND deleted_at IS NULL
         RETURNING id, name`,
        [lessonId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Lesson not found' } });
      }

      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
         VALUES (?, ?, ?, ?)`,
        [req.user.id, 'lesson_deleted', 'lesson', lessonId]
      );

      res.json({ success: true, message: 'Lesson deleted successfully' });
    } catch (error) {
      console.error('Error deleting lesson:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

router.get('/:subjectId/units/:unitId/lessons/:lessonId/sections', async (req, res) => {
  try {
    const { lessonId } = req.params;

    const lessonCheck = await pool.query(
      `SELECT id FROM lessons WHERE id = ? AND deleted_at IS NULL`,
      [lessonId]
    );

    if (lessonCheck.rows.length === 0) {
      return res.status(404).json({ error: { status: 404, message: 'Lesson not found' } });
    }

    const result = await pool.query(
      `SELECT
        id,
        lesson_id,
        section_type,
        title,
        content,
        display_order,
        visibility,
        created_by,
        created_at,
        updated_at
      FROM sections
      WHERE lesson_id = ? AND deleted_at IS NULL
      ORDER BY display_order ASC`,
      [lessonId]
    );

    res.json({ success: true, sections: result.rows });
  } catch (error) {
    console.error('Error fetching sections:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

router.post(
  '/:subjectId/units/:unitId/lessons/:lessonId/sections',
  verifyToken,
  requireAdmin,
  requirePermission('manage_sections'),
  [
    body('sectionType').isIn(['text', 'rich_text', 'video', 'file', 'external_link', 'exam', 'announcement', 'notes', 'lesson']),
    body('title').trim().notEmpty().isLength({ min: 2, max: 255 }),
    body('content').optional(),
    body('displayOrder').optional().isInt().toInt(),
    body('visibility').optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error', errors: errors.array() } });
      }

      const { lessonId } = req.params;
      const { sectionType, title, content = '', displayOrder = 0, visibility = true } = req.body;

      const lessonCheck = await pool.query(
        `SELECT id FROM lessons WHERE id = ? AND deleted_at IS NULL`,
        [lessonId]
      );

      if (lessonCheck.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Lesson not found' } });
      }

      const safeTitle = title.replace(/<[^>]*>/g, '').trim();
      const safeContent = sanitizeContent(content, sectionType);

      const result = await pool.query(
        `INSERT INTO sections (lesson_id, section_type, title, content, display_order, visibility, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
         RETURNING id, lesson_id, section_type, title, content, display_order, visibility`,
        [lessonId, sectionType, safeTitle, safeContent, displayOrder, visibility, req.user.id]
      );

      const section = result.rows[0];

      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
         VALUES (?, ?, ?, ?)`,
        [req.user.id, 'section_created', 'section', section.id]
      );

      res.status(201).json({ success: true, section, message: 'Section created successfully' });
    } catch (error) {
      console.error('Error creating section:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

router.put(
  '/:subjectId/units/:unitId/lessons/:lessonId/sections/:sectionId',
  verifyToken,
  requireAdmin,
  requirePermission('manage_sections'),
  [
    body('sectionType').optional().isIn(['text', 'rich_text', 'video', 'file', 'external_link', 'exam', 'announcement', 'notes', 'lesson']),
    body('title').optional().trim().isLength({ min: 2, max: 255 }),
    body('content').optional(),
    body('displayOrder').optional().isInt().toInt(),
    body('visibility').optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error', errors: errors.array() } });
      }

      const { sectionId } = req.params;
      const { sectionType, title, content, displayOrder, visibility } = req.body;

      let updateFields = ["updated_at = datetime('now')"];
      let params = [];
      let paramCount = 1;

      if (sectionType) {
        updateFields.push(`section_type = $${paramCount}`);
        params.push(sectionType);
        paramCount++;
      }

      if (title) {
        updateFields.push(`title = $${paramCount}`);
        params.push(title.replace(/<[^>]*>/g, '').trim());
        paramCount++;
      }

      if (content !== undefined) {
        updateFields.push(`content = $${paramCount}`);
        params.push(sectionType ? sanitizeContent(content, sectionType) : sanitizeContent(content, 'text'));
        paramCount++;
      }

      if (displayOrder !== undefined) {
        updateFields.push(`display_order = $${paramCount}`);
        params.push(displayOrder);
        paramCount++;
      }

      if (visibility !== undefined) {
        updateFields.push(`visibility = $${paramCount}`);
        params.push(visibility);
        paramCount++;
      }

      params.push(sectionId);

      const result = await pool.query(
        `UPDATE sections SET ${updateFields.join(', ')}
         WHERE id = $${paramCount} AND deleted_at IS NULL
         RETURNING id, title, section_type, content, display_order, visibility`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Section not found' } });
      }

      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
         VALUES (?, ?, ?, ?)`,
        [req.user.id, 'section_updated', 'section', sectionId]
      );

      res.json({ success: true, section: result.rows[0], message: 'Section updated successfully' });
    } catch (error) {
      console.error('Error updating section:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

router.delete(
  '/:subjectId/units/:unitId/lessons/:lessonId/sections/:sectionId',
  verifyToken,
  requireAdmin,
  requirePermission('manage_sections'),
  async (req, res) => {
    try {
      const { sectionId } = req.params;
      const result = await pool.query(
        `UPDATE sections SET deleted_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ? AND deleted_at IS NULL
         RETURNING id, title`,
        [sectionId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Section not found' } });
      }

      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
         VALUES (?, ?, ?, ?)`,
        [req.user.id, 'section_deleted', 'section', sectionId]
      );

      res.json({ success: true, message: 'Section deleted successfully' });
    } catch (error) {
      console.error('Error deleting section:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

router.get('/grades/all', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, description, display_order FROM grades WHERE active = true ORDER BY display_order ASC'
    );

    res.json({
      success: true,
      grades: result.rows
    });
  } catch (error) {
    console.error('Error fetching grades:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

module.exports = router;
