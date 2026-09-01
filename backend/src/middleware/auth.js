const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const PRIMARY_SUPER_ADMIN_EMAIL = 'ahmad169qyp12q@gmail.com';

// Verify JWT token
const verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        error: {
          status: 401,
          message: 'No token provided'
        }
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: {
        status: 401,
        message: 'Invalid or expired token'
      }
    });
  }
};

// Check if user is admin (admin or super_admin)
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: { status: 401, message: 'Authentication required' }
      });
    }

    // Fetch user from database to get current role
    const result = await pool.query(
      'SELECT id, role, account_status FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0 || result.rows[0].account_status === 'inactive') {
      return res.status(403).json({
        error: { status: 403, message: 'Access denied' }
      });
    }

    const user = result.rows[0];
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return res.status(403).json({
        error: { status: 403, message: 'Admin access required' }
      });
    }

    req.user.role = user.role;
    next();
  } catch (error) {
    console.error('Error in requireAdmin:', error);
    res.status(500).json({
      error: { status: 500, message: 'Server error' }
    });
  }
};

// Check if user is super admin
const requireSuperAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: { status: 401, message: 'Authentication required' }
      });
    }

    const result = await pool.query(
      'SELECT id, email, role, account_status FROM users WHERE id = ?',
      [req.user.id]
    );

    const currentUser = result.rows[0];
    if (!currentUser
      || currentUser.role !== 'super_admin'
      || currentUser.account_status !== 'active'
      || currentUser.email?.toLowerCase() !== PRIMARY_SUPER_ADMIN_EMAIL) {
      return res.status(403).json({
        error: { status: 403, message: 'Primary Super Admin access required' }
      });
    }

    req.user.role = currentUser.role;
    req.user.email = currentUser.email;
    next();
  } catch (error) {
    console.error('Error in requireSuperAdmin:', error);
    res.status(500).json({
      error: { status: 500, message: 'Server error' }
    });
  }
};

// Check specific permission
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: { status: 401, message: 'Authentication required' }
        });
      }

      // Super admins bypass permission checks
      const superAdminCheck = await pool.query(
        'SELECT role FROM users WHERE id = $1 AND role = $2',
        [req.user.id, 'super_admin']
      );

      if (superAdminCheck.rows.length > 0) {
        return next();
      }

      // Check specific permission
      const permResult = await pool.query(
        `SELECT id FROM admin_permissions 
         WHERE admin_id = $1 AND permission_name = $2 AND is_granted = TRUE`,
        [req.user.id, permission]
      );

      if (permResult.rows.length === 0) {
        return res.status(403).json({
          error: { 
            status: 403, 
            message: `Permission denied: ${permission}` 
          }
        });
      }

      next();
    } catch (error) {
      console.error('Error in requirePermission:', error);
      res.status(500).json({
        error: { status: 500, message: 'Server error' }
      });
    }
  };
};

module.exports = {
  PRIMARY_SUPER_ADMIN_EMAIL,
  verifyToken,
  requireAdmin,
  requireSuperAdmin,
  requirePermission
};
