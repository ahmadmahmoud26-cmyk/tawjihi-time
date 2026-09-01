const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { query, validationResult, body } = require('express-validator');

// Get notifications for current user
router.get(
  '/',
  verifyToken,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('perPage').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('unreadOnly').optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const userId = req.user.id;
      const page = req.query.page || 1;
      const perPage = req.query.perPage || 20;
      const offset = (page - 1) * perPage;
      const unreadOnly = req.query.unreadOnly === 'true';

      let whereClause = 'WHERE n.recipient_id = ?';
      let params = [userId];
      let paramCount = 2;

      if (unreadOnly) {
        whereClause += ' AND n.is_read = false';
      }

      // Get notifications
      const result = await pool.query(
        `SELECT
          n.id,
          n.type,
          n.title,
          n.message,
          n.related_entity_type,
          n.related_entity_id,
          n.is_read,
          n.created_at
        FROM notifications n
        ${whereClause}
        ORDER BY n.created_at DESC
        LIMIT ? OFFSET ?`,
        [...params, perPage, offset]
      );

      // Get count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM notifications n ${whereClause}`,
        params
      );

      // Get unread count
      const unreadResult = await pool.query(
        `SELECT COUNT(*) as unread_count FROM notifications WHERE recipient_id = ? AND is_read = false`,
        [userId]
      );

      res.json({
        success: true,
        notifications: result.rows,
        unreadCount: parseInt(unreadResult.rows[0].unread_count),
        pagination: {
          page,
          perPage,
          total: parseInt(countResult.rows[0].total)
        }
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

router.patch(
  '/read-related',
  verifyToken,
  [
    body('relatedEntityTypes').isArray({ min: 1 }),
    body('relatedEntityTypes.*').isIn(['message', 'private_message', 'student_schedule', 'general_chat']),
    body('relatedIds').isArray({ min: 1 }),
    body('relatedIds.*').isInt().toInt(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
      }

      const { relatedEntityTypes, relatedIds } = req.body;
      const typePlaceholders = relatedEntityTypes.map(() => '?').join(', ');
      const idPlaceholders = relatedIds.map(() => '?').join(', ');
      const result = await pool.query(
        `UPDATE notifications SET is_read = TRUE, read_at = datetime('now')
         WHERE recipient_id = ? AND is_read = FALSE
         AND related_entity_type IN (${typePlaceholders})
         AND related_entity_id IN (${idPlaceholders})`,
        [req.user.id, ...relatedEntityTypes, ...relatedIds]
      );

      res.json({ success: true, markedRead: result.rowCount || 0 });
    } catch (error) {
      console.error('Error marking related notifications as read:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Get single notification
router.get(
  '/:id',
  verifyToken,
  async (req, res) => {
    try {
      const notificationId = req.params.id;
      const userId = req.user.id;

      const result = await pool.query(
        `SELECT
          n.id,
          n.type,
          n.title,
          n.message,
          n.related_entity_type,
          n.related_entity_id,
          n.is_read,
          n.created_at
        FROM notifications n
        WHERE n.id = ? AND n.recipient_id = ?`,
        [notificationId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: { status: 404, message: 'Notification not found' }
        });
      }

      // Mark as read
      await pool.query(
        `UPDATE notifications SET is_read = true, read_at = datetime('now')
        WHERE id = ?`,
        [notificationId]
      );

      res.json({
        success: true,
        notification: result.rows[0]
      });
    } catch (error) {
      console.error('Error fetching notification:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Mark notification as read
router.patch(
  '/:id/read',
  verifyToken,
  async (req, res) => {
    try {
      const notificationId = req.params.id;
      const userId = req.user.id;

      const result = await pool.query(
        `UPDATE notifications SET is_read = true, read_at = datetime('now')
        WHERE id = ? AND recipient_id = ?`,
        [notificationId, userId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          error: { status: 404, message: 'Notification not found' }
        });
      }

      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Mark all notifications as read
router.patch(
  '/read/all',
  verifyToken,
  async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await pool.query(
        `UPDATE notifications SET is_read = true, read_at = datetime('now')
        WHERE recipient_id = ? AND is_read = false
        RETURNING id`,
        [userId]
      );

      res.json({
        success: true,
        message: `Marked ${result.rows.length} notifications as read`
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Delete notification
router.delete(
  '/:id',
  verifyToken,
  async (req, res) => {
    try {
      const notificationId = req.params.id;
      const userId = req.user.id;

      const result = await pool.query(
        `DELETE FROM notifications
        WHERE id = ? AND recipient_id = ?
        RETURNING id`,
        [notificationId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: { status: 404, message: 'Notification not found' }
        });
      }

      res.json({
        success: true,
        message: 'Notification deleted'
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Delete all notifications
router.delete(
  '/delete/all',
  verifyToken,
  async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await pool.query(
        `DELETE FROM notifications
        WHERE recipient_id = ?
        RETURNING id`,
        [userId]
      );

      res.json({
        success: true,
        message: `Deleted ${result.rows.length} notifications`
      });
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

module.exports = router;
