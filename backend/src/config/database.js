const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

function buildDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      dialect: 'postgres',
      database: databaseUrl
    };
  }

  return {
    connectionString: `sqlite:${path.join(__dirname, '../../tawjihi_time.db')}`,
    dialect: 'sqlite',
    database: path.join(__dirname, '../../tawjihi_time.db')
  };
}

const dbPath = path.join(__dirname, '../../tawjihi_time.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Helper to convert PostgreSQL parameter style ($1, $2) to SQLite style (?)
function convertQuery(sql, params = []) {
  let converted = sql;
  let paramIndex = 1;
  
  // Replace $1, $2, $3... with ?
  while (converted.includes(`$${paramIndex}`)) {
    converted = converted.replace(`$${paramIndex}`, '?');
    paramIndex++;
  }
  
  return converted;
}

// Wrapper to make SQLite similar to pg pool interface
class SQLiteWrapper {
  query(sql, params = []) {
    try {
      const convertedSql = convertQuery(sql, params);
      
      // Handle different query types
      if (convertedSql.trim().toUpperCase().startsWith('SELECT')) {
        const stmt = db.prepare(convertedSql);
        return {
          rows: stmt.all(...params),
          rowCount: 0
        };
      } else if (convertedSql.trim().toUpperCase().startsWith('INSERT')) {
        const stmt = db.prepare(convertedSql);
        const result = stmt.run(...params);
        return {
          rows: [{ id: result.lastInsertRowid }],
          rowCount: result.changes
        };
      } else if (convertedSql.trim().toUpperCase().startsWith('UPDATE')) {
        const stmt = db.prepare(convertedSql);
        const result = stmt.run(...params);
        return {
          rows: [],
          rowCount: result.changes
        };
      } else if (convertedSql.trim().toUpperCase().startsWith('DELETE')) {
        const stmt = db.prepare(convertedSql);
        const result = stmt.run(...params);
        return {
          rows: [],
          rowCount: result.changes
        };
      } else if (convertedSql.trim().toUpperCase().startsWith('CREATE') || 
                 convertedSql.trim().toUpperCase().startsWith('ALTER') ||
                 convertedSql.trim().toUpperCase().startsWith('DROP')) {
        db.exec(convertedSql);
        return { rows: [], rowCount: 0 };
      } else {
        db.exec(convertedSql);
        return { rows: [], rowCount: 0 };
      }
    } catch (error) {
      console.error('Database error:', error);
      console.error('SQL:', sql);
      console.error('Params:', params);
      throw error;
    }
  }
}

const pool = new SQLiteWrapper();

module.exports = pool;
module.exports.buildDatabaseConfig = buildDatabaseConfig;
