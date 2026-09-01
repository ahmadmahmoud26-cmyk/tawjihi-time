const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { recordStudentDailyActivity } = require('../utils/studentStreak');

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

// Generate JWT token
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

// Admin Login (Email/Password)
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: { status: 400, message: 'Email and password required' }
      });
    }

    // Find user
    const result = await pool.query(
      'SELECT id, email, password_hash, role, account_status FROM users WHERE email = ?',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: { status: 401, message: 'Invalid credentials' }
      });
    }

    const user = result.rows[0];

    // Check if admin
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return res.status(401).json({
        error: { status: 401, message: 'Invalid credentials' }
      });
    }

    // Check account status
    if (user.account_status !== 'active') {
      return res.status(403).json({
        error: { status: 403, message: 'Account is inactive' }
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        error: { status: 401, message: 'Invalid credentials' }
      });
    }

    // Update last login
    await pool.query(
      "UPDATE users SET last_login_at = datetime('now') WHERE id = ?",
      [user.id]
    );
    // Generate token
    const token = generateToken(user);
    const firstTime = !user.grade_id;

    res.json({
      success: true,
      firstTime,
      token,
      user: {
        id: user.id,
        name: user.name || user.email,
        email: user.email,
        role: user.role,
        grade_id: user.grade_id || null
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      error: { status: 500, message: 'Server error' }
    });
  }
});

// Student Login (manual credentials assigned by admin)
router.post('/student/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: { status: 400, message: 'Email and password required' }
      });
    }

    const result = await pool.query(
      'SELECT id, name, email, password_hash, role, account_status, grade_id FROM users WHERE email = ?',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: { status: 401, message: 'Invalid credentials' }
      });
    }

    const user = result.rows[0];

    if (user.role !== 'student') {
      return res.status(401).json({
        error: { status: 401, message: 'Invalid credentials' }
      });
    }

    if (user.account_status !== 'active') {
      return res.status(403).json({
        error: { status: 403, message: 'Account is inactive' }
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        error: { status: 401, message: 'Invalid credentials' }
      });
    }

    await pool.query(
      "UPDATE users SET last_login_at = datetime('now') WHERE id = ?",
      [user.id]
    );
    const streak = await recordStudentDailyActivity(user.id);

    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    const firstTime = !user.grade_id;

    res.json({
      success: true,
      firstTime,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        grade_id: user.grade_id || null
      }
    });
  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({
      error: { status: 500, message: 'Server error' }
    });
  }
});

// Complete Student Profile (after first login)
router.post('/complete-profile', verifyToken, async (req, res) => {
  try {
    const { gradeId, stageId, academicFieldId, subjects } = req.body;
    const userId = req.user.id;

    if (!gradeId && !stageId) {
      return res.status(400).json({
        error: { status: 400, message: 'Grade or stage is required' }
      });
    }

    if (stageId && academicFieldId) {
    const fieldCheck = await pool.query(
      'SELECT id FROM academic_fields WHERE id = ? AND stage_id = ? AND active = TRUE',
      [academicFieldId, stageId]
    );

      if (fieldCheck.rows.length === 0) {
        return res.status(400).json({
          error: { status: 400, message: 'Academic field does not belong to the selected stage' }
        });
      }
    }

    await pool.query(
      'UPDATE users SET grade_id = ?, stage_id = ?, academic_field_id = ? WHERE id = ?',
      [gradeId || null, stageId || null, academicFieldId || null, userId]
    );

    if (subjects && Array.isArray(subjects)) {
      for (const subjectId of subjects) {
        await pool.query(
          `INSERT OR IGNORE INTO student_subject_enrollments (student_id, subject_id)
           VALUES (?, ?)`,
          [userId, subjectId]
        );
      }
    }

    await pool.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
       VALUES (?, ?, ?, ?)`,
      [userId, 'profile_completed', 'user', userId]
    );

    res.json({ success: true, message: 'Profile completed' });
  } catch (error) {
    console.error('Complete profile error:', error);
    res.status(500).json({
      error: { status: 500, message: 'Server error' }
    });
  }
});

// Get current user
router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, profile_picture, role, grade_id, account_status, created_at, last_login_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: { status: 404, message: 'User not found' }
      });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: { status: 500, message: 'Server error' }
    });
  }
});

// Google OAuth callback (supports Google login flow from frontend or mobile)
router.post('/google/callback', async (req, res) => {
  try {
    const { tokenId, googleData } = req.body || {};
    const payload = googleData || {};
    const googleEmail = (payload.email || '').trim().toLowerCase();
    const googleId = payload.id || tokenId || null;
    const displayName = payload.name || payload.given_name || 'Student';
    const profilePicture = payload.picture || null;

    if (!googleEmail || !googleId) {
      return res.status(400).json({
        error: { status: 400, message: 'Google account data is required' }
      });
    }

    const existingUserResult = await pool.query(
      'SELECT id, name, email, role, account_status, profile_picture, google_id FROM users WHERE email = ? OR google_id = ?',
      [googleEmail, googleId]
    );

    if (existingUserResult.rows.length > 0) {
      const existingUser = existingUserResult.rows[0];
      const role = existingUser.role || 'student';

      if (existingUser.account_status !== 'active') {
        return res.status(403).json({
          error: { status: 403, message: 'Account is inactive' }
        });
      }

      await pool.query(
        `UPDATE users
         SET google_id = COALESCE(?, google_id),
             name = CASE WHEN ? != '' THEN ? ELSE name END,
             profile_picture = COALESCE(?, profile_picture),
             last_login_at = datetime('now'),
             updated_at = datetime('now')
         WHERE id = ?`,
        [googleId, displayName, displayName, profilePicture, existingUser.id]
      );

      const streak = role === 'student' ? await recordStudentDailyActivity(existingUser.id) : null;

      const token = generateToken({ id: existingUser.id, email: existingUser.email, role });

      return res.json({
        success: true,
        firstTime: false,
        token,
        user: {
          id: existingUser.id,
          name: existingUser.name || displayName,
          email: existingUser.email,
          role,
          profile_picture: existingUser.profile_picture || profilePicture,
          ...(streak !== null ? { streak } : {})
        }
      });
    }

    const createUserResult = await pool.query(
      `INSERT INTO users (name, email, google_id, profile_picture, role, account_status, created_at, updated_at, last_login_at)
       VALUES (?, ?, ?, ?, 'student', 'active', datetime('now'), datetime('now'), datetime('now'))`,
      [displayName, googleEmail, googleId, profilePicture]
    );

    // Get the newly created user
    const newUserResult = await pool.query(
      'SELECT id, name, email, role, account_status, profile_picture FROM users WHERE email = ?',
      [googleEmail]
    );

    const newUser = newUserResult?.rows?.[0] || {
      id: createUserResult?.rows?.[0]?.id || null,
      name: displayName,
      email: googleEmail,
      role: 'student',
      account_status: 'active',
      profile_picture: profilePicture
    };
    const token = generateToken({ id: newUser.id, email: newUser.email, role: newUser.role });
    const streak = await recordStudentDailyActivity(newUser.id);

    return res.json({
      success: true,
      firstTime: true,
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        profile_picture: newUser.profile_picture,
        streak
      }
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({
      error: { status: 500, message: 'Server error' }
    });
  }
});

// Logout (invalidate token on frontend)
router.post('/logout', verifyToken, (req, res) => {
  // Token invalidation is handled on frontend by removing the token
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
