const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken, requireAdmin, requirePermission } = require('../middleware/auth');
const { query, validationResult } = require('express-validator');

// Get audit logs (admin only)
router.get(
  '/',
  verifyToken,
  requireAdmin,
  requirePermission('view_audit_logs'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('perPage').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('actor').optional().isInt().toInt(),
    query('action').optional().trim(),
    query('entityType').optional().trim(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
      }

      const page = req.query.page || 1;
      const perPage = req.query.perPage || 50;
      const offset = (page - 1) * perPage;
      const actor = req.query.actor;
      const action = req.query.action;
      const entityType = req.query.entityType;
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      let whereClause = 'WHERE 1=1';
      let params = [];
      let paramCount = 1;

      if (actor) {
        whereClause += ` AND al.actor_id = $${paramCount}`;
        params.push(actor);
        paramCount++;
      }

      if (action) {
        whereClause += ` AND al.action LIKE $${paramCount}`;
        params.push(`%${action}%`);
        paramCount++;
      }

      if (entityType) {
        whereClause += ` AND al.entity_type = $${paramCount}`;
        params.push(entityType);
        paramCount++;
      }

      if (startDate) {
        whereClause += ` AND al.created_at >= $${paramCount}`;
        params.push(startDate);
        paramCount++;
      }

      if (endDate) {
        whereClause += ` AND al.created_at <= $${paramCount}`;
        params.push(endDate);
        paramCount++;
      }

      // Get logs
      const result = await pool.query(
        `SELECT
          al.id,
          al.actor_id,
          u.name as actor_name,
          u.email as actor_email,
          u.role as actor_role,
          al.action,
          al.entity_type,
          al.entity_id,
          al.metadata,
          al.created_at
        FROM audit_logs al
        LEFT JOIN users u ON al.actor_id = u.id
        ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
        [...params, perPage, offset]
      );

      // Get count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`,
        params
      );

      res.json({
        success: true,
        logs: result.rows,
        pagination: {
          page,
          perPage,
          total: parseInt(countResult.rows[0].total)
        }
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Get activity summary
router.get(
  '/summary',
  verifyToken,
  requireAdmin,
  requirePermission('view_audit_logs'),
  [
    query('days').optional().isInt({ min: 1, max: 365 }).toInt(),
  ],
  async (req, res) => {
    try {
      const days = req.query.days || 30;

      // Get action counts
      const actionResult = await pool.query(
        `SELECT
          action,
          COUNT(*) as count
        FROM audit_logs
        WHERE created_at >= datetime('now', '-' || ? || ' days')
        GROUP BY action
        ORDER BY count DESC`,
        [days]
      );

      // Get entity type counts
      const entityResult = await pool.query(
        `SELECT
          entity_type,
          COUNT(*) as count
        FROM audit_logs
        WHERE created_at >= datetime('now', '-' || ? || ' days')
        GROUP BY entity_type
        ORDER BY count DESC`,
        [days]
      );

      // Get top actors
      const actorResult = await pool.query(
        `SELECT
          u.id,
          u.name,
          COUNT(*) as action_count
        FROM audit_logs al
        LEFT JOIN users u ON al.actor_id = u.id
        WHERE al.created_at >= datetime('now', '-' || ? || ' days')
        GROUP BY u.id, u.name
        ORDER BY action_count DESC
        LIMIT 10`,
        [days]
      );

      res.json({
        success: true,
        summary: {
          period_days: days,
          actions: actionResult.rows,
          entity_types: entityResult.rows,
          top_actors: actorResult.rows
        }
      });
    } catch (error) {
      console.error('Error fetching audit summary:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Get logs for specific entity
router.get(
  '/entity/:entityType/:entityId',
  verifyToken,
  requireAdmin,
  requirePermission('view_audit_logs'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('perPage').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req, res) => {
    try {
      const entityType = req.params.entityType;
      const entityId = req.params.entityId;
      const page = req.query.page || 1;
      const perPage = req.query.perPage || 20;
      const offset = (page - 1) * perPage;

      // Get logs
      const result = await pool.query(
        `SELECT
          al.id,
          al.actor_id,
          u.name as actor_name,
          al.action,
          al.metadata,
          al.created_at
        FROM audit_logs al
        LEFT JOIN users u ON al.actor_id = u.id
        WHERE al.entity_type = ? AND al.entity_id = ?
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?`,
        [entityType, entityId, perPage, offset]
      );

      // Get count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM audit_logs
        WHERE entity_type = ? AND entity_id = ?`,
        [entityType, entityId]
      );

      res.json({
        success: true,
        logs: result.rows,
        pagination: {
          page,
          perPage,
          total: parseInt(countResult.rows[0].total)
        }
      });
    } catch (error) {
      console.error('Error fetching entity logs:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Get logs by actor
router.get(
  '/actor/:actorId',
  verifyToken,
  requireAdmin,
  requirePermission('view_audit_logs'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('perPage').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req, res) => {
    try {
      const actorId = req.params.actorId;
      const page = req.query.page || 1;
      const perPage = req.query.perPage || 20;
      const offset = (page - 1) * perPage;

      // Get logs
      const result = await pool.query(
        `SELECT
          al.id,
          al.action,
          al.entity_type,
          al.entity_id,
          al.metadata,
          al.created_at
        FROM audit_logs al
        WHERE al.actor_id = ?
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?`,
        [actorId, perPage, offset]
      );

      // Get count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM audit_logs WHERE actor_id = ?`,
        [actorId]
      );

      res.json({
        success: true,
        logs: result.rows,
        pagination: {
          page,
          perPage,
          total: parseInt(countResult.rows[0].total)
        }
      });
    } catch (error) {
      console.error('Error fetching actor logs:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

module.exports = router;
