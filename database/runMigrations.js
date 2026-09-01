const fs = require('fs');
const path = require('path');
const pool = require('../backend/src/config/database');

const migrationsDir = path.join(__dirname, 'migrations');

async function runMigrations() {
  try {
    console.log('Starting database migrations...');

    pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();

    for (const file of files) {
      const migrationName = file.replace('.sql', '');
      const existing = pool.query(
        'SELECT * FROM schema_migrations WHERE name = ?',
        [migrationName]
      );

      if (existing.rows.length > 0) {
        console.log(`⊘ Skipped: ${migrationName} (already executed)`);
        continue;
      }

      console.log(`Running migration: ${migrationName}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      // Split by semicolon and execute each statement
      const statements = sql.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          pool.query(statement.trim());
        }
      }

      pool.query(
        'INSERT INTO schema_migrations (name) VALUES (?)',
        [migrationName]
      );

      console.log(`✓ Completed: ${migrationName}`);
    }

    console.log('All migrations completed!');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigrations };
