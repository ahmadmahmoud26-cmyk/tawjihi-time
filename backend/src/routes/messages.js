const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken, requireAdmin, requirePermission } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');

async function checkActiveMute(studentId) {
  const muteResult = await pool.query(
    `SELECT id, student_id, reason, muted_until, is_active
     FROM chat_mutes
     WHERE student_id = ? AND is_active = TRUE AND muted_until > datetime('now')`,
    [studentId]
  );

  return muteResult.rows[0] || null;
}

router.get('/public', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        pcm.id,
        pcm.sender_id,
        u.name as sender_name,
        u.role as sender_role,
        pcm.message,
        pcm.created_at
      FROM public_chat_messages pcm
      JOIN users u ON u.id = pcm.sender_id
      ORDER BY pcm.created_at ASC
      LIMIT 200`,
      []
    );

    res.json({ success: true, messages: result.rows });
  } catch (error) {
    console.error('Error fetching public chat:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

router.post(
  '/public',
  verifyToken,
  [
    body('message').trim().notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
      }

      const mute = await checkActiveMute(req.user.id);
      if (mute && req.user.role === 'student') {
        return res.status(403).json({
          error: {
            status: 403,
            message: `You are muted until ${new Date(mute.muted_until).toLocaleString()}.`
          }
        });
      }

      const { message } = req.body;
      await pool.query(
        `INSERT INTO public_chat_messages (sender_id, message, created_at)
         VALUES (?, ?, datetime('now'))`,
        [req.user.id, message]
      );

      const result = await pool.query(
        `SELECT id, sender_id, message, created_at FROM public_chat_messages
         WHERE sender_id = ? ORDER BY id DESC LIMIT 1`,
        [req.user.id]
      );

      const row = result.rows[0];
      const userResult = await pool.query('SELECT name, role FROM users WHERE id = ?', [req.user.id]);
      row.sender_name = userResult.rows[0].name;
      row.sender_role = userResult.rows[0].role;

      await pool.query(
        `INSERT INTO notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
         SELECT id, 'general_chat', 'رسالة جديدة في الشات العام', ?, 'general_chat', ?
         FROM users WHERE id != ? AND account_status = 'active'
         ON CONFLICT(recipient_id, related_entity_type, related_entity_id) DO NOTHING`,
        [`رسالة جديدة من ${row.sender_name}`, row.id, req.user.id]
      );

      res.status(201).json({ success: true, message: row });
    } catch (error) {
      console.error('Error sending public chat message:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

router.get('/public/mutes', verifyToken, requireAdmin, requirePermission('manage_students'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cm.id, cm.student_id, u.name as student_name, cm.reason, cm.muted_until, cm.is_active, cm.created_at
       FROM chat_mutes cm
       JOIN users u ON u.id = cm.student_id
       ORDER BY cm.muted_until DESC`,
      []
    );

    res.json({ success: true, mutes: result.rows });
  } catch (error) {
    console.error('Error fetching mutes:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

router.post(
  '/public/mute',
  verifyToken,
  requireAdmin,
  requirePermission('manage_students'),
  [
    body('studentId').isInt().toInt(),
    body('minutes').optional().isInt({ min: 1 }).toInt(),
    body('reason').optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
      }

      const { studentId, minutes = 60, reason = 'Muted by admin' } = req.body;
      const studentCheck = await pool.query('SELECT id, role FROM users WHERE id = ? AND role = ?', [studentId, 'student']);
      if (studentCheck.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Student not found' } });
      }

      await pool.query(
        `UPDATE chat_mutes SET is_active = FALSE, updated_at = datetime('now') WHERE student_id = ? AND is_active = TRUE`,
        [studentId]
      );

      const result = await pool.query(
        `INSERT INTO chat_mutes (student_id, admin_id, reason, muted_until, is_active, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now', '+' || ? || ' minutes'), TRUE, datetime('now'), datetime('now'))`,
        [studentId, req.user.id, reason, minutes]
      );

      const muteRow = await pool.query(
        `SELECT id, student_id, admin_id, reason, muted_until, is_active, created_at, updated_at
         FROM chat_mutes WHERE student_id = ? ORDER BY id DESC LIMIT 1`,
        [studentId]
      );

      res.status(201).json({ success: true, mute: muteRow.rows[0], message: 'Student muted successfully' });
    } catch (error) {
      console.error('Error muting student:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

router.post('/public/unmute', verifyToken, requireAdmin, requirePermission('manage_students'), [body('studentId').isInt().toInt()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
    }

    const result = await pool.query(
      `UPDATE chat_mutes SET is_active = FALSE, updated_at = datetime('now')
       WHERE student_id = ? AND is_active = TRUE`,
      [req.body.studentId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: { status: 404, message: 'No active mute found' } });
    }

    res.json({ success: true, message: 'Student unmuted successfully' });
  } catch (error) {
    console.error('Error unmuting student:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

router.delete('/public/:id', verifyToken, async (req, res) => {
  try {
    const messageId = Number(req.params.id);
    const messageResult = await pool.query(
      'SELECT sender_id FROM public_chat_messages WHERE id = ?',
      [messageId]
    );

    const message = messageResult.rows[0];
    if (!message) {
      return res.status(404).json({ error: { status: 404, message: 'Message not found' } });
    }

    const isOwner = message.sender_id === req.user.id;
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: { status: 403, message: 'You can only delete your own messages' } });
    }

    await pool.query('DELETE FROM public_chat_messages WHERE id = ?', [messageId]);
    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting public message:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const messageId = Number(req.params.id);
    const messageResult = await pool.query(
      'SELECT sender_id FROM messages WHERE id = ?',
      [messageId]
    );

    const message = messageResult.rows[0];
    if (!message) {
      return res.status(404).json({ error: { status: 404, message: 'Message not found' } });
    }

    const isOwner = message.sender_id === req.user.id;
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: { status: 403, message: 'You can only delete your own messages' } });
    }

    await pool.query('DELETE FROM messages WHERE id = ?', [messageId]);
    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting private message:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

// Send private message
router.get('/admins', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, profile_picture
       FROM users
       WHERE role IN ('admin', 'super_admin')
       ORDER BY name ASC`,
      []
    );

    res.json({ success: true, admins: result.rows });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

router.post(
  '/',
  verifyToken,
  [
    body('message').optional().trim(),
    body('imageData').optional().isString(),
    body('recipientId').isInt(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { status: 400, message: 'Validation error' } });
      }

      const senderId = req.user.id;
      const { message, imageData, recipientId } = req.body;
      const finalMessage = (imageData || message || '').trim();

      if (!finalMessage) {
        return res.status(400).json({ error: { status: 400, message: 'Message or image is required' } });
      }

      // Check if recipient exists
      const recipientCheck = await pool.query(
        'SELECT id, role FROM users WHERE id = ?',
        [recipientId]
      );

      if (recipientCheck.rows.length === 0) {
        return res.status(404).json({ error: { status: 404, message: 'Recipient not found' } });
      }

      const recipient = recipientCheck.rows[0];

      // Only allow student-admin or admin-student conversations
      const isStudentInitiated = req.user.role === 'student' && (recipient.role === 'admin' || recipient.role === 'super_admin');
      const isAdminInitiated = (req.user.role === 'admin' || req.user.role === 'super_admin') && recipient.role === 'student';

      if (!isStudentInitiated && !isAdminInitiated) {
        return res.status(403).json({ 
          error: { status: 403, message: 'Invalid conversation participants' }
        });
      }

      // Check if student is muted
      const mute = await checkActiveMute(senderId);
      if (req.user.role === 'student' && mute) {
        return res.status(403).json({
          error: { status: 403, message: `You are muted until ${new Date(mute.muted_until).toLocaleString()}.` }
        });
      }

      // Generate conversation ID (same for both directions)
      const [minId, maxId] = senderId < recipientId ? [senderId, recipientId] : [recipientId, senderId];
      const conversationId = `chat_${minId}_${maxId}`;

      // Insert message
      const insertResult = await pool.query(
        `INSERT INTO messages (sender_id, conversation_id, message, created_at)
        VALUES (?, ?, ?, datetime('now'))`,
        [senderId, conversationId, finalMessage]
      );
      const messageId = insertResult.rows[0]?.id || insertResult.lastID;

      // Send notification
      if (req.user.role === 'student') {
        await pool.query(
          `INSERT INTO notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
          VALUES (?, 'private_message', 'رسالة جديدة من طالب', ?, 'private_message', ?)
          ON CONFLICT(recipient_id, related_entity_type, related_entity_id) DO NOTHING`,
          [recipientId, `رسالة من ${req.user.name || 'طالب'}`, messageId]
        );
      } else {
        await pool.query(
          `INSERT INTO notifications (recipient_id, type, title, message, related_entity_type, related_entity_id)
          VALUES (?, 'private_message', 'رسالة جديدة من مشرف', ?, 'private_message', ?)
          ON CONFLICT(recipient_id, related_entity_type, related_entity_id) DO NOTHING`,
          [recipientId, `رسالة من المشرف`, messageId]
        );
      }

      const msgResult = await pool.query(
        `SELECT id, sender_id, message, created_at FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1`,
        [conversationId]
      );

      res.status(201).json({
        success: true,
        message: msgResult.rows[0],
        conversationId
      });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

router.get(
  '/conversation/:conversationId',
  verifyToken,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('perPage').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req, res) => {
    try {
      const conversationId = req.params.conversationId;
      const userId = req.user.id;
      const page = req.query.page || 1;
      const perPage = req.query.perPage || 20;
      const offset = (page - 1) * perPage;

      const result = await pool.query(
        `SELECT
          m.id,
          m.sender_id,
          u.name as sender_name,
          u.role as sender_role,
          m.message,
          m.is_read,
          m.created_at
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ?
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?`,
        [conversationId, perPage, offset]
      );

      await pool.query(
        `UPDATE messages SET is_read = true
        WHERE conversation_id = ? AND sender_id != ?`,
        [conversationId, userId]
      );

      const countResult = await pool.query(
        'SELECT COUNT(*) as total FROM messages WHERE conversation_id = ?',
        [conversationId]
      );

      res.json({
        success: true,
        messages: result.rows.reverse(),
        pagination: {
          page,
          perPage,
          total: parseInt(countResult.rows[0].total)
        }
      });
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: { status: 500, message: 'Server error' } });
    }
  }
);

// Get all conversations for current user
router.get('/list/all', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all unique conversation IDs for this user
    const conversationResult = await pool.query(
      `SELECT DISTINCT conversation_id FROM messages 
       WHERE conversation_id LIKE 'chat_%' 
       AND (sender_id = ? OR conversation_id LIKE '%' || ? || '%')
       ORDER BY conversation_id DESC`,
      [userId, userId]
    );

    const conversations = [];

    // For each conversation, build the conversation object
    for (const conv of conversationResult.rows) {
      const conversationId = conv.conversation_id;
      const idsPart = conversationId.replace('chat_', '');
      const [firstId, secondId] = idsPart.split('_');
      const otherUserId = Number(firstId) === userId ? Number(secondId) : Number(firstId);

      if (!otherUserId || Number.isNaN(otherUserId)) continue;

      // Get other user info
      const otherUserResult = await pool.query(
        'SELECT id, name, profile_picture, role FROM users WHERE id = ?',
        [otherUserId]
      );

      if (otherUserResult.rows.length === 0) continue;

      const otherUser = otherUserResult.rows[0];

      // Get last message
      const lastMsgResult = await pool.query(
        `SELECT id, message, created_at, sender_id FROM messages 
        WHERE conversation_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1`,
        [conversationId]
      );

      const lastMsg = lastMsgResult.rows[0];

      // Get unread count
      const unreadResult = await pool.query(
        `SELECT COUNT(*) as unread_count FROM messages 
        WHERE conversation_id = ? AND sender_id != ? AND is_read = FALSE`,
        [conversationId, userId]
      );

      conversations.push({
        conversationId: conversationId,
        otherUser: {
          id: otherUser.id,
          name: otherUser.name,
          profilePicture: otherUser.profile_picture,
          role: otherUser.role
        },
        lastMessage: lastMsg ? lastMsg.message : null,
        lastMessageAt: lastMsg ? lastMsg.created_at : null,
        lastMessageSenderId: lastMsg ? lastMsg.sender_id : null,
        unreadCount: unreadResult.rows[0] ? parseInt(unreadResult.rows[0].unread_count) : 0
      });
    }

    res.json({ success: true, conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: { status: 500, message: 'Server error' } });
  }
});

module.exports = router;
