const pool = require('../config/database');
const bcrypt = require('bcryptjs');

function resolveSuperAdminCredentials() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be configured in environment variables');
  }

  return { email, password };
}

async function initializeSuperAdmin() {
  try {
    const { email: superAdminEmail, password: superAdminPassword } = resolveSuperAdminCredentials();

    const existing = pool.query(
      "SELECT id FROM users WHERE email = ? AND role = 'super_admin'",
      [superAdminEmail]
    );

    if (existing.rows.length > 0) {
      console.log('✓ Super Admin already initialized');
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(superAdminPassword, salt);

    const result = pool.query(
      `INSERT INTO users (name, email, password_hash, role, account_status)
       VALUES (?, ?, ?, ?, ?)`,
      ['Super Admin', superAdminEmail, passwordHash, 'super_admin', 'active']
    );

    if (result.rows.length > 0 || result.rowCount > 0) {
      console.log('✓ Super Admin account initialized successfully');
      console.log(`  Email: ${superAdminEmail}`);
    }
  } catch (error) {
    console.error('Error initializing super admin:', error);
    throw error;
  }
}

async function initializeDefaultGrades() {
  try {
    const defaultGrades = [
      { name: 'الصف العاشر', description: 'المرحلة الأساسية', display_order: 1 },
      { name: 'الحادي عشر العلمي', description: 'المرحلة الثانوية - فرع العلمي', display_order: 2 },
      { name: 'الحادي عشر الأدبي', description: 'المرحلة الثانوية - فرع الأدبي', display_order: 3 },
      { name: 'الثاني عشر العلمي', description: 'المرحلة الثانوية - فرع العلمي', display_order: 4 },
      { name: 'الثاني عشر الأدبي', description: 'المرحلة الثانوية - فرع الأدبي', display_order: 5 }
    ];

    for (const grade of defaultGrades) {
      pool.query(
        `INSERT OR IGNORE INTO grades (name, description, display_order, active)
         VALUES (?, ?, ?, TRUE)`,
        [grade.name, grade.description, grade.display_order]
      );
    }

    const countResult = pool.query('SELECT COUNT(*) as total FROM grades WHERE active = TRUE');
    console.log(`✓ Default educational grades initialized (${countResult.rows[0].total} rows)`);
  } catch (error) {
    console.error('Error initializing default grades:', error);
    throw error;
  }
}

module.exports = { initializeSuperAdmin, initializeDefaultGrades, resolveSuperAdminCredentials };
