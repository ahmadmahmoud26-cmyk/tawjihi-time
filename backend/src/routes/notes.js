const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken, requireAdmin, requirePermission } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');

// Student: Create note
router.post(
  '/',
  verifyToken,
  [
    body('note').trim().notEmpty().isLength({ min: 10 }),
    body('subjectId').optional().isInt().toInt(),
    body('unitId').optional().isInt().toInt(),
    body('lessonId').optional().isInt().toInt(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
      }

      const studentId = req.user.id;
      const { note, subjectId, unitId, lessonId } = req.body;

      const result = await pool.query(
        `INSERT INTO student_notes (student_id, subject_id, unit_id, lesson_id, note, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        RETURNING id, note, created_at`,
        [studentId, subjectId, unitId, lessonId, note]
      );

      const newNote = result.rows[0];

      // Create notification for admins
      await pool.query(
        `INSERT INTO notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
        SELECT u.id, 'note', 'New Student Note', ?, 'note', ?
        FROM users u WHERE u.role IN ('admin', 'super_admin')`,
        [`New note from student`, newNote.id]
      );

      res.status(201).json({
        success: true,
        note: newNote,
        message: 'Note created successfully'
      });
    } catch (error) {
      console.error('Error creating note:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Student: Get own notes
router.get(
  '/student/my-notes',
  verifyToken,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('perPage').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('subject').optional().isInt().toInt(),
  ],
  async (req, res) => {
    try {
      const studentId = req.user.id;
      const page = req.query.page || 1;
      const perPage = req.query.perPage || 20;
      const offset = (page - 1) * perPage;
      const subjectId = req.query.subject;

      let whereClause = 'WHERE sn.student_id = ?';
      let params = [studentId];
      let paramCount = 2;

      if (subjectId) {
        whereClause += ` AND sn.subject_id = $${paramCount}`;
        params.push(subjectId);
        paramCount++;
      }

      // Get notes
      const result = await pool.query(
        `SELECT
          sn.id,
          sn.note,
          sn.is_read,
          sn.admin_reply,
          sn.replied_at,
          s.name as subject_name,
          u.name as replied_by_name,
          sn.created_at,
          sn.updated_at
        FROM student_notes sn
        LEFT JOIN subjects s ON sn.subject_id = s.id
        LEFT JOIN users u ON sn.replied_by = u.id
        ${whereClause}
        ORDER BY sn.created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
        [...params, perPage, offset]
      );

      // Get count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM student_notes ${whereClause}`,
        params
      );

      res.json({
        success: true,
        notes: result.rows,
        pagination: {
          page,
          perPage,
          total: parseInt(countResult.rows[0].total)
        }
      });
    } catch (error) {
      console.error('Error fetching notes:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Student: Update own note
router.put(
  '/:id',
  verifyToken,
  [body('note').trim().notEmpty().isLength({ min: 10 })],
  async (req, res) => {
    try {
      const noteId = req.params.id;
      const studentId = req.user.id;
      const { note } = req.body;

      // Verify student owns this note
      const check = await pool.query(
        'SELECT id FROM student_notes WHERE id = ? AND student_id = ?',
        [noteId, studentId]
      );

      if (check.rows.length === 0) {
        return res.status(403).json({
          error: { status: 403, message: 'Cannot update other student notes' }
        });
      }

      const result = await pool.query(
        `UPDATE student_notes SET note = ?, updated_at = datetime('now')
        WHERE id = ?
        RETURNING id, note, updated_at`,
        [note, noteId]
      );

      res.json({
        success: true,
        note: result.rows[0],
        message: 'Note updated successfully'
      });
    } catch (error) {
      console.error('Error updating note:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Admin: Get all unread notes grouped by subject
router.get(
  '/admin/unread',
  verifyToken,
  requireAdmin,
  requirePermission('manage_notes'),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
          s.id as subject_id,
          s.name as subject_name,
          COUNT(*) as unread_count
        FROM student_notes sn
        LEFT JOIN subjects s ON sn.subject_id = s.id
        WHERE sn.is_read = false
        GROUP BY s.id, s.name
        ORDER BY s.name`
      );

      // For each subject, fetch the notes
      const notesPerSubject = {};
      for (const subject of result.rows) {
        const notesResult = await pool.query(
          `SELECT
            sn.id,
            u.name as studentName,
            substr(sn.note, 1, 100) as preview,
            sn.created_at as createdAt
          FROM student_notes sn
          LEFT JOIN users u ON sn.student_id = u.id
          WHERE sn.subject_id = ? AND sn.is_read = false
          ORDER BY sn.created_at DESC`,
          [subject.subject_id]
        );
        notesPerSubject[subject.subject_id] = notesResult.rows;
      }

      // Format response
      const formattedResult = result.rows.map(subject => ({
        ...subject,
        notes: notesPerSubject[subject.subject_id] || []
      }));

      res.json({
        success: true,
        notes: formattedResult
      });
    } catch (error) {
      console.error('Error fetching unread notes:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Admin: Get note and reply
router.post(
  '/admin/:id/reply',
  verifyToken,
  requireAdmin,
  requirePermission('manage_notes'),
  [body('reply').trim().notEmpty().isLength({ min: 1 })],
  async (req, res) => {
    try {
      const noteId = req.params.id;
      const adminId = req.user.id;
      const { reply } = req.body;

      // Get note
      const noteResult = await pool.query(
        'SELECT student_id FROM student_notes WHERE id = ?',
        [noteId]
      );

      if (noteResult.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Note not found' } });
      }

      const studentId = noteResult.rows[0].student_id;

      // Update note with reply
      const result = await pool.query(
        `UPDATE student_notes
        SET admin_reply = ?, replied_by = ?, replied_at = datetime('now'), is_read = true, read_at = datetime('now')
        WHERE id = ?
        RETURNING id, admin_reply`,
        [reply, adminId, noteId]
      );

      // Create notification for student
      await pool.query(
        `INSERT INTO notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [studentId, 'admin_reply', 'Admin Reply', 'You have received a reply to your note', 'note', noteId]
      );

      res.json({
        success: true,
        note: result.rows[0],
        message: 'Reply added successfully'
      });
    } catch (error) {
      console.error('Error adding reply:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

module.exports = router;
