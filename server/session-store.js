import session from 'express-session';

const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function getExpiry(sessionData) {
  const cookie = sessionData?.cookie || {};
  if (cookie.expires) return new Date(cookie.expires).getTime();

  const maxAge = Number(cookie.maxAge);
  return Date.now() + (Number.isFinite(maxAge) && maxAge > 0 ? maxAge : DEFAULT_SESSION_TTL_MS);
}

export class SQLiteSessionStore extends session.Store {
  constructor(database) {
    super();
    this.database = database;
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS app_sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expiresAt INTEGER NOT NULL
      )
    `);

    this.findSession = this.database.prepare('SELECT sess, expiresAt FROM app_sessions WHERE sid = ?');
    this.saveSession = this.database.prepare(`
      INSERT INTO app_sessions (sid, sess, expiresAt) VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expiresAt = excluded.expiresAt
    `);
    this.removeSession = this.database.prepare('DELETE FROM app_sessions WHERE sid = ?');
    this.updateSession = this.database.prepare('UPDATE app_sessions SET sess = ?, expiresAt = ? WHERE sid = ?');
    this.removeExpiredSessions = this.database.prepare('DELETE FROM app_sessions WHERE expiresAt <= ?');

    this.cleanupTimer = setInterval(() => {
      try {
        this.removeExpiredSessions.run(Date.now());
      } catch {
        // A cleanup failure should not interrupt active requests.
      }
    }, 60 * 60 * 1000);
    this.cleanupTimer.unref?.();
  }

  get(sid, callback) {
    try {
      const row = this.findSession.get(sid);
      if (!row) return callback(null, null);
      if (row.expiresAt <= Date.now()) {
        this.removeSession.run(sid);
        return callback(null, null);
      }
      callback(null, JSON.parse(row.sess));
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sessionData, callback) {
    try {
      this.saveSession.run(sid, JSON.stringify(sessionData), getExpiry(sessionData));
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  touch(sid, sessionData, callback) {
    try {
      this.updateSession.run(JSON.stringify(sessionData), getExpiry(sessionData), sid);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  destroy(sid, callback) {
    try {
      this.removeSession.run(sid);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  clear(callback) {
    try {
      this.database.prepare('DELETE FROM app_sessions').run();
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  length(callback) {
    try {
      const { count } = this.database.prepare('SELECT COUNT(*) AS count FROM app_sessions').get();
      callback?.(null, count);
    } catch (error) {
      callback?.(error);
    }
  }
}
