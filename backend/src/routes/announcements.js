const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken, requireAdmin, requirePermission } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');

// Get announcements (for students: only relevant ones)
router.get(
  '/',
  verifyToken,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('perPage').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req, res) => {
    try {
      const page = req.query.page || 1;
      const perPage = req.query.perPage || 10;
      const offset = (page - 1) * perPage;

      // Build query - show only visible and published announcements
      let whereClause = `
        WHERE a.visibility = true
        AND (a.publish_at IS NULL OR a.publish_at <= datetime('now'))
        AND (a.expires_at IS NULL OR a.expires_at > datetime('now'))
      `;

      // If student, filter by grade
      if (req.user && req.user.role === 'student') {
        whereClause += ` AND (a.target_grade_id IS NULL OR a.target_grade_id = (SELECT grade_id FROM users WHERE id = ?))`;
      }

      // Get announcements
      const result = await pool.query(
        `SELECT
          a.id,
          a.title,
          a.content,
          a.image_url,
          g.name as target_grade_name,
          u.name as created_by_name,
          a.created_at,
          a.updated_at
        FROM announcements a
        LEFT JOIN grades g ON a.target_grade_id = g.id
        LEFT JOIN users u ON a.created_by = u.id
        ${whereClause}
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?`,
        req.user && req.user.role === 'student'
          ? [req.user.id, perPage, offset]
          : [perPage, offset]
      );

      // Get count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM announcements a ${whereClause}`,
        req.user && req.user.role === 'student' ? [req.user.id] : []
      );

      res.json({
        success: true,
        announcements: result.rows,
        pagination: {
          page,
          perPage,
          total: parseInt(countResult.rows[0].total)
        }
      });
    } catch (error) {
      console.error('Error fetching announcements:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Get single announcement
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const announcementId = req.params.id;

    const result = await pool.query(
      `SELECT
        a.id,
        a.title,
        a.content,
        a.image_url,
        a.target_grade_id,
        g.name as target_grade_name,
        a.created_by,
        u.name as created_by_name,
        a.visibility,
        a.publish_at,
        a.expires_at,
        a.created_at,
        a.updated_at
      FROM announcements a
      LEFT JOIN grades g ON a.target_grade_id = g.id
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.id = ? AND a.visibility = true`,
      [announcementId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { status: 404, message: 'Announcement not found' } });
    }

    res.json({
      success: true,
      announcement: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching announcement:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

// Create announcement (admin only)
router.post(
  '/',
  verifyToken,
  requireAdmin,
  [
    body('title').trim().notEmpty().isLength({ min: 5 }),
    body('content').trim().notEmpty().isLength({ min: 10 }),
    body('imageData').optional().isString(),
    body('targetGradeId').optional().isInt().toInt(),
    body('visibility').optional().isBoolean(),
    body('publishAt').optional().isISO8601(),
    body('expiresAt').optional().isISO8601(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
      }

      const { title, content, imageData, targetGradeId, visibility = true, publishAt, expiresAt } = req.body;

      const result = await pool.query(
        `INSERT INTO announcements (title, content, image_url, target_grade_id, created_by, visibility, publish_at, expires_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [title, content, imageData || null, targetGradeId || null, req.user.id, visibility ? 1 : 0, publishAt || null, expiresAt || null]
      );

      const announcementResult = await pool.query(
        `SELECT id, title, content, image_url, target_grade_id, created_at
         FROM announcements WHERE id = ?`,
        [result.rows[0]?.id || result.lastID]
      );
      const announcement = announcementResult.rows[0];

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)`,
        [req.user.id, 'announcement_created', 'announcement', announcement.id]
      );

      // Notify every student, or only the selected grade when targeting is used.
      await pool.query(
        `INSERT INTO notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
        SELECT u.id, 'announcement', 'إعلان جديد', ?, 'announcement', ?
        FROM users u
        WHERE u.role = 'student' AND (? IS NULL OR u.grade_id = ?)`,
        [`إعلان جديد: ${title}`, announcement.id, targetGradeId || null, targetGradeId || null]
      );

      res.status(201).json({
        success: true,
        announcement,
        message: 'Announcement created successfully'
      });
    } catch (error) {
      console.error('Error creating announcement:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Update announcement
router.put(
  '/:id',
  verifyToken,
  requireAdmin,
  requirePermission('manage_announcements'),
  [
    body('title').optional().trim().isLength({ min: 5 }),
    body('content').optional().trim().isLength({ min: 10 }),
    body('visibility').optional().isBoolean(),
    body('expiresAt').optional().isISO8601(),
  ],
  async (req, res) => {
    try {
      const announcementId = req.params.id;
      const { title, content, visibility, expiresAt } = req.body;

      let updateFields = ["updated_at = datetime('now')"];
      let params = [];
      let paramCount = 1;

      if (title) {
        updateFields.push(`title = $${paramCount}`);
        params.push(title);
        paramCount++;
      }

      if (content) {
        updateFields.push(`content = $${paramCount}`);
        params.push(content);
        paramCount++;
      }

      if (visibility !== undefined) {
        updateFields.push(`visibility = $${paramCount}`);
        params.push(visibility);
        paramCount++;
      }

      if (expiresAt) {
        updateFields.push(`expires_at = $${paramCount}`);
        params.push(expiresAt);
        paramCount++;
      }

      params.push(announcementId);

      const result = await pool.query(
        `UPDATE announcements SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, title, updated_at`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Announcement not found' } });
      }

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)`,
        [req.user.id, 'announcement_updated', 'announcement', announcementId]
      );

      res.json({
        success: true,
        announcement: result.rows[0],
        message: 'Announcement updated successfully'
      });
    } catch (error) {
      console.error('Error updating announcement:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Delete announcement
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const announcementId = req.params.id;

      const existing = await pool.query(
        'SELECT id FROM announcements WHERE id = ?',
        [announcementId]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Announcement not found' } });
      }

      await pool.query('DELETE FROM announcements WHERE id = ?', [announcementId]);

      // Log action
      await pool.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)`,
        [req.user.id, 'announcement_deleted', 'announcement', announcementId]
      );

      res.json({
        success: true,
        message: 'Announcement deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting announcement:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

module.exports = router;
